package webpush

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestWorkerCancellationCannotRecordLateProviderSuccess(t *testing.T) {
	now := time.Now().UTC()
	backend := &scriptedBackend{claim: claimResponseAt(now, []Delivery{deliveryAt(now, 1)})}
	ctx, cancel := context.WithCancel(context.Background())
	sender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		cancel()
		return ProviderResult{Status: 201}, nil
	}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return now })
	worker.metrics = NewMetrics()
	if err := worker.RunOnce(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled send returned %v", err)
	}
	if got := worker.metrics.snapshot(); got.accepted != 0 || got.cancelled != 1 || len(backend.reports) != 0 {
		t.Fatalf("late provider success counted as accepted: %+v, reports=%d", got, len(backend.reports))
	}
}

func TestWorkerCancellationCannotMarkLateReportSuccessReady(t *testing.T) {
	now := time.Now().UTC()
	ctx, cancel := context.WithCancel(context.Background())
	backend := &scriptedBackend{
		claim: claimResponseAt(now, []Delivery{deliveryAt(now, 1)}),
		reportFn: func(_ int, req ReportRequest) (ReportResponse, error) {
			cancel()
			return reportResponse(req, "applied"), nil
		},
	}
	sender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		return ProviderResult{Status: 201}, nil
	}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return now })
	ready := false
	worker.onReady = func(value bool) { ready = value }
	if err := worker.RunOnce(ctx); !errors.Is(err, context.Canceled) || ready {
		t.Fatalf("late report success returned %v, ready=%v", err, ready)
	}
}

func TestWorkerCancellationCannotMarkLateEmptyClaimReady(t *testing.T) {
	now := time.Now().UTC()
	ctx, cancel := context.WithCancel(context.Background())
	backend := runtimeBackend{claim: func(context.Context, ClaimRequest) (ClaimResponse, error) {
		cancel()
		return claimResponseAt(now, nil), nil
	}}
	worker := newFailureWorker(t, backend, &fakeSender{}, func() time.Time { return now })
	ready := false
	worker.onReady = func(value bool) { ready = value }
	if err := worker.RunOnce(ctx); !errors.Is(err, context.Canceled) || ready {
		t.Fatalf("late empty claim returned %v, ready=%v", err, ready)
	}
}
