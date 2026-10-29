package webpush

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"reflect"
	"sync"
	"testing"
	"time"
)

type secondAppSender struct {
	t      *testing.T
	source *secondAppSource
	mu     sync.Mutex
	sends  []Delivery
	onSend func(context.Context, Delivery) (ProviderResult, error)
}

func (s *secondAppSender) Send(ctx context.Context, delivery Delivery, key VAPIDKey, _ time.Duration) (ProviderResult, error) {
	s.mu.Lock()
	s.sends = append(s.sends, delivery)
	s.mu.Unlock()
	payload, err := base64.StdEncoding.DecodeString(delivery.PayloadBase64)
	if err != nil || string(payload) != s.source.snapshot().job.payload || key.PublicKey != s.source.cfg.VAPIDPublicKey ||
		delivery.Endpoint != "https://push.example.test/"+s.source.cfg.ID {
		s.t.Error("provider received another source's content, endpoint or VAPID key")
	}
	if s.onSend != nil {
		return s.onSend(ctx, delivery)
	}
	return ProviderResult{Status: http.StatusCreated}, nil
}

func secondAppWorker(t *testing.T, binding AppBinding, source *secondAppSource) *secondAppSender {
	t.Helper()
	sender := &secondAppSender{t: t, source: source}
	binding.Worker.sender = sender
	return sender
}

func TestSecondAppRuntimeIndependentSources(t *testing.T) {
	first, a := secondAppBinding(t, "equipment-fixture", 1, `{"kind":"equipment-due","recipient":"same-local-user","text":"Inspect pump"}`)
	second, b := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user","text":"Result R42 ready"}`)
	started, release := make(chan struct{}, 2), make(chan struct{})
	for _, pair := range []struct {
		binding AppBinding
		source  *secondAppSource
	}{{first, a}, {second, b}} {
		sender := secondAppWorker(t, pair.binding, pair.source)
		sender.onSend = func(ctx context.Context, _ Delivery) (ProviderResult, error) {
			started <- struct{}{}
			select {
			case <-release:
				return ProviderResult{Status: http.StatusCreated}, nil
			case <-ctx.Done():
				return ProviderResult{}, ctx.Err()
			}
		}
	}
	rt, err := NewRuntime([]AppBinding{first, second})
	if err != nil {
		t.Fatal(err)
	}
	cancel, done := startTestRuntime(t, rt)
	awaitRuntime(t, func() bool { return len(started) == 2 }) // Both provider calls are in flight together.
	close(release)
	awaitRuntime(t, func() bool { return a.snapshot().job.done && b.snapshot().job.done })
	cancel()
	<-done
	for _, source := range []*secondAppSource{a, b} {
		state := source.snapshot()
		if state.subscription.userID != "same-local-user" || state.job.userID != state.subscription.userID ||
			len(state.reports) != 1 || state.applyCount != 1 || state.reports[0].DeliveryID != uuidFor(1) ||
			state.reports[0].AttemptToken != uuidFor(source.seed+1) || state.results[0] != "applied" {
			t.Fatalf("source ownership/report crossed binding: %+v", state)
		}
	}
	// The two sources intentionally even share key IDs: the secret binds ownership.
	wrong, err := NewHTTPBackend(b.cfg.Origin, a.cfg.HMACKeyID, a.cfg.HMACSecret, second.Worker.api.(*HTTPBackend).client)
	if err != nil {
		t.Fatal(err)
	}
	_, err = wrong.Claim(context.Background(), ClaimRequest{WorkerID: "same-local-worker", Limit: 1, VAPIDKeyVersion: b.cfg.VAPIDVersion, VAPIDFingerprint: b.cfg.VAPIDFingerprint})
	var backendErr *BackendError
	if !errors.As(err, &backendErr) || backendErr.Retryable {
		t.Fatalf("other source credential was not rejected terminally: %v", err)
	}
	status := http.StatusGone
	foreign := ReportRequest{Results: []ReportItem{reportItem(Delivery{DeliveryID: uuidFor(1), AttemptToken: a.snapshot().job.token, SubscriptionRevision: "1"}, "endpoint_gone", &status, nil)}}
	response, err := second.Worker.api.Report(context.Background(), foreign)
	if err != nil || response.Results[0].Result != "stale" || !b.snapshot().subscription.active || b.snapshot().applyCount != 1 {
		t.Fatalf("foreign attempt mutated other source: %+v, %v", response, err)
	}
}

func TestSecondAppSourceSchedulesRetryAndDeduplicatesLostReport(t *testing.T) {
	binding, source := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user","result":"R42"}`)
	sender := secondAppWorker(t, binding, source)
	worker := binding.Worker
	var sleeps []time.Duration
	worker.sleep = func(_ context.Context, delay time.Duration) error { sleeps = append(sleeps, delay); return nil }
	retryAfter := 12
	sender.onSend = func(_ context.Context, delivery Delivery) (ProviderResult, error) {
		if delivery.Attempt == 1 {
			return ProviderResult{Status: http.StatusTooManyRequests, RetryAfterSeconds: &retryAfter}, nil
		}
		return ProviderResult{Status: http.StatusCreated}, nil
	}
	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	first := source.snapshot()
	if first.job.done || first.applyCount != 1 || first.reports[0].Outcome != "transient" || !first.job.due.Equal(first.now.Add(12*time.Second)) {
		t.Fatalf("source did not schedule provider retry: %+v", first)
	}
	if err := worker.RunOnce(context.Background()); err != nil || len(sender.sends) != 1 {
		t.Fatalf("retried before source due time: %v, sends=%d", err, len(sender.sends))
	}
	source.mu.Lock()
	source.state.now = first.job.due
	source.state.loseNextReport = true
	source.mu.Unlock()
	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	state := source.snapshot()
	if !state.job.done || state.job.attempt != 2 || state.job.token == first.job.token || state.applyCount != 2 || len(sender.sends) != 2 ||
		!reflect.DeepEqual(state.results, []string{"applied", "applied", "duplicate"}) ||
		!reflect.DeepEqual(state.reports[1], state.reports[2]) || !reflect.DeepEqual(sleeps, []time.Duration{time.Second}) {
		t.Fatalf("lost report was not retried idempotently: %+v, sends=%d, sleeps=%v", state, len(sender.sends), sleeps)
	}
	// Idempotency binds every stored result field, not just the token.
	status := http.StatusCreated
	original := reportItem(sender.sends[1], "accepted", &status, nil)
	for _, field := range []string{"outcome", "status", "retry-after"} {
		changed := original
		switch field {
		case "outcome":
			changed.Outcome = "endpoint_gone"
		case "status":
			otherStatus := http.StatusAccepted
			changed.ProviderStatus = &otherStatus
		case "retry-after":
			otherDelay := 1
			changed.RetryAfterSeconds = &otherDelay
		}
		response, err := worker.api.Report(context.Background(), ReportRequest{Results: []ReportItem{changed}})
		if err != nil || response.Results[0].Result != "stale" || !source.snapshot().subscription.active {
			t.Fatalf("conflicting %s replay mutated subscription: %+v, %v", field, response, err)
		}
	}
	source.mu.Lock()
	source.state.now = state.job.lease.Add(time.Second)
	source.state.subscription.revision = "2"
	source.mu.Unlock()
	response, err := worker.api.Report(context.Background(), ReportRequest{Results: []ReportItem{original}})
	if err != nil || response.Results[0].Result != "duplicate" || source.snapshot().applyCount != 2 || source.snapshot().subscription.revision != "2" {
		t.Fatalf("late committed replay lost idempotency: %+v, %v", response, err)
	}
}
