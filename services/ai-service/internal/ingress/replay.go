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
}

// NewReplayGuard starts a guard that rejects every request until quarantine ends.
func NewReplayGuard(started time.Time, keys []Key) *ReplayGuard {
	indexed := make(map[string]Key, len(keys))
	for _, key := range keys {
		indexed[key.ID] = key
	}
	return &ReplayGuard{
		readyAt: started.Add(Quarantine),
		keys:    indexed,
		seen:    make(map[string]time.Time),
	}
}

// Ready reports whether the restart quarantine has elapsed.
func (g *ReplayGuard) Ready(now time.Time) bool {
	if g == nil {
		return false
	}
	return !now.Before(g.readyAt)
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
		return Authenticated{}, ErrUnauthenticated
	}
	unixSeconds, err := strconv.ParseInt(timestampText, 10, 64)
	if err != nil || strconv.FormatInt(unixSeconds, 10) != timestampText {
		return Authenticated{}, ErrUnauthenticated
	}
	timestamp := time.Unix(unixSeconds, 0).UTC()
	if !timestamp.After(now.Add(-ReplayWindow)) || timestamp.After(now.Add(ClockSkew)) {
		return Authenticated{}, ErrUnauthenticated
	}
	key, ok := g.keys[keyID]
	if !ok || len(key.Secret) == 0 {
		return Authenticated{}, ErrUnauthenticated
	}
	if !signaturesMatch(key.Secret, timestampText, requestID, keyID, signature, body) {
		return Authenticated{}, ErrUnauthenticated
	}
	if err := bindingMatches(key, requestID, body); err != nil {
		return Authenticated{}, err
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
			Issuer   string `json:"issuer"`
			Audience string `json:"audience"`
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
		parsed.Identity.Audience != key.Audience {
		return ErrUnauthenticated
	}
	return nil
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
