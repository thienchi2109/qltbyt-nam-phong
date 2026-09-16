package webpush

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestParsePauseDefaultsToPausedAndRejectsInvalidValuesFailClosed(t *testing.T) {
	paused, err := ParsePause("")
	if err != nil || !paused {
		t.Fatalf("ParsePause(\"\") = %v, %v; want paused default", paused, err)
	}
	paused, err = ParsePause("maybe")
	if err == nil || !paused {
		t.Fatalf("ParsePause(\"maybe\") = %v, %v; want paused error", paused, err)
	}
}

func TestPausedWorkerDoesNotClaim(t *testing.T) {
	key := testVAPIDKey(t)
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	delivery := testDelivery()
	delivery.LeaseExpiresAt = now.Add(45 * time.Second).Format(time.RFC3339)
	delivery.Deadline = now.Add(time.Hour).Format(time.RFC3339)
	api := &fakeAPI{claim: ClaimResponse{
		Version:          1,
		ServerTime:       now.Format(time.RFC3339),
		PollAfterSeconds: 5,
		Deliveries:       []Delivery{delivery},
	}}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              &fakeSender{result: ProviderResult{Status: 201}},
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Paused:              true,
		Now:                 func() time.Time { return now },
	})
	if err := worker.RunOnce(context.Background()); !errors.Is(err, ErrWorkerPaused) {
		t.Fatalf("RunOnce() error = %v, want ErrWorkerPaused", err)
	}
	if api.claimCalls != 0 {
		t.Fatalf("claim calls = %d, want 0", api.claimCalls)
	}
}

func TestHealthReadinessAndMetricsExposeOnlyBoundedLocalState(t *testing.T) {
	metrics := NewMetrics()
	metrics.Record("accepted", time.Second)
	metrics.Record("transient", 2*time.Second)
	metrics.Record("not_sent_expired", 3*time.Second)
	state := NewHealthState(false, metrics)
	handler := state.Handler()
	state.SetReady(true)

	assertHTTP := func(path string, wantStatus int, wantBody string) {
		t.Helper()
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != wantStatus || recorder.Body.String() != wantBody {
			t.Fatalf("GET %s = %d %q, want %d %q", path, recorder.Code, recorder.Body.String(), wantStatus, wantBody)
		}
	}

	assertHTTP("/healthz", http.StatusOK, "ok\n")
	assertHTTP("/readyz", http.StatusOK, "ready\n")
	state.SetPaused(true)
	assertHTTP("/readyz", http.StatusServiceUnavailable, "paused\n")
	state.SetReady(false)
	assertHTTP("/readyz", http.StatusServiceUnavailable, "not_ready\n")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body := recorder.Body.String()
	for _, expected := range []string{
		"web_push_deliveries_accepted_total 1\n",
		"web_push_deliveries_retried_total 1\n",
		"web_push_deliveries_expired_total 1\n",
		"web_push_send_latency_seconds_count 3\n",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("metrics missing %q in %q", expected, body)
		}
	}
	for _, forbidden := range []string{"https://", "payload", "private", "secret", "backlog"} {
		if strings.Contains(strings.ToLower(body), forbidden) {
			t.Fatalf("metrics contain forbidden value %q: %q", forbidden, body)
		}
	}
}

func TestHealthStateStartsFailClosedUntilRuntimeMarksReady(t *testing.T) {
	state := NewHealthState(false, NewMetrics())
	handler := state.Handler()

	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable || recorder.Body.String() != "not_ready\n" {
		t.Fatalf("initial /readyz = %d %q, want 503 not_ready", recorder.Code, recorder.Body.String())
	}

	state.SetReady(true)
	recorder = httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "ready\n" {
		t.Fatalf("marked-ready /readyz = %d %q, want 200 ready", recorder.Code, recorder.Body.String())
	}
}

func TestHealthAddressMustStayLoopbackOnPort8080(t *testing.T) {
	for _, address := range []string{"0.0.0.0:8080", ":8080", "127.0.0.1:9090", "localhost:8080"} {
		if err := ValidateHealthAddress(address); err == nil {
			t.Fatalf("ValidateHealthAddress(%q) unexpectedly passed", address)
		}
	}
	if err := ValidateHealthAddress("127.0.0.1:8080"); err != nil {
		t.Fatalf("ValidateHealthAddress(loopback) error = %v", err)
	}
}
