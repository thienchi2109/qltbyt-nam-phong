package webpush

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

type scriptedBackend struct {
	mu         sync.Mutex
	claim      ClaimResponse
	claimCalls int
	reports    []ReportRequest
	reportFn   func(int, ReportRequest) (ReportResponse, error)
}

func (b *scriptedBackend) Claim(context.Context, ClaimRequest) (ClaimResponse, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.claimCalls++
	return b.claim, nil
}

func (b *scriptedBackend) Report(_ context.Context, request ReportRequest) (ReportResponse, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.reports = append(b.reports, request)
	if b.reportFn == nil {
		return reportResponse(request, "applied"), nil
	}
	return b.reportFn(len(b.reports), request)
}

type scriptedSender struct {
	mu       sync.Mutex
	sends    []Delivery
	timeouts []time.Duration
	sendFn   func(context.Context, Delivery, time.Duration) (ProviderResult, error)
}

func (s *scriptedSender) Send(ctx context.Context, delivery Delivery, _ VAPIDKey, timeout time.Duration) (ProviderResult, error) {
	s.mu.Lock()
	s.sends = append(s.sends, delivery)
	s.timeouts = append(s.timeouts, timeout)
	s.mu.Unlock()
	return s.sendFn(ctx, delivery, timeout)
}

func TestWorkerRetriesAcceptedReportWithoutCallingItDeliveredOrRead(t *testing.T) {
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	delivery := deliveryAt(now, 1)
	backend := &scriptedBackend{
		claim: claimResponseAt(now, []Delivery{delivery}),
		reportFn: func(call int, request ReportRequest) (ReportResponse, error) {
			if call == 1 {
				return ReportResponse{}, errors.New("report response lost")
			}
			return reportResponse(request, "duplicate"), nil
		},
	}
	sender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		return ProviderResult{Status: 201, Outcome: "accepted"}, nil
	}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return now })

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(sender.sends) != 1 {
		t.Fatalf("provider sends = %d, want 1 after report loss", len(sender.sends))
	}
	if len(backend.reports) != 2 {
		t.Fatalf("report calls = %d, want 2", len(backend.reports))
	}
	first, second := backend.reports[0].Results[0], backend.reports[1].Results[0]
	if first.Outcome != "accepted" || second.Outcome != "accepted" {
		t.Fatalf("report outcomes = %q/%q, want accepted/accepted", first.Outcome, second.Outcome)
	}
	if first.Outcome == "delivered" || first.Outcome == "read" || second.Outcome == "delivered" || second.Outcome == "read" {
		t.Fatalf("provider acceptance was reported as user state: %q/%q", first.Outcome, second.Outcome)
	}
	if first.AttemptToken != second.AttemptToken {
		t.Fatalf("attempt token changed across report retry: %q/%q", first.AttemptToken, second.AttemptToken)
	}
}

func TestWorkerReclaimsDeliveryAfterWorkerExitsBeforeReport(t *testing.T) {
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	delivery := deliveryAt(now, 1)
	delivery.Attempt = 0
	backend := &reclaimBackend{now: &now, delivery: delivery}
	firstContext, cancelFirst := context.WithCancel(context.Background())
	firstSender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		cancelFirst()
		return ProviderResult{Status: 201, Outcome: "accepted"}, nil
	}}
	firstWorker := newFailureWorker(t, backend, firstSender, func() time.Time { return now })

	if err := firstWorker.RunOnce(firstContext); !errors.Is(err, context.Canceled) {
		t.Fatalf("first worker error = %v, want context.Canceled", err)
	}
	if backend.reportCount() != 0 {
		t.Fatalf("first worker reported after exit: %d calls", backend.reportCount())
	}

	now = now.Add(46 * time.Second)
	secondSender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		return ProviderResult{Status: 201, Outcome: "accepted"}, nil
	}}
	secondWorker := newFailureWorker(t, backend, secondSender, func() time.Time { return now })
	if err := secondWorker.RunOnce(context.Background()); err != nil {
		t.Fatalf("reclaim worker error = %v", err)
	}
	if len(firstSender.sends) != 1 || len(secondSender.sends) != 1 {
		t.Fatalf("provider sends = first:%d second:%d, want one each", len(firstSender.sends), len(secondSender.sends))
	}
	if secondSender.sends[0].Attempt != 2 || secondSender.sends[0].SubscriptionID != delivery.SubscriptionID {
		t.Fatalf("reclaimed delivery = attempt %d subscription %q", secondSender.sends[0].Attempt, secondSender.sends[0].SubscriptionID)
	}
	if secondSender.sends[0].AttemptToken == firstSender.sends[0].AttemptToken {
		t.Fatalf("reclaim reused attempt token %q", secondSender.sends[0].AttemptToken)
	}
	if backend.reportCount() != 1 || backend.reports[0].Results[0].Outcome != "accepted" {
		t.Fatalf("reclaim report = %+v, want one accepted report", backend.reports)
	}
}

func TestWorkerDoesNotResendWhenBackendFencesStaleLease(t *testing.T) {
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	delivery := deliveryAt(now, 1)
	backend := &scriptedBackend{
		claim: claimResponseAt(now, []Delivery{delivery}),
		reportFn: func(_ int, request ReportRequest) (ReportResponse, error) {
			return reportResponse(request, "stale"), nil
		},
	}
	sender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		return ProviderResult{Status: 201, Outcome: "accepted"}, nil
	}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return now })

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(sender.sends) != 1 || len(backend.reports) != 1 {
		t.Fatalf("sends/reports = %d/%d, want 1/1", len(sender.sends), len(backend.reports))
	}
	if got := backend.reports[0].Results[0].Outcome; got != "accepted" {
		t.Fatalf("stale lease report outcome = %q, want accepted", got)
	}
}

func TestWorkerReportsExpiredDeadlineWithoutProviderSend(t *testing.T) {
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	delivery := deliveryAt(now, 1)
	delivery.Deadline = now.Add(-time.Second).Format(time.RFC3339)
	backend := &scriptedBackend{claim: claimResponseAt(now, []Delivery{delivery})}
	sender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		t.Fatal("provider send must not run after the delivery deadline")
		return ProviderResult{}, nil
	}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return now })

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(sender.sends) != 0 || len(backend.reports) != 1 {
		t.Fatalf("sends/reports = %d/%d, want 0/1", len(sender.sends), len(backend.reports))
	}
	result := backend.reports[0].Results[0]
	if result.Outcome != "not_sent_expired" || result.ProviderStatus != nil {
		t.Fatalf("expired report = %+v, want not_sent_expired with no provider status", result)
	}
}

func TestWorkerReportsEachSubscriptionIndependently(t *testing.T) {
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	deliveries := []Delivery{deliveryAt(now, 1), deliveryAt(now, 2), deliveryAt(now, 3)}
	backend := &scriptedBackend{claim: claimResponseAt(now, deliveries)}
	sender := &scriptedSender{sendFn: func(_ context.Context, delivery Delivery, _ time.Duration) (ProviderResult, error) {
		switch delivery.SubscriptionID {
		case uuidFor(201):
			return ProviderResult{Status: 201, Outcome: "accepted"}, nil
		case uuidFor(202):
			return ProviderResult{Status: 410, Outcome: "endpoint_gone"}, nil
		case uuidFor(203):
			return ProviderResult{Status: 429, Outcome: "transient"}, nil
		default:
			return ProviderResult{}, fmt.Errorf("unexpected subscription %q", delivery.SubscriptionID)
		}
	}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return now })

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(sender.sends) != len(deliveries) || len(backend.reports) != 1 || len(backend.reports[0].Results) != len(deliveries) {
		t.Fatalf("sends/reports/results = %d/%d/%d, want %d/1/%d", len(sender.sends), len(backend.reports), len(backend.reports[0].Results), len(deliveries), len(deliveries))
	}
	want := map[string]string{
		uuidFor(201): "accepted",
		uuidFor(202): "endpoint_gone",
		uuidFor(203): "transient",
	}
	got := make(map[string]string, len(backend.reports[0].Results))
	for _, result := range backend.reports[0].Results {
		got[result.DeliveryID] = result.Outcome
	}
	for _, delivery := range deliveries {
		if got[delivery.DeliveryID] != want[delivery.SubscriptionID] {
			t.Fatalf("subscription %q report = %q, want %q", delivery.SubscriptionID, got[delivery.DeliveryID], want[delivery.SubscriptionID])
		}
	}
}

func newFailureWorker(t *testing.T, backend Backend, sender Sender, now func() time.Time) *Worker {
	t.Helper()
	key := testVAPIDKey(t)
	return NewWorker(WorkerConfig{
		API:                 backend,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Now:                 now,
		Sleep:               func(context.Context, time.Duration) error { return nil },
	})
}

func claimResponseAt(now time.Time, deliveries []Delivery) ClaimResponse {
	return ClaimResponse{Version: 1, ServerTime: now.Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: deliveries}
}

func reportResponse(request ReportRequest, result string) ReportResponse {
	results := make([]ReportResult, len(request.Results))
	for index, item := range request.Results {
		results[index] = ReportResult{DeliveryID: item.DeliveryID, Result: result}
	}
	return ReportResponse{Version: 1, Results: results}
}

func deliveryAt(now time.Time, index int) Delivery {
	delivery := testDelivery()
	delivery.DeliveryID = uuidFor(index)
	delivery.AttemptToken = uuidFor(100 + index)
	delivery.SubscriptionID = uuidFor(200 + index)
	delivery.LeaseExpiresAt = now.Add(45 * time.Second).Format(time.RFC3339)
	delivery.Deadline = now.Add(time.Hour).Format(time.RFC3339)
	return delivery
}

func uuidFor(value int) string {
	return fmt.Sprintf("00000000-0000-0000-0000-%012d", value)
}

type reclaimBackend struct {
	mu          sync.Mutex
	now         *time.Time
	delivery    Delivery
	claimCalls  int
	reportCalls int
	reports     []ReportRequest
}

func (b *reclaimBackend) Claim(_ context.Context, _ ClaimRequest) (ClaimResponse, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.claimCalls++
	lease, err := parseTime(b.delivery.LeaseExpiresAt)
	if err != nil {
		return ClaimResponse{}, err
	}
	if b.claimCalls > 1 && b.delivery.Attempt > 0 && b.now.Before(lease) {
		return claimResponseAt(*b.now, nil), nil
	}
	b.delivery.Attempt++
	b.delivery.AttemptToken = uuidFor(100 + b.delivery.Attempt)
	b.delivery.LeaseExpiresAt = b.now.Add(45 * time.Second).Format(time.RFC3339)
	return claimResponseAt(*b.now, []Delivery{b.delivery}), nil
}

func (b *reclaimBackend) Report(ctx context.Context, request ReportRequest) (ReportResponse, error) {
	if err := ctx.Err(); err != nil {
		return ReportResponse{}, err
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	b.reportCalls++
	b.reports = append(b.reports, request)
	return reportResponse(request, "applied"), nil
}

func (b *reclaimBackend) reportCount() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.reportCalls
}
