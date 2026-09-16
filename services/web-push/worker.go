package webpush

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"sync"
	"time"
)

const (
	claimLimit        = 5
	providerTimeout   = 10 * time.Second
	workerCallTimeout = 5 * time.Second
	maxReportRetries  = 2
)

var (
	ErrInvalidResponse = errors.New("invalid worker API response")
	ErrWorkerNotReady  = errors.New("worker is not ready")
	ErrWorkerPaused    = errors.New("worker is paused")
)

type WorkerConfig struct {
	API                 Backend
	Sender              Sender
	VAPID               VAPIDKey
	WorkerID            string
	ExpectedVersion     string
	ExpectedPublicKey   string
	ExpectedFingerprint string
	Paused              bool
	Metrics             *Metrics
	OnReady             func(bool)
	Now                 func() time.Time
	Sleep               func(context.Context, time.Duration) error
	Jitter              func() float64
}

type Worker struct {
	api                 Backend
	sender              Sender
	vapid               VAPIDKey
	workerID            string
	expectedVersion     string
	expectedPublicKey   string
	expectedFingerprint string
	paused              bool
	metrics             *Metrics
	onReady             func(bool)
	now                 func() time.Time
	sleep               func(context.Context, time.Duration) error
	jitter              func() float64
}

func NewWorker(config WorkerConfig) *Worker {
	workerID := config.WorkerID
	if workerID == "" {
		workerID = "oracle-web-push-1"
	}
	expectedVersion := config.ExpectedVersion
	expectedPublicKey := config.ExpectedPublicKey
	expectedFingerprint := config.ExpectedFingerprint
	now := config.Now
	if now == nil {
		now = time.Now
	}
	sleep := config.Sleep
	if sleep == nil {
		sleep = sleepContext
	}
	jitter := config.Jitter
	if jitter == nil {
		jitter = rand.Float64
	}
	return &Worker{
		api:                 config.API,
		sender:              config.Sender,
		vapid:               config.VAPID,
		workerID:            workerID,
		expectedVersion:     expectedVersion,
		expectedPublicKey:   expectedPublicKey,
		expectedFingerprint: expectedFingerprint,
		paused:              config.Paused,
		metrics:             config.Metrics,
		onReady:             config.OnReady,
		now:                 now,
		sleep:               sleep,
		jitter:              jitter,
	}
}

// RunOnce processes at most one claimed batch and never prefetches another batch.
func (w *Worker) RunOnce(ctx context.Context) error {
	_, _, err := w.runOnce(ctx)
	return err
}

// Run polls until the context is cancelled. It keeps retry state in memory only;
// delivery ownership and retry scheduling remain in the QLTBYT backend.
func (w *Worker) Run(ctx context.Context) error {
	backoffAttempt := 0
	for {
		if err := ctx.Err(); err != nil {
			w.setReady(false)
			return err
		}
		delay, immediate, err := w.runOnce(ctx)
		if err == nil {
			backoffAttempt = 0
			if immediate {
				continue
			}
			if err := w.sleep(ctx, delay); err != nil {
				w.setReady(false)
				return err
			}
			continue
		}
		if errors.Is(err, ErrVAPIDMismatch) || errors.Is(err, ErrWorkerNotReady) {
			w.setReady(false)
			return err
		}
		if errors.Is(err, ErrWorkerPaused) {
			if err := w.sleep(ctx, time.Minute); err != nil {
				w.setReady(false)
				return err
			}
			continue
		}
		if !isRetryableWorkerError(err) {
			w.setReady(false)
			return err
		}
		if isDisabledError(err) {
			delay = time.Minute
		} else {
			delay = w.transportBackoff(backoffAttempt)
			var apiErr *APIError
			if errors.As(err, &apiErr) && apiErr.RetryAfterSeconds != nil {
				retryAfter := time.Duration(*apiErr.RetryAfterSeconds) * time.Second
				if retryAfter > delay {
					delay = retryAfter
				}
			}
			backoffAttempt++
		}
		if err := w.sleep(ctx, delay); err != nil {
			w.setReady(false)
			return err
		}
	}
}

func (w *Worker) runOnce(ctx context.Context) (time.Duration, bool, error) {
	if w.paused {
		w.setReady(false)
		return 0, false, ErrWorkerPaused
	}
	if err := w.checkReady(); err != nil {
		w.setReady(false)
		return 0, false, err
	}
	if w.api == nil || w.sender == nil {
		w.setReady(false)
		return 0, false, fmt.Errorf("%w: dependencies unavailable", ErrWorkerNotReady)
	}
	claim := ClaimRequest{
		Version:          1,
		WorkerID:         w.workerID,
		Limit:            claimLimit,
		VAPIDKeyVersion:  w.vapid.Version,
		VAPIDFingerprint: w.vapid.Fingerprint,
	}
	claimCtx, cancel := context.WithTimeout(ctx, workerCallTimeout)
	response, err := w.api.Claim(claimCtx, claim)
	cancel()
	if err != nil {
		w.setReady(false)
		return 0, false, err
	}
	if !validClaimResponse(response) {
		w.setReady(false)
		return 0, false, ErrInvalidResponse
	}
	serverNow, err := parseTime(response.ServerTime)
	if err != nil {
		w.setReady(false)
		return 0, false, ErrInvalidResponse
	}
	serverOffset := serverNow.Sub(w.now().UTC())
	results, earliestLease, err := w.sendBatch(ctx, response.Deliveries, serverNow)
	if err != nil {
		w.setReady(false)
		return 0, false, err
	}
	if len(results) == 0 {
		w.setReady(true)
		return pollDelay(response), false, nil
	}
	if err := w.reportWithRetry(ctx, ReportRequest{Version: 1, Results: results}, earliestLease, func() time.Time {
		return w.now().UTC().Add(serverOffset)
	}); err != nil {
		w.setReady(false)
		return 0, false, err
	}
	w.setReady(true)
	return pollDelay(response), len(response.Deliveries) == claimLimit, nil
}

func (w *Worker) setReady(ready bool) {
	if w.onReady != nil {
		w.onReady(ready)
	}
}

func (w *Worker) checkReady() error {
	if !workerIDPattern.MatchString(w.workerID) ||
		w.vapid.Version == "" || w.vapid.PublicKey == "" || w.vapid.Fingerprint == "" ||
		w.expectedVersion == "" || w.expectedPublicKey == "" || w.expectedFingerprint == "" {
		return ErrWorkerNotReady
	}
	derivedPublicKey, derivedFingerprint, err := deriveVAPIDArtifact(w.vapid.privateKey)
	if err != nil || derivedPublicKey != w.vapid.PublicKey || derivedFingerprint != w.vapid.Fingerprint {
		return ErrVAPIDMismatch
	}
	if w.vapid.Version != w.expectedVersion ||
		w.vapid.PublicKey != w.expectedPublicKey ||
		w.vapid.Fingerprint != w.expectedFingerprint {
		return ErrVAPIDMismatch
	}
	return nil
}

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

func (w *Worker) reportWithRetry(ctx context.Context, request ReportRequest, lease time.Time, now func() time.Time) error {
	var lastErr error
	for attempt := 0; attempt <= maxReportRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		remaining := lease.Sub(now().UTC())
		if !lease.IsZero() && remaining <= 0 {
			return lastErrOrLeaseError(lastErr)
		}
		timeout := workerCallTimeout
		if !lease.IsZero() && remaining < timeout {
			timeout = remaining
		}
		reportCtx, cancel := context.WithTimeout(ctx, timeout)
		response, err := w.api.Report(reportCtx, request)
		cancel()
		if err == nil && validReportResponse(response, request) {
			return nil
		}
		if err == nil {
			err = ErrInvalidResponse
		}
		lastErr = err
		if !isRetryableWorkerError(err) || attempt == maxReportRetries {
			return err
		}
		delay := time.Duration(1<<attempt) * time.Second
		var apiErr *APIError
		if errors.As(err, &apiErr) && apiErr.RetryAfterSeconds != nil {
			retryAfter := time.Duration(*apiErr.RetryAfterSeconds) * time.Second
			if retryAfter > delay {
				delay = retryAfter
			}
		}
		if !lease.IsZero() && lease.Sub(now().UTC()) <= delay {
			return err
		}
		if err := w.sleep(ctx, delay); err != nil {
			return err
		}
	}
	return lastErr
}

func (w *Worker) transportBackoff(attempt int) time.Duration {
	if attempt > 4 {
		attempt = 4
	}
	base := 5 * time.Second * time.Duration(1<<attempt)
	if base > time.Minute {
		base = time.Minute
	}
	return base + time.Duration(float64(base)*0.2*w.jitter())
}
