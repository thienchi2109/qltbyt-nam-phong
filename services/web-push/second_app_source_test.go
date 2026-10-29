package webpush

import (
	"crypto/hmac"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync"
	"testing"
	"time"
)

// This source owns one result notification and one subscription. Only the v1
// transport DTOs are reused; no QLTBYT queue, role or repair payload is involved.
// ponytail: one in-memory job proves the seam; a real app supplies durable storage.
type secondAppSource struct {
	mu     sync.Mutex
	cfg    AppConfig
	secret []byte
	seed   int
	state  secondAppState
	// Simulate a process disappearing after provider accept, before persistence.
	blockReport chan struct{}
}

type secondAppSubscription struct {
	userID, revision string
	active, eligible bool
}

type secondAppJob struct {
	userID, payload, token, revision string
	attempt                          int
	lease, due, deadline             time.Time
	done                             bool
	applied                          *qltbytReportItem
}

type secondAppState struct {
	now            time.Time
	subscription   secondAppSubscription
	job            secondAppJob
	reports        []qltbytReportItem
	results        []string
	applyCount     int
	loseNextReport bool
}

func secondAppBinding(t *testing.T, id string, scalar byte, payload string) (AppBinding, *secondAppSource) {
	t.Helper()
	cfg := appTestConfig(t, id, "", scalar)
	secret, err := decodeHMACSecret(cfg.HMACSecret)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	source := &secondAppSource{
		cfg: cfg, secret: secret, seed: int(scalar) * 100,
		state: secondAppState{
			now: now,
			subscription: secondAppSubscription{
				userID: "same-local-user", revision: "1", active: true, eligible: true,
			},
			job: secondAppJob{userID: "same-local-user", payload: payload, deadline: now.Add(10 * time.Minute)},
		},
	}
	server := httptest.NewTLSServer(http.HandlerFunc(source.serveHTTP))
	t.Cleanup(server.Close)
	cfg.Origin = server.URL
	source.cfg = cfg
	bindings, err := NewAppBindings([]AppConfig{cfg}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	bindings[0].Worker.now = source.clock
	return bindings[0], source
}

func (s *secondAppSource) clock() time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.state.now
}

func (s *secondAppSource) snapshot() secondAppState {
	s.mu.Lock()
	defer s.mu.Unlock()
	state := s.state
	state.reports = append([]qltbytReportItem(nil), state.reports...)
	state.results = append([]string(nil), state.results...)
	return state
}

func (s *secondAppSource) serveHTTP(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	if err != nil || r.Method != http.MethodPost {
		secondAppError(w, http.StatusBadRequest, "invalid_request")
		return
	}
	keyID := r.Header.Get("x-web-push-key-id")
	want := signRequest(s.secret, keyID, r.Method, r.URL.RequestURI(), r.Header.Get("x-web-push-timestamp"), r.Header.Get("x-web-push-nonce"), body)
	if keyID != s.cfg.HMACKeyID || !hmac.Equal([]byte(r.Header.Get("x-web-push-signature")), []byte(want)) {
		secondAppError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	s.mu.Lock()
	block := s.blockReport
	s.mu.Unlock()
	if r.URL.Path == reportPath && block != nil {
		select {
		case block <- struct{}{}:
		case <-r.Context().Done():
			return
		}
		<-r.Context().Done()
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	switch r.URL.Path {
	case claimPath:
		var request qltbytClaimRequest
		if json.Unmarshal(body, &request) != nil || request.Version != 1 || request.Limit < 1 ||
			request.VAPIDKeyVersion != s.cfg.VAPIDVersion || request.VAPIDFingerprint != s.cfg.VAPIDFingerprint {
			secondAppError(w, http.StatusBadRequest, "invalid_claim")
			return
		}
		_ = json.NewEncoder(w).Encode(s.claim())
	case reportPath:
		var request qltbytReportRequest
		if json.Unmarshal(body, &request) != nil || request.Version != 1 || len(request.Results) != 1 {
			secondAppError(w, http.StatusBadRequest, "invalid_report")
			return
		}
		item := request.Results[0]
		result := s.report(item)
		s.state.reports = append(s.state.reports, item)
		s.state.results = append(s.state.results, result)
		if s.state.loseNextReport && result == "applied" {
			s.state.loseNextReport = false
			secondAppError(w, http.StatusServiceUnavailable, "response_lost_after_commit")
			return
		}
		_ = json.NewEncoder(w).Encode(qltbytReportResponse{Version: 1, Results: []qltbytReportResult{{DeliveryID: item.DeliveryID, Result: result}}})
	default:
		secondAppError(w, http.StatusNotFound, "not_found")
	}
}

func secondAppError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	version := 1
	_ = json.NewEncoder(w).Encode(apiErrorEnvelope{Version: &version, Error: &apiErrorBody{Code: code}})
}

// Called under the source lock: eligibility and ownership are source policy.
func (s *secondAppSource) claim() qltbytClaimResponse {
	state := &s.state
	job, sub := &state.job, &state.subscription
	response := qltbytClaimResponse{Version: 1, ServerTime: state.now.Format(time.RFC3339), PollAfterSeconds: 5, Deliveries: []qltbytDelivery{}}
	if !sub.active || !sub.eligible || sub.userID != job.userID || job.done ||
		state.now.Before(job.due) || (job.applied == nil && state.now.Before(job.lease)) || !state.now.Before(job.deadline) || job.attempt >= 100 {
		return response
	}
	job.attempt++
	job.token, job.revision = uuidFor(s.seed+job.attempt), sub.revision
	job.lease = state.now.Add(45 * time.Second)
	if job.deadline.Before(job.lease) {
		job.lease = job.deadline
	}
	job.applied = nil
	response.Deliveries = append(response.Deliveries, qltbytDelivery{
		DeliveryID: uuidFor(1), SubscriptionID: uuidFor(3), AttemptToken: job.token, Attempt: job.attempt,
		SubscriptionRevision: job.revision, LeaseExpiresAt: job.lease.Format(time.RFC3339),
		Deadline: job.deadline.Format(time.RFC3339), TTLSeconds: 60, VAPIDKeyVersion: s.cfg.VAPIDVersion,
		Endpoint:      "https://push.example.test/" + s.cfg.ID,
		Keys:          qltbytSubscriptionKeys{P256DH: "fixture-public", Auth: "fixture-auth"},
		PayloadBase64: base64.StdEncoding.EncodeToString([]byte(job.payload)),
	})
	return response
}

func (s *secondAppSource) report(item qltbytReportItem) string {
	state := &s.state
	job, sub := &state.job, &state.subscription
	if item.DeliveryID != uuidFor(1) || item.AttemptToken != job.token || item.SubscriptionRevision != job.revision {
		return "stale"
	}
	if job.applied != nil {
		if reflect.DeepEqual(*job.applied, item) {
			return "duplicate"
		}
		return "stale"
	}
	if item.SubscriptionRevision != sub.revision || sub.userID != job.userID || !state.now.Before(job.lease) {
		return "stale"
	}
	switch item.Outcome {
	case "accepted":
		job.done = true
	case "endpoint_gone":
		sub.active, job.done = false, true
	case "unsafe_endpoint":
		// A terminal delivery failure leaves the subscription/consent intact.
		job.done = true
	case "transient":
		delay := 5
		if item.RetryAfterSeconds != nil && *item.RetryAfterSeconds > delay {
			delay = *item.RetryAfterSeconds
		}
		job.due = state.now.Add(time.Duration(delay) * time.Second)
	default:
		return "stale"
	}
	job.applied = &item
	state.applyCount++
	return "applied"
}
