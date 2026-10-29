package webpush

import (
	"context"
	"sync"
	"time"
)

func (w *Worker) sendBatch(ctx context.Context, deliveries []Delivery, now time.Time) ([]ReportItem, time.Time, error) {
	results := make([]ReportItem, len(deliveries))
	var earliestLease time.Time
	for _, delivery := range deliveries {
		lease, err := parseTime(delivery.LeaseExpiresAt)
		if err != nil {
			return nil, time.Time{}, ErrInvalidResponse
		}
		if earliestLease.IsZero() || lease.Before(earliestLease) {
			earliestLease = lease
		}
	}
	sem := make(chan struct{}, claimLimit)
	var wg sync.WaitGroup
	var firstErr error
	var errMu sync.Mutex
	for index, delivery := range deliveries {
		index, delivery := index, delivery
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
			case <-ctx.Done():
				if w.metrics != nil {
					w.metrics.Record("cancelled", 0)
				}
				errMu.Lock()
				if firstErr == nil {
					firstErr = ctx.Err()
				}
				errMu.Unlock()
				return
			}
			defer func() { <-sem }()
			result, err := w.sendOne(ctx, delivery, now)
			if err != nil {
				errMu.Lock()
				if firstErr == nil {
					firstErr = err
				}
				errMu.Unlock()
				return
			}
			results[index] = result
		}()
	}
	wg.Wait()
	if firstErr != nil {
		return nil, time.Time{}, firstErr
	}
	return results, earliestLease, nil
}

func (w *Worker) sendOne(ctx context.Context, delivery Delivery, now time.Time) (ReportItem, error) {
	started := time.Now()
	recordOutcome := func(outcome string) {
		if w.metrics != nil {
			w.metrics.Record(outcome, time.Since(started))
		}
	}
	record := func(item ReportItem) ReportItem {
		recordOutcome(item.Outcome)
		return item
	}
	if delivery.VAPIDKeyVersion != w.vapid.Version {
		recordOutcome("failed")
		return ReportItem{}, ErrVAPIDMismatch
	}
	now = now.UTC()
	deadline, err := parseTime(delivery.Deadline)
	if err != nil {
		recordOutcome("failed")
		return ReportItem{}, ErrInvalidResponse
	}
	lease, err := parseTime(delivery.LeaseExpiresAt)
	if err != nil {
		recordOutcome("failed")
		return ReportItem{}, ErrInvalidResponse
	}
	if !deadline.After(now) || delivery.TTLSeconds < 1 {
		return record(reportItem(delivery, "not_sent_expired", nil, nil)), nil
	}
	if !lease.After(now) || lease.Sub(now) <= providerTimeout {
		return record(reportItem(delivery, "not_sent_lease_expired", nil, nil)), nil
	}
	remainingTTL := int(deadline.Sub(now) / time.Second)
	if remainingTTL > 86400 {
		remainingTTL = 86400
	}
	if delivery.TTLSeconds < remainingTTL {
		remainingTTL = delivery.TTLSeconds
	}
	if remainingTTL < 1 {
		return record(reportItem(delivery, "not_sent_expired", nil, nil)), nil
	}
	delivery.TTLSeconds = remainingTTL
	timeout := providerTimeout
	if remaining := deadline.Sub(now); remaining < timeout {
		timeout = remaining
	}
	sendCtx, cancel := context.WithTimeout(ctx, timeout)
	result, sendErr := w.sender.Send(sendCtx, delivery, w.vapid, timeout)
	cancel()
	if ctx.Err() != nil {
		recordOutcome("cancelled")
		return ReportItem{}, ctx.Err()
	}
	if sendErr != nil {
		if ctx.Err() != nil {
			recordOutcome("cancelled")
			return ReportItem{}, ctx.Err()
		}
		return record(reportItem(delivery, "transient", nil, nil)), nil
	}
	outcome := result.Outcome
	if outcome == "" {
		outcome = outcomeForStatus(result.Status)
	}
	var status *int
	if result.Status > 0 {
		status = &result.Status
	}
	return record(reportItem(delivery, outcome, status, result.RetryAfterSeconds)), nil
}
