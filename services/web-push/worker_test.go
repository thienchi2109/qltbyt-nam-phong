package webpush

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestLoadVAPIDKeyDerivesStablePublicArtifact(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)

	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatalf("LoadVAPIDKey() error = %v", err)
	}
	if key.Version != "staging-20260910-01" {
		t.Fatalf("Version = %q", key.Version)
	}
	if key.PublicKey == "" || key.Fingerprint == "" || len(key.PublicKey) < 80 {
		t.Fatalf("derived artifact is incomplete: %+v", key)
	}
	if len(key.privateKey) != 32 || key.privateKey[31] != 1 {
		t.Fatalf("private key was not loaded as raw scalar")
	}
}

func TestWorkerDoesNotClaimOrSendWhenVAPIDArtifactMismatches(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	api := &fakeAPI{claim: ClaimResponse{Version: 1}}
	sender := &fakeSender{}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   "different-public-key",
		ExpectedFingerprint: key.Fingerprint,
	})

	err = worker.RunOnce(context.Background())
	if !errors.Is(err, ErrVAPIDMismatch) {
		t.Fatalf("RunOnce() error = %v, want ErrVAPIDMismatch", err)
	}
	if api.claimCalls != 0 || len(sender.sends) != 0 {
		t.Fatalf("mismatched VAPID key claimed=%d sends=%d", api.claimCalls, len(sender.sends))
	}
}

func TestWorkerClaimsSendsAndReportsEachDelivery(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	delivery := testDelivery()
	api := &fakeAPI{claim: ClaimResponse{
		Version:          1,
		ServerTime:       time.Now().UTC().Format(time.RFC3339),
		PollAfterSeconds: 5,
		Deliveries:       []Delivery{delivery},
	}}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Now:                 time.Now,
	})

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if api.claimCalls != 1 || len(sender.sends) != 1 || api.reportCalls != 1 {
		t.Fatalf("claim=%d sends=%d reports=%d", api.claimCalls, len(sender.sends), api.reportCalls)
	}
	if got := api.reports[0].Results[0].Outcome; got != "accepted" {
		t.Fatalf("reported outcome = %q, want accepted", got)
	}
}

func TestWorkerClampsProviderTTLToRemainingDeadline(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	delivery := testDelivery()
	delivery.LeaseExpiresAt = now.Add(45 * time.Second).Format(time.RFC3339)
	delivery.Deadline = now.Add(31 * time.Second).Format(time.RFC3339)
	delivery.TTLSeconds = 86400
	api := &fakeAPI{claim: ClaimResponse{Version: 1, ServerTime: now.Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: []Delivery{delivery}}}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Now:                 func() time.Time { return now },
	})

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if got := sender.sends[0].TTLSeconds; got >= delivery.TTLSeconds || got != 31 {
		t.Fatalf("provider TTL = %d, want 31", got)
	}
}

func TestWorkerUsesServerClockBeforeSending(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	delivery := testDelivery()
	delivery.LeaseExpiresAt = now.Add(15 * time.Second).Format(time.RFC3339)
	delivery.Deadline = now.Add(time.Minute).Format(time.RFC3339)
	api := &fakeAPI{claim: ClaimResponse{
		Version:          1,
		ServerTime:       now.Add(5 * time.Second).Format(time.RFC3339),
		PollAfterSeconds: 5,
		Deliveries:       []Delivery{delivery},
	}}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Now:                 func() time.Time { return now },
	})

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(sender.sends) != 0 || api.reportCalls != 1 || api.reports[0].Results[0].Outcome != "not_sent_lease_expired" {
		t.Fatalf("sends=%d reports=%d result=%+v", len(sender.sends), api.reportCalls, api.reports[0].Results)
	}
}

func TestWorkerGivesProviderTenSecondDeadlineWhenDeliveryAllowsIt(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 15, 12, 0, 0, 0, time.UTC)
	delivery := testDelivery()
	delivery.LeaseExpiresAt = now.Add(time.Minute).Format(time.RFC3339)
	delivery.Deadline = now.Add(time.Minute).Format(time.RFC3339)
	api := &fakeAPI{claim: ClaimResponse{Version: 1, ServerTime: now.Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: []Delivery{delivery}}}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Now:                 func() time.Time { return now },
	})
	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(sender.timeouts) != 1 || sender.timeouts[0] != providerTimeout {
		t.Fatalf("provider timeouts = %v, want [%v]", sender.timeouts, providerTimeout)
	}
}

func TestWorkerRequiresConfiguredPublicArtifact(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	api := &fakeAPI{}
	worker := NewWorker(WorkerConfig{API: api, Sender: &fakeSender{}, VAPID: key})
	if err := worker.RunOnce(context.Background()); !errors.Is(err, ErrWorkerNotReady) {
		t.Fatalf("RunOnce() error = %v, want ErrWorkerNotReady", err)
	}
	if api.claimCalls != 0 {
		t.Fatalf("claim calls = %d", api.claimCalls)
	}
}

func TestWorkerHonorsBackendRetryAfterOnTransportBackoff(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	retryAfter := 30
	api := &fakeAPI{claimErr: &APIError{Status: 429, RetryAfterSeconds: &retryAfter}}
	var delay time.Duration
	ctx, cancel := context.WithCancel(context.Background())
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              &fakeSender{},
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Sleep: func(_ context.Context, got time.Duration) error {
			delay = got
			cancel()
			return context.Canceled
		},
	})
	if err := worker.Run(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("Run() error = %v, want context.Canceled", err)
	}
	if delay != 30*time.Second {
		t.Fatalf("backoff delay = %v, want 30s", delay)
	}
}

func TestWorkerRetriesReportWithBoundedDelays(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	api := &fakeAPI{
		claim:      ClaimResponse{Version: 1, ServerTime: time.Now().UTC().Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: []Delivery{testDelivery()}},
		reportErrs: []error{errors.New("first"), errors.New("second")},
	}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	var delays []time.Duration
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Sleep:               func(_ context.Context, delay time.Duration) error { delays = append(delays, delay); return nil },
	})

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if api.reportCalls != 3 || len(delays) != 2 || delays[0] != time.Second || delays[1] != 2*time.Second {
		t.Fatalf("reportCalls=%d delays=%v", api.reportCalls, delays)
	}
}

func TestWorkerHonorsReportRetryAfter(t *testing.T) {
	key := testVAPIDKey(t)
	retryAfter := 3
	api := &fakeAPI{
		claim:      ClaimResponse{Version: 1, ServerTime: time.Now().UTC().Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: []Delivery{testDelivery()}},
		reportErrs: []error{&APIError{Status: 429, Code: "rate_limited", RetryAfterSeconds: &retryAfter}},
	}
	sender := &fakeSender{result: ProviderResult{Status: 201}}
	var delays []time.Duration
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
		Sleep:               func(_ context.Context, delay time.Duration) error { delays = append(delays, delay); return nil },
	})

	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(delays) != 1 || delays[0] != 3*time.Second {
		t.Fatalf("report retry delays = %v, want [3s]", delays)
	}
}

func TestWorkerRunStopsAfterCancellation(t *testing.T) {
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	path := writeVAPIDSecret(t, privateKey)
	key, err := LoadVAPIDKey(path, "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	block := make(chan struct{})
	started := make(chan struct{}, 1)
	api := &fakeAPI{claim: ClaimResponse{Version: 1, ServerTime: time.Now().UTC().Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: []Delivery{testDelivery()}}}
	sender := &fakeSender{started: started, block: block}
	worker := NewWorker(WorkerConfig{
		API:                 api,
		Sender:              sender,
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
	})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- worker.Run(ctx) }()
	select {
	case <-started:
		cancel()
	case <-time.After(time.Second):
		t.Fatal("worker did not start provider send")
	}
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("Run() error = %v, want context.Canceled", err)
		}
	case <-time.After(time.Second):
		t.Fatal("worker did not stop after cancellation")
	}
}
