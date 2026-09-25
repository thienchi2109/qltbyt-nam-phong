package phase0proof

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

const (
	hmacClockSkew     = 30 * time.Second
	hmacReplayWindow  = 120 * time.Second
	hmacNonceCapacity = 4096
	hmacQuarantine    = hmacReplayWindow + hmacClockSkew
)

type hmacKey struct {
	ID          string
	Secret      []byte
	Issuer      string
	Audience    string
	AllowedApps map[string]struct{}
	AllowedCaps map[string]struct{}
}

type signedChatRequest struct {
	Timestamp  time.Time
	RequestID  string
	KeyID      string
	Issuer     string
	Audience   string
	AppID      string
	Capability string
	Body       []byte
	Signature  string
}

type rawChatBody struct {
	ProtocolVersion   string `json:"protocol_version"`
	AppID             string `json:"app_id"`
	CapabilityID      string `json:"capability_id"`
	CapabilityVersion string `json:"capability_version"`
	RequestID         string `json:"request_id"`
	Identity          struct {
		Issuer   string `json:"issuer"`
		Audience string `json:"audience"`
	} `json:"identity"`
}

type replayGuard struct {
	mu      sync.Mutex // protects nonce admission and expiry reclamation
	readyAt time.Time
	keys    map[string]hmacKey
	seen    map[string]time.Time
}

var (
	errQuarantine    = errors.New("replay guard quarantine")
	errInvalidHMAC   = errors.New("invalid HMAC request")
	errReplay        = errors.New("request replay")
	errNonceCapacity = errors.New("nonce capacity exhausted")
)

func canonicalString(request signedChatRequest) string {
	digest := sha256.Sum256(request.Body)
	return strings.Join([]string{
		"ai-service-v1",
		"POST",
		"/v1/chat",
		fmt.Sprint(request.Timestamp.Unix()),
		request.RequestID,
		request.KeyID,
		hex.EncodeToString(digest[:]),
	}, "\n")
}

func signRequest(request signedChatRequest, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(canonicalString(request)))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func rawBodyMatchesRequest(request signedChatRequest) bool {
	var body rawChatBody
	if err := json.Unmarshal(request.Body, &body); err != nil {
		return false
	}
	return body.ProtocolVersion == "v1" &&
		body.AppID == request.AppID &&
		body.CapabilityID == request.Capability &&
		body.CapabilityVersion != "" &&
		body.RequestID == request.RequestID &&
		body.Identity.Issuer == request.Issuer &&
		body.Identity.Audience == request.Audience
}

func (g *replayGuard) verify(now time.Time, request signedChatRequest) error {
	if now.Before(g.readyAt) {
		return errQuarantine
	}
	if request.RequestID == "" || request.KeyID == "" || request.Issuer == "" || request.Audience == "" || request.AppID == "" || request.Capability == "" || len(request.Body) == 0 || request.Signature == "" {
		return errInvalidHMAC
	}
	if !rawBodyMatchesRequest(request) {
		return errInvalidHMAC
	}
	key, ok := g.keys[request.KeyID]
	if !ok || request.Issuer != key.Issuer || request.Audience != key.Audience {
		return errInvalidHMAC
	}
	if _, ok := key.AllowedApps[request.AppID]; !ok {
		return errInvalidHMAC
	}
	if _, ok := key.AllowedCaps[request.Capability]; !ok {
		return errInvalidHMAC
	}
	if !request.Timestamp.After(now.Add(-hmacReplayWindow)) || request.Timestamp.After(now.Add(hmacClockSkew)) {
		return errInvalidHMAC
	}
	expected := signRequest(request, key.Secret)
	if !hmac.Equal([]byte(expected), []byte(request.Signature)) {
		return errInvalidHMAC
	}

	g.mu.Lock()
	defer g.mu.Unlock()
	g.reclaim(now)
	if _, ok := g.seen[request.RequestID]; ok {
		return errReplay
	}
	if len(g.seen) >= hmacNonceCapacity {
		return errNonceCapacity
	}
	g.seen[request.RequestID] = request.Timestamp
	return nil
}

func (g *replayGuard) reclaim(now time.Time) {
	cutoff := now.Add(-hmacReplayWindow)
	for requestID, timestamp := range g.seen {
		if !timestamp.After(cutoff) {
			delete(g.seen, requestID)
		}
	}
}

func testKey(id string, secret string) hmacKey {
	return hmacKey{
		ID:          id,
		Secret:      []byte(secret),
		Issuer:      "nextjs-bff",
		Audience:    "ai-service-v1",
		AllowedApps: map[string]struct{}{"qltbyt": {}},
		AllowedCaps: map[string]struct{}{"assistant-chat": {}},
	}
}

func validRequest(now time.Time, key hmacKey, id string) signedChatRequest {
	request := signedChatRequest{
		Timestamp:  now,
		RequestID:  id,
		KeyID:      key.ID,
		Issuer:     key.Issuer,
		Audience:   key.Audience,
		AppID:      "qltbyt",
		Capability: "assistant-chat",
		Body: []byte(fmt.Sprintf(
			`{"protocol_version":"v1","app_id":"qltbyt","capability_id":"assistant-chat","capability_version":"v1","request_id":"%s","identity":{"issuer":"%s","audience":"%s"},"messages":[{"role":"user","content":"hello"}]}`,
			id,
			key.Issuer,
			key.Audience,
		)),
	}
	request.Signature = signRequest(request, key.Secret)
	return request
}

func TestHMACReplayProof(t *testing.T) {
	boot := time.Unix(1_700_000_000, 0)
	key1 := testKey("key-1", "secret-1")
	guard := &replayGuard{
		readyAt: boot.Add(hmacQuarantine),
		keys:    map[string]hmacKey{key1.ID: key1},
		seen:    make(map[string]time.Time),
	}
	request := validRequest(boot.Add(hmacQuarantine), key1, "request-1")

	if err := guard.verify(boot.Add(hmacQuarantine-time.Nanosecond), request); !errors.Is(err, errQuarantine) {
		t.Fatalf("pre-quarantine result = %v", err)
	}
	if err := guard.verify(boot.Add(hmacQuarantine), request); err != nil {
		t.Fatal(err)
	}
	if signature := request.Signature; strings.ContainsAny(signature, "+/=") || len(signature) != 43 {
		t.Fatalf("signature encoding = %q", signature)
	}
	if err := guard.verify(boot.Add(hmacQuarantine), request); !errors.Is(err, errReplay) {
		t.Fatalf("replay result = %v", err)
	}

	tampered := validRequest(boot.Add(hmacQuarantine), key1, "request-2")
	tampered.Body = []byte(`{"messages":[{"role":"user","content":"tampered"}]}`)
	if err := guard.verify(boot.Add(hmacQuarantine), tampered); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("tampered body result = %v", err)
	}

	identityTampered := validRequest(boot.Add(hmacQuarantine), key1, "request-3")
	identityTampered.Body = bytes.Replace(
		identityTampered.Body,
		[]byte(`"app_id":"qltbyt"`),
		[]byte(`"app_id":"other-app"`),
		1,
	)
	if err := guard.verify(boot.Add(hmacQuarantine), identityTampered); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("tampered raw identity result = %v", err)
	}

	identityMismatchKey := testKey("key-multi", "secret-multi")
	identityMismatchKey.AllowedApps["other-app"] = struct{}{}
	identityMismatchGuard := &replayGuard{
		readyAt: boot.Add(hmacQuarantine),
		keys:    map[string]hmacKey{identityMismatchKey.ID: identityMismatchKey},
		seen:    make(map[string]time.Time),
	}
	identityMismatch := validRequest(boot.Add(hmacQuarantine), identityMismatchKey, "request-4")
	identityMismatch.AppID = "other-app"
	if err := identityMismatchGuard.verify(boot.Add(hmacQuarantine), identityMismatch); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("external identity mismatch result = %v", err)
	}

	old := validRequest(boot.Add(hmacQuarantine-hmacReplayWindow-time.Second), key1, "request-old")
	old.Timestamp = boot.Add(hmacQuarantine - hmacReplayWindow - time.Second)
	old.Signature = signRequest(old, key1.Secret)
	if err := guard.verify(boot.Add(hmacQuarantine), old); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("old timestamp result = %v", err)
	}

	future := validRequest(boot.Add(hmacQuarantine+hmacClockSkew+time.Second), key1, "request-future")
	future.Signature = signRequest(future, key1.Secret)
	if err := guard.verify(boot.Add(hmacQuarantine), future); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("future timestamp result = %v", err)
	}
}

func TestHMACRestartQuarantineRejectsUntilGuardReady(t *testing.T) {
	restartedAt := time.Unix(1_700_000_000, 0)
	key := testKey("key-1", "secret-1")
	oldGuard := &replayGuard{
		readyAt: restartedAt,
		keys:    map[string]hmacKey{key.ID: key},
		seen:    make(map[string]time.Time),
	}
	priorRequest := validRequest(restartedAt.Add(hmacClockSkew), key, "before-restart")
	if err := oldGuard.verify(restartedAt.Add(hmacClockSkew), priorRequest); err != nil {
		t.Fatal(err)
	}
	guard := &replayGuard{
		readyAt: restartedAt.Add(hmacQuarantine),
		keys:    map[string]hmacKey{key.ID: key},
		seen:    make(map[string]time.Time),
	}
	if err := guard.verify(restartedAt.Add(hmacQuarantine-time.Nanosecond), priorRequest); !errors.Is(err, errQuarantine) {
		t.Fatalf("restart quarantine result = %v", err)
	}
	if err := guard.verify(restartedAt.Add(hmacQuarantine), priorRequest); !errors.Is(err, errInvalidHMAC) {
		t.Fatalf("pre-restart request after quarantine result = %v", err)
	}
	afterRestart := validRequest(restartedAt.Add(hmacQuarantine), key, "after-restart")
	if err := guard.verify(restartedAt.Add(hmacQuarantine), afterRestart); err != nil {
		t.Fatal(err)
	}
}
