package phase0proof

import (
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"
)

func TestHMACKeyRotationAndBoundedNonceCapacity(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).Add(hmacQuarantine)
	oldKey := testKey("old", "old-secret")
	newKey := testKey("new", "new-secret")
	guard := &replayGuard{
		readyAt: now,
		keys:    map[string]hmacKey{newKey.ID: newKey},
		seen:    make(map[string]time.Time),
	}
	retired := validRequest(now, oldKey, "retired")
	if err := guard.verify(now, retired); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("retired key result = %v", err)
	}
	rotated := validRequest(now, newKey, "rotated")
	if err := guard.verify(now, rotated); err != nil {
		t.Fatal(err)
	}

	for index := len(guard.seen); index < hmacNonceCapacity; index++ {
		request := validRequest(now, newKey, fmt.Sprintf("capacity-%d", index))
		if err := guard.verify(now, request); err != nil {
			t.Fatalf("capacity fill at %d: %v", index, err)
		}
	}
	fullRequest := validRequest(now, newKey, "capacity-full")
	if err := guard.verify(now, fullRequest); !errors.Is(err, errNonceCapacity) {
		t.Fatalf("capacity result = %v", err)
	}
	if _, ok := guard.seen["rotated"]; !ok {
		t.Fatal("bounded guard evicted a live nonce")
	}
}

func TestHMACRejectsMalformedFieldsAndWrongKeyBinding(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).Add(hmacQuarantine)
	key := testKey("key-1", "secret-1")
	guard := &replayGuard{
		readyAt: now,
		keys:    map[string]hmacKey{key.ID: key},
		seen:    make(map[string]time.Time),
	}
	base := validRequest(now, key, "valid")
	cases := []struct {
		name   string
		mutate func(*signedChatRequest)
	}{
		{name: "missing request id", mutate: func(request *signedChatRequest) { request.RequestID = "" }},
		{name: "missing key id", mutate: func(request *signedChatRequest) { request.KeyID = "" }},
		{name: "missing issuer", mutate: func(request *signedChatRequest) { request.Issuer = "" }},
		{name: "missing audience", mutate: func(request *signedChatRequest) { request.Audience = "" }},
		{name: "missing app", mutate: func(request *signedChatRequest) { request.AppID = "" }},
		{name: "missing capability", mutate: func(request *signedChatRequest) { request.Capability = "" }},
		{name: "missing body", mutate: func(request *signedChatRequest) { request.Body = nil }},
		{name: "missing signature", mutate: func(request *signedChatRequest) { request.Signature = "" }},
		{name: "malformed signature encoding", mutate: func(request *signedChatRequest) { request.Signature = "%%%" }},
		{name: "zero timestamp", mutate: func(request *signedChatRequest) { request.Timestamp = time.Time{} }},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			request := base
			test.mutate(&request)
			if err := guard.verify(now, request); !errors.Is(err, errInvalidHMAC) {
				t.Fatalf("malformed result = %v", err)
			}
		})
	}

	wrongKeyID := base
	wrongKeyID.RequestID = "wrong-key-id"
	wrongKeyID.KeyID = "other-key"
	if err := guard.verify(now, wrongKeyID); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("wrong key id result = %v", err)
	}
	otherKey := testKey("key-2", "secret-2")
	wrongSecret := validRequest(now, otherKey, "wrong-secret")
	wrongSecret.KeyID = key.ID
	if err := guard.verify(now, wrongSecret); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("wrong signing key result = %v", err)
	}
}

func TestHMACExpiredNonceReclaimedWithoutEvictingLiveNonce(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).Add(hmacQuarantine)
	key := testKey("key-1", "secret-1")
	seen := map[string]time.Time{
		"expired": now.Add(-hmacReplayWindow - time.Second),
	}
	for index := 1; index < hmacNonceCapacity; index++ {
		seen[fmt.Sprintf("live-%d", index)] = now
	}
	guard := &replayGuard{readyAt: now, keys: map[string]hmacKey{key.ID: key}, seen: seen}
	request := validRequest(now, key, "new")
	if err := guard.verify(now, request); err != nil {
		t.Fatal(err)
	}
	if _, ok := guard.seen["expired"]; ok {
		t.Fatal("expired nonce was not reclaimed")
	}
	if _, ok := guard.seen["live-1"]; !ok {
		t.Fatal("live nonce was evicted")
	}
}

func TestHMACExpiryBoundaryRetainsThenReclaimsNonce(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).Add(hmacQuarantine)
	key := testKey("key-1", "secret-1")
	seen := map[string]time.Time{"boundary": now.Add(-hmacReplayWindow).Add(time.Nanosecond)}
	for index := 1; index < hmacNonceCapacity; index++ {
		seen[fmt.Sprintf("live-%d", index)] = now
	}
	guard := &replayGuard{readyAt: now, keys: map[string]hmacKey{key.ID: key}, seen: seen}
	if err := guard.verify(now, validRequest(now, key, "at-boundary")); !errors.Is(err, errNonceCapacity) {
		t.Fatalf("still-valid nonce was reclaimed too early: %v", err)
	}
	if _, ok := guard.seen["boundary"]; !ok {
		t.Fatal("still-valid nonce was evicted")
	}
	if err := guard.verify(now.Add(2*time.Nanosecond), validRequest(now.Add(2*time.Nanosecond), key, "after-boundary")); err != nil {
		t.Fatalf("expired nonce was not reclaimed: %v", err)
	}
	if _, ok := guard.seen["boundary"]; ok {
		t.Fatal("expired nonce remained admitted")
	}
}

func TestHMACReplayGuardConcurrentCapacity(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).Add(hmacQuarantine)
	key := testKey("key-1", "secret-1")
	guard := &replayGuard{readyAt: now, keys: map[string]hmacKey{key.ID: key}, seen: make(map[string]time.Time)}
	const attempts = hmacNonceCapacity + 64
	results := make(chan error, attempts)
	var wait sync.WaitGroup
	for index := 0; index < attempts; index++ {
		wait.Add(1)
		go func(index int) {
			defer wait.Done()
			results <- guard.verify(now, validRequest(now, key, fmt.Sprintf("concurrent-%d", index)))
		}(index)
	}
	wait.Wait()
	close(results)

	accepted := 0
	capacityErrors := 0
	for err := range results {
		switch {
		case err == nil:
			accepted++
		case errors.Is(err, errNonceCapacity):
			capacityErrors++
		default:
			t.Fatalf("concurrent verification error = %v", err)
		}
	}
	if accepted != hmacNonceCapacity || capacityErrors != attempts-hmacNonceCapacity {
		t.Fatalf("concurrent capacity results accepted=%d capacityErrors=%d", accepted, capacityErrors)
	}
}
