package webpush

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"
)

func TestBackendErrorPreservesWrappedDiagnostics(t *testing.T) {
	cause := errors.New("backend unavailable")
	apiErr := &APIError{Status: 503, Err: cause}
	wrapped := fmt.Errorf("claim: %w", apiErr)
	err := backendError(wrapped)
	var gotAPI *APIError
	var gotBackend *BackendError
	if !errors.As(err, &gotBackend) || !errors.As(err, &gotAPI) || gotAPI != apiErr || !errors.Is(err, cause) {
		t.Fatalf("error chain lost original cause/APIError: %v", err)
	}
	if gotBackend.Unwrap() != wrapped || err.Error() != wrapped.Error() {
		t.Fatalf("wrapped diagnostics changed: %v", err)
	}
	if backendError(nil) != nil {
		t.Fatal("successful backend call must return nil error")
	}
	if isRetryableWorkerError(backendError(ErrInvalidResponse)) || !isRetryableWorkerError(backendError(cause)) {
		t.Fatal("non API mapping changed terminal invalid-response or retryable unknown policy")
	}
}

func TestWorkerBackendPollingPolicy(t *testing.T) {
	hint := 90 * time.Second
	shortHint := time.Second
	cases := []struct {
		name  string
		err   error
		delay time.Duration
	}{
		{"retryable overrides invalid cause", &BackendError{Retryable: true, Err: ErrInvalidResponse}, 5 * time.Second},
		{"terminal overrides unknown cause", &BackendError{Err: errors.New("queue rejected claim")}, 0},
		{"terminal disabled", &BackendError{Disabled: true, Err: errors.New("queue disabled")}, 0},
		{"disabled ignores longer hint", &BackendError{Retryable: true, Disabled: true, RetryAfter: &hint}, time.Minute},
		{"retry hint", &BackendError{Retryable: true, RetryAfter: &hint}, 90 * time.Second},
		{"short hint keeps base", &BackendError{Retryable: true, RetryAfter: &shortHint}, 5 * time.Second},
		{"invalid non API response", fmt.Errorf("claim: %w", ErrInvalidResponse), 0},
		{"unknown non API failure", errors.New("queue unavailable"), 5 * time.Second},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			backend := &fakeAPI{claimErr: fmt.Errorf("backend: %w", tc.err)}
			worker := newFailureWorker(t, backend, &fakeSender{}, time.Now)
			worker.jitter = func() float64 { return 0 }
			var delays []time.Duration
			worker.sleep = func(_ context.Context, delay time.Duration) error {
				delays = append(delays, delay)
				return context.Canceled
			}
			err := worker.Run(context.Background())
			if tc.delay == 0 {
				if !errors.Is(err, tc.err) || len(delays) != 0 {
					t.Fatalf("terminal error/delays = %v/%v, want original error/no sleep", err, delays)
				}
			} else if !errors.Is(err, context.Canceled) || !reflect.DeepEqual(delays, []time.Duration{tc.delay}) {
				t.Fatalf("retry error/delays = %v/%v, want canceled/[%v]", err, delays, tc.delay)
			}
			if backend.claimCalls != 1 {
				t.Fatalf("claim calls = %d, want 1", backend.claimCalls)
			}
		})
	}
}

func TestWorkerReportRetryPolicy(t *testing.T) {
	hint := 3 * time.Second
	shortHint := 500 * time.Millisecond
	cases := []struct {
		name   string
		err    error
		calls  int
		delays []time.Duration
	}{
		{"terminal", &BackendError{Err: errors.New("queue rejected report")}, 1, nil},
		{"retryable overrides invalid cause", &BackendError{Retryable: true, Err: ErrInvalidResponse}, 3, []time.Duration{time.Second, 2 * time.Second}},
		{"unknown failure", errors.New("queue unavailable"), 3, []time.Duration{time.Second, 2 * time.Second}},
		{"invalid response", ErrInvalidResponse, 1, nil},
		{"disabled report honors hint", &BackendError{Retryable: true, Disabled: true, RetryAfter: &hint}, 3, []time.Duration{3 * time.Second, 3 * time.Second}},
		{"short hint keeps base", &BackendError{Retryable: true, RetryAfter: &shortHint}, 3, []time.Duration{time.Second, 2 * time.Second}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
			backend := &fakeAPI{reportErrs: []error{tc.err, tc.err, tc.err}}
			worker := newFailureWorker(t, backend, &fakeSender{}, func() time.Time { return now })
			var delays []time.Duration
			worker.sleep = func(_ context.Context, delay time.Duration) error {
				delays = append(delays, delay)
				now = now.Add(delay)
				return nil
			}
			err := worker.reportWithRetry(context.Background(), ReportRequest{Version: 1}, now.Add(time.Minute), func() time.Time { return now })
			if !errors.Is(err, tc.err) || backend.reportCalls != tc.calls || !reflect.DeepEqual(delays, tc.delays) {
				t.Fatalf("error/calls/delays = %v/%d/%v, want original error/%d/%v", err, backend.reportCalls, delays, tc.calls, tc.delays)
			}
		})
	}
}

func TestWorkerReportRetryUsesEarliestLeaseAndServerOffset(t *testing.T) {
	localNow := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	serverNow := localNow.Add(time.Hour)
	first, second := deliveryAt(serverNow, 1), deliveryAt(serverNow, 2)
	first.LeaseExpiresAt = serverNow.Add(40 * time.Second).Format(time.RFC3339)
	second.LeaseExpiresAt = serverNow.Add(15 * time.Second).Format(time.RFC3339)
	reportErr := errors.New("report lost")
	backend := &scriptedBackend{
		claim: claimResponseAt(serverNow, []Delivery{first, second}),
		reportFn: func(_ int, _ ReportRequest) (ReportResponse, error) {
			localNow = localNow.Add(14 * time.Second)
			return ReportResponse{}, reportErr
		},
	}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	worker := newFailureWorker(t, backend, sender, func() time.Time { return localNow })
	worker.sleep = func(context.Context, time.Duration) error {
		t.Fatal("report retry would reach the earliest batch lease")
		return nil
	}
	if err := worker.RunOnce(context.Background()); !errors.Is(err, reportErr) {
		t.Fatalf("RunOnce() error = %v, want report error", err)
	}
	if len(sender.sends) != 2 || len(backend.reports) != 1 {
		t.Fatalf("sends/reports = %d/%d, want 2/1", len(sender.sends), len(backend.reports))
	}
}

func TestWorkerReportsProviderFailuresWithoutResending(t *testing.T) {
	cases := []struct {
		name    string
		status  int
		err     error
		outcome string
	}{
		{"transport error", 0, errors.New("provider unavailable"), "transient"},
		{"missing endpoint", 404, nil, "endpoint_gone"},
		{"gone endpoint", 410, nil, "endpoint_gone"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
			delivery := deliveryAt(now, 1)
			backend := &scriptedBackend{claim: claimResponseAt(now, []Delivery{delivery})}
			sender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
				return ProviderResult{Status: tc.status}, tc.err
			}}
			worker := newFailureWorker(t, backend, sender, func() time.Time { return now })
			if err := worker.RunOnce(context.Background()); err != nil {
				t.Fatal(err)
			}
			if len(sender.sends) != 1 || len(backend.reports) != 1 || len(backend.reports[0].Results) != 1 {
				t.Fatalf("sends/reports = %d/%d, want 1/1", len(sender.sends), len(backend.reports))
			}
			result := backend.reports[0].Results[0]
			var status *int
			if tc.status != 0 {
				status = &tc.status
			}
			want := ReportItem{
				DeliveryID: delivery.DeliveryID, AttemptToken: delivery.AttemptToken,
				SubscriptionRevision: delivery.SubscriptionRevision, Outcome: tc.outcome, ProviderStatus: status,
			}
			if !reflect.DeepEqual(result, want) {
				t.Fatalf("provider failure report = %+v", result)
			}
		})
	}
}
