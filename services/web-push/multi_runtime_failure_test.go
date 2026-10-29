package webpush

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestRuntimeStalledAuthFailingOrPausedAppCannotBlockHealthyApp(t *testing.T) {
	for _, mode := range []string{"timeout", "auth", "paused"} {
		t.Run(mode, func(t *testing.T) {
			a := appTestConfig(t, "app-a", "", 1)
			b := appTestConfig(t, "app-b", "", 2)
			var claims atomic.Int32
			timedOut := make(chan struct{})
			release := make(chan struct{})
			var once sync.Once
			broken := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.Copy(io.Discard, r.Body)
				claims.Add(1)
				if mode == "timeout" {
					select {
					case <-r.Context().Done():
						once.Do(func() { close(timedOut) })
					case <-release:
					}
					return
				}
				w.WriteHeader(http.StatusUnauthorized)
				_, _ = w.Write([]byte(`{"version":1,"error":{"code":"unauthorized"}}`))
			}))
			t.Cleanup(broken.Close)
			t.Cleanup(func() { close(release) })
			healthy, reports := appTestSource(t, b, uuidFor(4), b.VAPIDVersion)
			a.Origin, b.Origin = broken.URL, healthy.URL
			a.Paused = mode == "paused"
			client := healthy.Client()
			client.Timeout = 250 * time.Millisecond
			bindings, err := NewAppBindings([]AppConfig{a, b}, client)
			if err != nil {
				t.Fatal(err)
			}
			for index, cfg := range []AppConfig{a, b} {
				appTestWorker(t, bindings[index], cfg.VAPIDPublicKey)
			}
			rt, err := NewRuntime(bindings)
			if err != nil {
				t.Fatal(err)
			}
			cancel, done := startTestRuntime(t, rt)
			handler := rt.Handler()
			awaitRuntime(t, func() bool { return runtimeRequest(handler, "/readyz/app-b").Code == http.StatusOK })
			if reports.Load() != 1 {
				t.Fatal("healthy app did not finish delivery/report")
			}
			want := "not_ready"
			switch mode {
			case "auth":
				want = "stopped"
			case "paused":
				want = "paused"
			case "timeout":
				select {
				case <-timedOut:
				case <-time.After(2 * time.Second):
					t.Fatal("stalled source was not canceled by client timeout")
				}
			}
			awaitRuntime(t, func() bool { return runtimeRequest(handler, "/readyz/app-a").Body.String() == want+"\n" })
			if runtimeRequest(handler, "/readyz").Code != http.StatusServiceUnavailable {
				t.Fatal("healthy app hid required app degradation")
			}
			if mode == "paused" && claims.Load() != 0 {
				t.Fatal("paused app polled its source")
			}
			select {
			case <-done:
				t.Fatal("one app failure stopped the runtime")
			default:
			}
			cancel()
			<-done
		})
	}
}

func TestRuntimeReservesCapacityForAllSixteenAppsAndJoinsCanceledSends(t *testing.T) {
	entered := make(chan struct{}, MaxRuntimeApps*claimLimit)
	var claims, reports, active, peak atomic.Int32
	sender := &scriptedSender{sendFn: func(ctx context.Context, _ Delivery, _ time.Duration) (ProviderResult, error) {
		now := active.Add(1)
		for prior := peak.Load(); now > prior && !peak.CompareAndSwap(prior, now); prior = peak.Load() {
		}
		defer active.Add(-1)
		entered <- struct{}{}
		<-ctx.Done()
		return ProviderResult{Status: 201}, nil // A late nil error must not count as accepted.
	}}
	bindings := make([]AppBinding, MaxRuntimeApps)
	for i := range bindings {
		backend := runtimeBackend{
			claim: func(_ context.Context, request ClaimRequest) (ClaimResponse, error) {
				claims.Add(1)
				if request.Limit != claimLimit {
					t.Errorf("claim limit=%d; want %d", request.Limit, claimLimit)
				}
				now := time.Now().UTC()
				deliveries := make([]Delivery, claimLimit)
				for j := range deliveries {
					deliveries[j] = deliveryAt(now, j+1)
				}
				return claimResponseAt(now, deliveries), nil
			},
			report: func(_ context.Context, request ReportRequest) (ReportResponse, error) {
				reports.Add(1)
				return reportResponse(request, "applied"), nil
			},
		}
		bindings[i] = runtimeTestBinding(t, "app-"+string(rune('a'+i)), backend, sender)
	}
	rt, err := NewRuntime(bindings)
	if err != nil {
		t.Fatal(err)
	}
	cancel, done := startTestRuntime(t, rt)
	for i := 0; i < MaxRuntimeApps*claimLimit; i++ {
		select {
		case <-entered:
		case <-time.After(3 * time.Second):
			t.Fatal("an app did not receive its reserved send capacity")
		}
	}
	if claims.Load() != MaxRuntimeApps || peak.Load() != MaxRuntimeApps*claimLimit || reports.Load() != 0 {
		t.Fatalf("unbounded/prefetched work: claims=%d peak=%d reports=%d", claims.Load(), peak.Load(), reports.Load())
	}
	cancel()
	<-done
	if active.Load() != 0 || reports.Load() != 0 {
		t.Fatal("shutdown returned with active sends or reported canceled sends")
	}
	for _, b := range bindings {
		s := b.Worker.metrics.snapshot()
		if s.accepted != 0 || s.cancelled != claimLimit || b.Health.status(time.Now()) != "stopped" {
			t.Fatalf("shutdown left false acceptance/readiness: app=%s metrics=%+v", b.ID, s)
		}
	}
}

func TestRuntimeFullBacklogCannotStarveAnotherAppsPollingOrSending(t *testing.T) {
	blocked := make(chan struct{}, claimLimit)
	healthyReports := make(chan struct{}, 2)
	fullBatch := func(context.Context, ClaimRequest) (ClaimResponse, error) {
		now := time.Now().UTC()
		deliveries := make([]Delivery, claimLimit)
		for i := range deliveries {
			deliveries[i] = deliveryAt(now, i+1)
		}
		return claimResponseAt(now, deliveries), nil
	}
	stalledSender := &scriptedSender{sendFn: func(ctx context.Context, _ Delivery, _ time.Duration) (ProviderResult, error) {
		blocked <- struct{}{}
		<-ctx.Done()
		return ProviderResult{}, ctx.Err()
	}}
	healthySender := &scriptedSender{sendFn: func(context.Context, Delivery, time.Duration) (ProviderResult, error) {
		return ProviderResult{Status: 201}, nil
	}}
	a := runtimeTestBinding(t, "app-a", runtimeBackend{claim: fullBatch}, stalledSender)
	b := runtimeTestBinding(t, "app-b", runtimeBackend{
		claim: func(ctx context.Context, request ClaimRequest) (ClaimResponse, error) {
			// Hold the healthy app's first claim until the other fills all five slots.
			for len(blocked) < claimLimit {
				if err := sleepContext(ctx, time.Millisecond); err != nil {
					return ClaimResponse{}, err
				}
			}
			return fullBatch(ctx, request)
		},
		report: func(_ context.Context, request ReportRequest) (ReportResponse, error) {
			select {
			case healthyReports <- struct{}{}:
			default:
			}
			return reportResponse(request, "applied"), nil
		},
	}, healthySender)
	rt, err := NewRuntime([]AppBinding{a, b})
	if err != nil {
		t.Fatal(err)
	}
	cancel, done := startTestRuntime(t, rt)
	for i := 0; i < 2; i++ {
		select {
		case <-healthyReports:
		case <-time.After(3 * time.Second):
			t.Fatal("full stalled batch prevented healthy app from completing multiple batches")
		}
	}
	cancel()
	<-done
}

func TestRuntimeAllTerminalWorkersRemainObservableUntilShutdown(t *testing.T) {
	b := runtimeTestBinding(t, "app-a", runtimeBackend{claim: func(context.Context, ClaimRequest) (ClaimResponse, error) {
		return ClaimResponse{}, &BackendError{Retryable: false}
	}}, &fakeSender{})
	rt, err := NewRuntime([]AppBinding{b})
	if err != nil {
		t.Fatal(err)
	}
	_, done := startTestRuntime(t, rt)
	awaitRuntime(t, func() bool { return b.Health.status(time.Now()) == "stopped" })
	if runtimeRequest(rt.Handler(), "/healthz").Code != http.StatusOK || runtimeRequest(rt.Handler(), "/readyz").Code != http.StatusServiceUnavailable {
		t.Fatal("all stopped workers were not observable as live but unready")
	}
	select {
	case <-done:
		t.Fatal("runtime exited before shutdown")
	default:
	}
}
