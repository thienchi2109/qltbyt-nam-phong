package ingress

import (
	"encoding/json"
	"net/http"
	"strconv"
	"sync"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

const (
	ClockSkew     = 30 * time.Second
	ReplayWindow  = 120 * time.Second
	NonceCapacity = 4096
	Quarantine    = ReplayWindow + ClockSkew
)

// Key binds one signing secret to an issuer, audience, app, and capability.
// The app id is configuration, not a value compiled into this package.
type Key struct {
	ID           string
	Secret       []byte
	Issuer       string
	Audience     string
	AppID        string
	CapabilityID string
}

// ReplayGuard is an in-memory nonce map. It has no snapshot and stays
// unready for the full quarantine after process start.
type ReplayGuard struct {
	mu      sync.Mutex
	readyAt time.Time
	keys    map[string]Key
	seen    map[string]time.Time
	valid   bool
}

// NewReplayGuard starts a guard that rejects every request until quarantine ends.
func NewReplayGuard(started time.Time, keys []Key) *ReplayGuard {
	indexed := make(map[string]Key, len(keys))
	valid := len(keys) > 0
	for _, key := range keys {
		if key.ID == "" || key.ID != stringsTrim(key.ID) || len(key.Secret) == 0 ||
			key.Issuer == "" || key.Issuer != stringsTrim(key.Issuer) ||
			key.Audience == "" || key.Audience != stringsTrim(key.Audience) ||
			key.AppID == "" || key.AppID != stringsTrim(key.AppID) ||
			key.CapabilityID == "" || key.CapabilityID != stringsTrim(key.CapabilityID) {
			valid = false
			continue
		}
		if _, exists := indexed[key.ID]; exists {
			valid = false
			delete(indexed, key.ID)
			continue
		}
		indexed[key.ID] = key
	}
	return &ReplayGuard{
		readyAt: started.Add(Quarantine),
		keys:    indexed,
		seen:    make(map[string]time.Time),
		valid:   valid && len(indexed) > 0,
	}
}

// Ready reports whether the restart quarantine has elapsed.
func (g *ReplayGuard) Ready(now time.Time) bool {
	if g == nil {
		return false
	}
	return g.valid && !now.Before(g.readyAt)
}

// Authenticated is a request that passed signature checks and is not yet admitted.
type Authenticated struct {
	RequestID string
	Timestamp time.Time
	Key       Key
}

// Authenticate checks quarantine, signature, body digest, and key binding.
// It does not consume a nonce.
func (g *ReplayGuard) Authenticate(now time.Time, header http.Header, body []byte) (Authenticated, error) {
	if g == nil || !g.Ready(now) {
		return Authenticated{}, ErrNotReady
	}
	timestampText := stringsTrim(header.Get(HeaderTimestamp))
	requestID := stringsTrim(header.Get(HeaderRequestID))
	keyID := stringsTrim(header.Get(HeaderKeyID))
	signature := stringsTrim(header.Get(HeaderSignature))
	if requestID == "" || keyID == "" || signature == "" || len(body) == 0 {
		return Authenticated{}, authFailure("hmac.missing_header")
	}
	unixSeconds, err := strconv.ParseInt(timestampText, 10, 64)
	if err != nil || strconv.FormatInt(unixSeconds, 10) != timestampText {
		return Authenticated{}, authFailure("hmac.timestamp_invalid")
	}
	timestamp := time.Unix(unixSeconds, 0).UTC()
	if !timestamp.After(now.Add(-ReplayWindow)) || timestamp.After(now.Add(ClockSkew)) {
		return Authenticated{}, authFailure("hmac.timestamp_out_of_window")
	}
	key, ok := g.keys[keyID]
	if !ok || len(key.Secret) == 0 {
		return Authenticated{}, authFailure("hmac.key_mismatch")
	}
	if !signaturesMatch(key.Secret, timestampText, requestID, keyID, signature, body) {
		return Authenticated{}, authFailure("hmac.signature_mismatch")
	}
	if err := bindingMatches(key, requestID, body); err != nil {
		return Authenticated{}, authFailure("hmac.binding_mismatch")
	}
	return Authenticated{RequestID: requestID, Timestamp: timestamp, Key: key}, nil
}

// Admit records a live request id. A full map or a live duplicate is rejected.
// Expired ids are reclaimed. A live id is never evicted.
func (g *ReplayGuard) Admit(now time.Time, request Authenticated) error {
	if g == nil || !g.Ready(now) {
		return ErrNotReady
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	g.reclaim(now)
	if _, exists := g.seen[request.RequestID]; exists {
		return ErrReplay
	}
	if len(g.seen) >= NonceCapacity {
		return ErrCapacity
	}
	g.seen[request.RequestID] = request.Timestamp
	return nil
}

// Release removes a nonce when admission fails before provider work begins.
// It is intentionally narrow: callers may only release a request they just
// admitted after a bounded service gate rejected it.
func (g *ReplayGuard) Release(requestID string) {
	if g == nil || requestID == "" {
		return
	}
	g.mu.Lock()
	delete(g.seen, requestID)
	g.mu.Unlock()
}

// Contains reports whether a live nonce is still stored. It is for tests.
func (g *ReplayGuard) Contains(requestID string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	_, ok := g.seen[requestID]
	return ok
}

func (g *ReplayGuard) reclaim(now time.Time) {
	cutoff := now.Add(-ReplayWindow)
	for requestID, timestamp := range g.seen {
		if !timestamp.After(cutoff) {
			delete(g.seen, requestID)
		}
	}
}

func bindingMatches(key Key, requestID string, body []byte) error {
	var parsed struct {
		ProtocolVersion   string `json:"protocol_version"`
		AppID             string `json:"app_id"`
		CapabilityID      string `json:"capability_id"`
		CapabilityVersion string `json:"capability_version"`
		RequestID         string `json:"request_id"`
		Identity          struct {
			Issuer     string `json:"issuer"`
			Audience   string `json:"audience"`
			TrustedApp struct {
				AppID         string   `json:"app_id"`
				CapabilityIDs []string `json:"capability_ids"`
			} `json:"trusted_app"`
		} `json:"identity"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		return ErrUnauthenticated
	}
	if parsed.ProtocolVersion != protocol.ProtocolVersion ||
		parsed.CapabilityVersion == "" ||
		parsed.RequestID != requestID ||
		parsed.AppID == "" ||
		parsed.AppID != key.AppID ||
		parsed.CapabilityID == "" ||
		parsed.CapabilityID != key.CapabilityID ||
		parsed.Identity.Issuer == "" ||
		parsed.Identity.Issuer != key.Issuer ||
		parsed.Identity.Audience == "" ||
		parsed.Identity.Audience != key.Audience ||
		(parsed.Identity.TrustedApp.AppID != "" && parsed.Identity.TrustedApp.AppID != key.AppID) ||
		!capabilityClaimMatches(parsed.Identity.TrustedApp.CapabilityIDs, key.CapabilityID) {
		return ErrUnauthenticated
	}
	return nil
}

func capabilityClaimMatches(claims []string, capabilityID string) bool {
	if len(claims) == 0 {
		return true
	}
	for _, claim := range claims {
		if claim == capabilityID {
			return true
		}
	}
	return false
}

func stringsTrim(value string) string {
	start := 0
	end := len(value)
	for start < end && (value[start] == ' ' || value[start] == '\t' || value[start] == '\n' || value[start] == '\r') {
		start++
	}
	for end > start && (value[end-1] == ' ' || value[end-1] == '\t' || value[end-1] == '\n' || value[end-1] == '\r') {
		end--
	}
	return value[start:end]
}
