package webpush

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"
)

func TestSecondAppSourceRechecksEligibilityAndOwnershipBeforeClaim(t *testing.T) {
	for _, rule := range []string{"revoked", "ineligible", "different-owner"} {
		t.Run(rule, func(t *testing.T) {
			binding, source := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user"}`)
			sender := secondAppWorker(t, binding, source)
			source.mu.Lock()
			switch rule {
			case "revoked":
				source.state.subscription.active = false
			case "ineligible":
				source.state.subscription.eligible = false
			case "different-owner":
				source.state.subscription.userID = "another-local-user"
			}
			source.mu.Unlock()
			if err := binding.Worker.RunOnce(context.Background()); err != nil {
				t.Fatal(err)
			}
			if len(sender.sends) != 0 || source.snapshot().job.attempt != 0 || len(source.snapshot().reports) != 0 {
				t.Fatal("source claimed an unauthorized subscription")
			}
			source.mu.Lock()
			source.state.subscription = secondAppSubscription{userID: "same-local-user", revision: "1", active: true, eligible: true}
			source.mu.Unlock()
			if err := binding.Worker.RunOnce(context.Background()); err != nil || len(sender.sends) != 1 || source.snapshot().applyCount != 1 {
				t.Fatalf("authorized owner did not receive own queued notification: %v", err)
			}
		})
	}
}

func TestSecondAppSourceEndpointGoneFencesRenewedRevision(t *testing.T) {
	binding, source := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user"}`)
	sender := secondAppWorker(t, binding, source)
	sender.onSend = func(_ context.Context, delivery Delivery) (ProviderResult, error) {
		if delivery.Attempt == 1 {
			// The browser renews while this attempt is in flight.
			source.mu.Lock()
			source.state.subscription.revision = "2"
			source.mu.Unlock()
		}
		return ProviderResult{Status: http.StatusGone}, nil
	}
	if err := binding.Worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	state := source.snapshot()
	if !state.subscription.active || state.applyCount != 0 || state.results[0] != "stale" {
		t.Fatalf("old endpoint_gone revoked renewed subscription: %+v", state)
	}
	source.mu.Lock()
	source.state.now = state.job.lease.Add(time.Second)
	source.mu.Unlock()
	if err := binding.Worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	state = source.snapshot()
	if state.subscription.active || !state.job.done || state.applyCount != 1 ||
		state.reports[1].SubscriptionRevision != "2" || state.results[1] != "applied" {
		t.Fatalf("current endpoint_gone did not revoke its own revision: %+v", state)
	}
	if err := binding.Worker.RunOnce(context.Background()); err != nil || len(sender.sends) != 2 {
		t.Fatalf("revoked source sent again: %v, sends=%d", err, len(sender.sends))
	}
}

func TestSecondAppRevocationAfterClaimCannotRecallProviderAcceptance(t *testing.T) {
	binding, source := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user"}`)
	sender := secondAppWorker(t, binding, source)
	sender.onSend = func(context.Context, Delivery) (ProviderResult, error) {
		source.mu.Lock()
		source.state.subscription.active, source.state.subscription.eligible = false, false
		source.mu.Unlock()
		return ProviderResult{Status: http.StatusCreated}, nil
	}
	if err := binding.Worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	state := source.snapshot()
	if len(sender.sends) != 1 || !state.job.done || state.reports[0].Outcome != "accepted" || state.subscription.active {
		t.Fatalf("post-claim revocation boundary changed: %+v", state)
	}
}

func TestSecondAppReportCannotRevokeChangedOwner(t *testing.T) {
	binding, source := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user"}`)
	sender := secondAppWorker(t, binding, source)
	sender.onSend = func(context.Context, Delivery) (ProviderResult, error) {
		source.mu.Lock()
		source.state.subscription.userID = "another-local-user"
		source.mu.Unlock()
		return ProviderResult{Status: http.StatusGone}, nil
	}
	if err := binding.Worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	state := source.snapshot()
	if !state.subscription.active || state.applyCount != 0 || state.results[0] != "stale" {
		t.Fatalf("report revoked a different owner's subscription: %+v", state)
	}
}

func TestSecondAppCrashAfterProviderAcceptReclaimsWithNewFence(t *testing.T) {
	binding, source := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready","recipient":"same-local-user"}`)
	sender := secondAppWorker(t, binding, source)
	blocked := make(chan struct{}, 1)
	source.blockReport = blocked
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- binding.Worker.RunOnce(ctx) }()
	awaitRuntime(t, func() bool { return len(blocked) == 1 })
	// Sender returned 201 and Worker recorded accept before HTTP report stalled.
	if binding.Worker.metrics.snapshot().accepted != 1 || len(source.snapshot().reports) != 0 {
		t.Fatal("crash window did not follow provider acceptance before persistence")
	}
	cancel()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled worker = %v", err)
	}
	state := source.snapshot()
	if state.job.done || state.applyCount != 0 || len(sender.sends) != 1 {
		t.Fatalf("unreported attempt unexpectedly finalized: %+v", state)
	}
	source.mu.Lock()
	source.blockReport = nil
	source.mu.Unlock()
	bindings, err := NewAppBindings([]AppConfig{source.cfg}, binding.Worker.api.(*HTTPBackend).client)
	if err != nil {
		t.Fatal(err)
	}
	restarted := bindings[0]
	restarted.Worker.now = source.clock
	secondSender := secondAppWorker(t, restarted, source)
	if err := restarted.Worker.RunOnce(context.Background()); err != nil || len(secondSender.sends) != 0 {
		t.Fatalf("unexpired lease was reclaimed: %v", err)
	}
	source.mu.Lock()
	source.state.now = state.job.lease.Add(time.Second)
	source.mu.Unlock()
	status := http.StatusGone
	oldReport := ReportRequest{Results: []ReportItem{reportItem(sender.sends[0], "endpoint_gone", &status, nil)}}
	response, err := restarted.Worker.api.Report(context.Background(), oldReport)
	if err != nil || response.Results[0].Result != "stale" || !source.snapshot().subscription.active {
		t.Fatalf("expired lease still mutated subscription: %+v, %v", response, err)
	}
	secondSender.onSend = func(_ context.Context, delivery Delivery) (ProviderResult, error) {
		if delivery.AttemptToken == state.job.token || delivery.Attempt != 2 {
			t.Error("reclaim reused an old attempt fence")
		}
		response, err := restarted.Worker.api.Report(context.Background(), oldReport)
		if err != nil || response.Results[0].Result != "stale" || !source.snapshot().subscription.active {
			t.Errorf("old attempt finalized/revoked new lease: %+v, %v", response, err)
		}
		return ProviderResult{Status: http.StatusCreated}, nil
	}
	if err := restarted.Worker.RunOnce(context.Background()); err != nil {
		t.Fatal(err)
	}
	state = source.snapshot()
	if len(secondSender.sends) != 1 || !state.job.done || state.applyCount != 1 || state.results[len(state.results)-1] != "applied" {
		t.Fatalf("reclaim did not complete with a possible duplicate provider send: %+v", state)
	}
}
