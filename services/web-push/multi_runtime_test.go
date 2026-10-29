package webpush

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type runtimeBackend struct {
	claim  func(context.Context, ClaimRequest) (ClaimResponse, error)
	report func(context.Context, ReportRequest) (ReportResponse, error)
}

func (b runtimeBackend) Claim(ctx context.Context, r ClaimRequest) (ClaimResponse, error) {
	return b.claim(ctx, r)
}

func (b runtimeBackend) Report(ctx context.Context, r ReportRequest) (ReportResponse, error) {
	if b.report != nil {
		return b.report(ctx, r)
	}
	return reportResponse(r, "applied"), nil
}

func runtimeTestBinding(t *testing.T, id string, backend Backend, sender Sender) AppBinding {
	t.Helper()
	w := newFailureWorker(t, backend, sender, time.Now)
	w.sleep = sleepContext
	w.metrics = NewMetrics()
	return AppBinding{ID: id, Worker: w, Health: NewHealthState(false, w.metrics)}
}

func startTestRuntime(t *testing.T, rt *Runtime) (context.CancelFunc, <-chan struct{}) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		defer close(done)
		if err := rt.Run(ctx); !errors.Is(err, context.Canceled) {
			t.Errorf("runtime stopped with %v", err)
		}
	}()
	t.Cleanup(func() {
		cancel()
		select {
		case <-done:
		case <-time.After(3 * time.Second):
			t.Error("runtime did not join all workers after cancellation")
		}
	})
	return cancel, done
}

func awaitRuntime(t *testing.T, condition func() bool) {
	t.Helper()
	deadline := time.NewTimer(3 * time.Second)
	defer deadline.Stop()
	ticker := time.NewTicker(time.Millisecond)
	defer ticker.Stop()
	for !condition() {
		select {
		case <-ticker.C:
		case <-deadline.C:
			t.Fatal("runtime condition did not become true")
		}
	}
}

func runtimeRequest(handler http.Handler, path string) *httptest.ResponseRecorder {
	r := httptest.NewRecorder()
	handler.ServeHTTP(r, httptest.NewRequest(http.MethodGet, path, nil))
	return r
}

func TestRuntimeConcurrentAuthenticatedAppsKeepLocalIDsAndMetricsScoped(t *testing.T) {
	a := appTestConfig(t, "app-a", "", 1)
	b := appTestConfig(t, "app-b", "", 2)
	first, reportsA := appTestSource(t, a, uuidFor(2), a.VAPIDVersion)
	second, reportsB := appTestSource(t, b, uuidFor(4), b.VAPIDVersion)
	a.Origin, b.Origin = first.URL, second.URL
	bindings, err := NewAppBindings([]AppConfig{a, b}, first.Client())
	if err != nil {
		t.Fatal(err)
	}
	for i, cfg := range []AppConfig{a, b} {
		appTestWorker(t, bindings[i], cfg.VAPIDPublicKey)
	}
	rt, err := NewRuntime(bindings)
	if err != nil {
		t.Fatal(err)
	}
	cancel, done := startTestRuntime(t, rt)
	handler := rt.Handler()
	awaitRuntime(t, func() bool { return runtimeRequest(handler, "/readyz").Code == http.StatusOK })
	if reportsA.Load() != 1 || reportsB.Load() != 1 {
		t.Fatal("both independently authenticated sources did not receive their fenced reports")
	}
	metrics := runtimeRequest(handler, "/metrics").Body.String()
	for _, id := range []string{a.ID, b.ID} {
		if !strings.Contains(metrics, `web_push_deliveries_accepted_total{app_id="`+id+`"} 1`) {
			t.Fatalf("missing scoped provider acceptance for %s", id)
		}
	}
	types, samples := map[string]bool{}, map[string]bool{}
	for _, line := range strings.Split(strings.TrimSpace(metrics), "\n") {
		if strings.HasPrefix(line, "# TYPE ") {
			if types[line] {
				t.Fatal("duplicate Prometheus TYPE declaration")
			}
			types[line] = true
		} else {
			name := strings.Fields(line)[0]
			if samples[name] {
				t.Fatal("duplicate Prometheus sample")
			}
			samples[name] = true
		}
	}
	if len(types) != 8 || len(samples) != 18 {
		t.Fatalf("unexpected metrics vocabulary: types=%d samples=%d", len(types), len(samples))
	}
	for _, secret := range []string{a.HMACSecret, b.HMACSecret, a.VAPIDPublicKey, a.Origin, uuidFor(1)} {
		if strings.Contains(metrics, secret) {
			t.Fatal("request, credential or local ID leaked into metrics")
		}
	}
	cancel()
	<-done
	if runtimeRequest(handler, "/readyz").Code != http.StatusServiceUnavailable {
		t.Fatal("shutdown retained ready state")
	}
}

func TestRuntimeRequiredReadinessIncludesPausedStaleAndStoppedApps(t *testing.T) {
	a := runtimeTestBinding(t, "app-a", nil, nil)
	b := runtimeTestBinding(t, "app-b", nil, nil)
	rt, err := NewRuntime([]AppBinding{a, b})
	if err != nil {
		t.Fatal(err)
	}
	handler := rt.Handler()
	if runtimeRequest(handler, "/readyz").Code != http.StatusServiceUnavailable {
		t.Fatal("initial readiness was not fail closed")
	}
	a.Health.SetReady(true)
	b.Health.SetReady(true)
	if runtimeRequest(handler, "/readyz").Code != http.StatusOK {
		t.Fatal("healthy apps were not ready")
	}
	for _, state := range []string{"paused", "stale", "not_ready", "stopped"} {
		b.Health.SetPaused(state == "paused")
		b.Health.SetReady(state != "not_ready")
		if state == "stale" {
			b.Health.mu.Lock()
			b.Health.updated = time.Unix(0, 0)
			b.Health.mu.Unlock()
		}
		if state == "stopped" {
			b.Health.markStopped()
		}
		r := runtimeRequest(handler, "/readyz")
		var body struct {
			Ready bool              `json:"ready"`
			Apps  map[string]string `json:"apps"`
		}
		if err := json.Unmarshal(r.Body.Bytes(), &body); err != nil || r.Code != http.StatusServiceUnavailable || body.Ready || body.Apps[a.ID] != "ready" || body.Apps[b.ID] != state {
			t.Fatalf("aggregate hid required app state %s: %d %s", state, r.Code, r.Body.String())
		}
		if got := runtimeRequest(handler, "/readyz/app-b"); got.Code != http.StatusServiceUnavailable || got.Body.String() != state+"\n" {
			t.Fatalf("per-app readiness hid %s", state)
		}
		if runtimeRequest(handler, "/readyz/app-a").Code != http.StatusOK {
			t.Fatal("degraded app changed healthy app readiness")
		}
	}
	if runtimeRequest(handler, "/readyz/missing").Code != http.StatusNotFound {
		t.Fatal("unknown app was exposed")
	}
	s := NewHealthState(false, nil)
	s.SetReady(true)
	instant := s.updated
	if s.status(instant.Add(time.Minute)) != "ready" || s.status(instant.Add(time.Minute+time.Nanosecond)) != "stale" {
		t.Fatal("readiness freshness boundary changed")
	}
}

func TestRuntimeRejectsUnboundedOrAliasedBindingsAndRepeatedRun(t *testing.T) {
	a := runtimeTestBinding(t, "app-a", nil, nil)
	b := runtimeTestBinding(t, "app-b", nil, nil)
	for _, bindings := range [][]AppBinding{
		nil, make([]AppBinding, MaxRuntimeApps+1), {a, a}, {{ID: "app-a"}},
		{a, {ID: "app-b", Worker: a.Worker, Health: b.Health}},
		{a, {ID: "app-b", Worker: b.Worker, Health: a.Health}},
		{{ID: "bad/app", Worker: a.Worker, Health: a.Health}},
	} {
		if _, err := NewRuntime(bindings); err == nil {
			t.Fatal("accepted invalid or aliased runtime bindings")
		}
	}
	rt, err := NewRuntime([]AppBinding{a})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := rt.Run(ctx); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if err := rt.Run(ctx); err == nil {
		t.Fatal("runtime could start the same worker more than once")
	}
}
