package ingress

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

func TestAdmissionStopRejectsAndCancelsActiveRequests(t *testing.T) {
	admission := NewAdmission(1)
	ctx, release, ok := admission.Acquire(context.Background())
	if !ok {
		t.Fatal("first request was not admitted")
	}
	if admission.Active() != 1 {
		t.Fatalf("active = %d, want 1", admission.Active())
	}

	admission.Stop()
	if admission.Ready() {
		t.Fatal("stopped admission remained ready")
	}
	if _, _, ok := admission.Acquire(context.Background()); ok {
		t.Fatal("stopped admission accepted a new request")
	}
	drainCtx, drainCancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer drainCancel()
	drained := make(chan error, 1)
	go func() { drained <- admission.Drain(drainCtx) }()
	select {
	case <-ctx.Done():
	case <-time.After(time.Second):
		t.Fatal("drain did not cancel the active request")
	}

	release()
	if err := <-drained; err == nil {
		t.Fatal("drain unexpectedly completed without a grace timeout")
	}
	if admission.Active() != 0 {
		t.Fatalf("active after drain = %d", admission.Active())
	}
}

func TestHandlerReadinessTurnsFalseBeforeDrain(t *testing.T) {
	h := &Handler{Admission: NewAdmission(1)}
	ready := httptest.NewRecorder()
	h.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if ready.Code != http.StatusServiceUnavailable || !strings.Contains(ready.Body.String(), "not_ready") {
		t.Fatalf("initial readiness = %d %s", ready.Code, ready.Body.String())
	}

	admissionCtx, release, ok := h.Admission.Acquire(context.Background())
	if !ok {
		t.Fatal("request was not admitted")
	}
	defer release()
	if admissionCtx == nil {
		t.Fatal("admission returned nil context")
	}
	h.Admission.Stop()
	ready = httptest.NewRecorder()
	h.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if ready.Code != http.StatusServiceUnavailable || !strings.Contains(ready.Body.String(), "not_ready") {
		t.Fatalf("draining readiness = %d %s", ready.Code, ready.Body.String())
	}
}

func TestSanitizeObservationExcludesSensitiveContent(t *testing.T) {
	observation := SanitizeObservation(Observation{
		RequestID:           "request-123",
		AppID:               "app-one",
		CapabilityID:        "assistant",
		Provider:            "google",
		Model:               "gemini-3.5-flash-lite",
		Outcome:             "completed",
		UsageClassification: "known-positive",
		Latency:             150 * time.Millisecond,
	})
	for _, value := range []string{observation.RequestID, observation.AppID, observation.CapabilityID, observation.Provider, observation.Model, observation.Outcome, observation.UsageClassification} {
		if strings.Contains(value, "secret") || strings.Contains(value, "SELECT") {
			t.Fatalf("observation leaked sensitive value: %q", value)
		}
	}
	redacted := SanitizeObservation(Observation{RequestID: "api_key=secret", Model: "SELECT * FROM users"})
	if redacted.RequestID != "redacted" || redacted.Model != "redacted" {
		t.Fatalf("sensitive labels were not redacted: %+v", redacted)
	}
}

func TestHandlerObserverReceivesRedactedRuntimeFields(t *testing.T) {
	observer := &captureObserver{}
	h := &Handler{
		Metrics: observer,
	}
	h.observe(protocol.Request{RequestID: "request-123", AppID: "app-one", CapabilityID: "assistant"}, protocol.ProviderMetadata{Provider: "google", Model: "gemini-3.5-flash-lite", Outcome: "completed"}, "completed", "known-positive", time.Second)
	if len(observer.events) != 1 {
		t.Fatalf("observations = %d, want 1", len(observer.events))
	}
	if observer.events[0].RequestID != "request-123" || observer.events[0].Provider != "google" {
		t.Fatalf("observation = %+v", observer.events[0])
	}
}

func TestLifecycleValidatesGraceAndIncludesCleanup(t *testing.T) {
	if _, err := NewLifecycle(NewAdmission(1), protocol.DrainGraceMin-time.Second, 5*time.Second); err == nil {
		t.Fatal("accepted drain grace below the contract minimum")
	}
	lifecycle, err := NewLifecycle(NewAdmission(1), protocol.DrainGraceMin, 5*time.Second)
	if err != nil {
		t.Fatalf("new lifecycle = %v", err)
	}
	if lifecycle.StopTimeout() != 65*time.Second {
		t.Fatalf("stop timeout = %s, want 65s", lifecycle.StopTimeout())
	}
	if _, err := NewLifecycle(NewAdmission(1), protocol.DrainGraceMax+time.Second, 5*time.Second); err == nil {
		t.Fatal("accepted drain grace above the contract maximum")
	}
}

func TestLifecycleIdleDrainRunsCleanupWithoutWaitingForGrace(t *testing.T) {
	lifecycle, err := NewLifecycle(NewAdmission(1), protocol.DrainGraceMin, time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	cleaned := make(chan struct{}, 1)
	lifecycle.CleanupFn = func(context.Context) error {
		cleaned <- struct{}{}
		return nil
	}
	started := time.Now()
	if err := lifecycle.Drain(context.Background()); err != nil {
		t.Fatalf("idle drain = %v", err)
	}
	if time.Since(started) >= protocol.DrainGraceMin {
		t.Fatal("idle drain waited for the full maximum grace")
	}
	select {
	case <-cleaned:
	default:
		t.Fatal("bounded cleanup did not run")
	}
}

func TestLifecycleDrainCancelsRemainingWorkBeforeCleanupBudgetEnds(t *testing.T) {
	admission := NewAdmission(1)
	requestCtx, release, ok := admission.Acquire(context.Background())
	if !ok {
		t.Fatal("request was not admitted")
	}
	lifecycle, err := NewLifecycle(admission, protocol.DrainGraceMin, 100*time.Millisecond)
	if err != nil {
		t.Fatal(err)
	}
	// Keep the production constructor bounded while making this regression fast.
	lifecycle.Grace = 10 * time.Millisecond
	cleaned := make(chan struct{}, 1)
	lifecycle.CleanupFn = func(context.Context) error {
		cleaned <- struct{}{}
		return nil
	}
	go func() {
		<-requestCtx.Done()
		release()
	}()
	if err := lifecycle.Drain(context.Background()); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("drain error = %v, want grace deadline", err)
	}
	if admission.Active() != 0 {
		t.Fatalf("active after drain = %d", admission.Active())
	}
	select {
	case <-cleaned:
	default:
		t.Fatal("cleanup did not run")
	}
}

func TestConfigReadinessFailsClosedWithoutModelCall(t *testing.T) {
	h := &Handler{ConfigReady: func() bool { return false }}
	response := httptest.NewRecorder()
	h.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable || !strings.Contains(response.Body.String(), "not_ready") {
		t.Fatalf("config readiness = %d %s", response.Code, response.Body.String())
	}
	health := httptest.NewRecorder()
	h.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if health.Code != http.StatusOK || !strings.Contains(health.Body.String(), `"status":"ok"`) {
		t.Fatalf("health probe = %d %s", health.Code, health.Body.String())
	}
}

type captureObserver struct {
	events []Observation
}

func (c *captureObserver) Record(string, string) {}

func (c *captureObserver) Observe(observation Observation) {
	c.events = append(c.events, observation)
}
