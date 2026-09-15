package webpush

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPBackendSignsClaimBodyAndUsesContractPath(t *testing.T) {
	secret := make([]byte, 32)
	for index := range secret {
		secret[index] = 1
	}
	const timestamp = int64(1789056000)
	var received struct {
		path    string
		body    []byte
		headers http.Header
	}
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		received.path = request.URL.RequestURI()
		received.body, _ = io.ReadAll(request.Body)
		received.headers = request.Header.Clone()
		writer.Header().Set("content-type", "application/json")
		_, _ = writer.Write([]byte(`{"version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[]}`))
	}))
	defer server.Close()

	backend, err := NewHTTPBackend(server.URL, "test-key-1", base64.StdEncoding.EncodeToString(secret), server.Client())
	if err != nil {
		t.Fatal(err)
	}
	backend.clock = func() time.Time { return time.Unix(timestamp, 0) }
	var nonce [16]byte
	for index := range nonce {
		nonce[index] = byte(index)
	}
	backend.nonce = func() ([16]byte, error) { return nonce, nil }

	response, err := backend.Claim(context.Background(), ClaimRequest{Version: 1, WorkerID: "oracle-web-push-1", Limit: 5, VAPIDKeyVersion: "staging-20260910-01", VAPIDFingerprint: "sha256:" + string(make([]byte, 64))})
	if err != nil {
		t.Fatalf("Claim() error = %v", err)
	}
	if response.Version != 1 || received.path != "/api/internal/web-push/v1/claim" {
		t.Fatalf("response/path = %+v/%q", response, received.path)
	}
	if received.headers.Get("x-web-push-key-id") != "test-key-1" || received.headers.Get("x-web-push-timestamp") != "1789056000" || received.headers.Get("x-web-push-nonce") != hex.EncodeToString(nonce[:]) {
		t.Fatalf("signed headers = %v", received.headers)
	}
	want := signRequest(secret, "test-key-1", "POST", received.path, "1789056000", hex.EncodeToString(nonce[:]), received.body)
	if got := received.headers.Get("x-web-push-signature"); got != want {
		t.Fatalf("signature = %q, want %q", got, want)
	}
}

func TestSignRequestMatchesPhaseOneVector(t *testing.T) {
	secret := make([]byte, 32)
	for index := range secret {
		secret[index] = 1
	}
	body := []byte(`{"version":1,"worker_id":"oracle-web-push-1","limit":5,"vapid_key_version":"staging-20260910-01","vapid_fingerprint":"sha256:0000000000000000000000000000000000000000000000000000000000000000"}`)
	got := signRequest(secret, "test-key-1", "POST", "/api/internal/web-push/v1/claim", "1789056000", "000102030405060708090a0b0c0d0e0f", body)
	const want = "fed0aa5536eec355be4295c446f3615e90e575315eb4a2abc0c24230e6992a28"
	if got != want {
		t.Fatalf("signature = %q, want %q", got, want)
	}
}

func TestHTTPBackendMapsAPIErrorWithoutLeakingResponseBody(t *testing.T) {
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusTooManyRequests)
		_, _ = writer.Write([]byte(`{"secret":"must-not-escape"}`))
	}))
	defer server.Close()
	secret := base64.StdEncoding.EncodeToString(make([]byte, 32))
	backend, err := NewHTTPBackend(server.URL, "test-key-1", secret, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	_, err = backend.Report(context.Background(), ReportRequest{Version: 1, Results: []ReportItem{}})
	if err == nil {
		t.Fatal("Report() error = nil")
	}
	if got := err.Error(); got == "" || containsSecret(got) {
		t.Fatalf("error leaked response body: %q", got)
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Status != http.StatusTooManyRequests {
		t.Fatalf("error = %#v", err)
	}
}

func TestHTTPBackendRejectsInvalidKeyID(t *testing.T) {
	secret := base64.StdEncoding.EncodeToString(make([]byte, 32))
	if _, err := NewHTTPBackend("https://app.example", "UPPERCASE", secret, nil); err == nil {
		t.Fatal("NewHTTPBackend() error = nil for invalid key id")
	}
}

func TestHTTPBackendRetriesReplayOnceWithFreshNonce(t *testing.T) {
	var nonces []string
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		nonces = append(nonces, request.Header.Get("x-web-push-nonce"))
		if len(nonces) == 1 {
			writer.WriteHeader(http.StatusConflict)
			_, _ = writer.Write([]byte(`{"version":1,"error":{"code":"replay"}}`))
			return
		}
		writer.Header().Set("content-type", "application/json")
		_, _ = writer.Write([]byte(`{"version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[]}`))
	}))
	defer server.Close()

	secret := base64.StdEncoding.EncodeToString(make([]byte, 32))
	backend, err := NewHTTPBackend(server.URL, "test-key-1", secret, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	privateKey := make([]byte, 32)
	privateKey[31] = 1
	key, err := LoadVAPIDKey(writeVAPIDSecret(t, privateKey), "staging-20260910-01", "", "")
	if err != nil {
		t.Fatal(err)
	}
	worker := NewWorker(WorkerConfig{
		API:                 backend,
		Sender:              &fakeSender{},
		VAPID:               key,
		ExpectedVersion:     key.Version,
		ExpectedPublicKey:   key.PublicKey,
		ExpectedFingerprint: key.Fingerprint,
	})
	if err := worker.RunOnce(context.Background()); err != nil {
		t.Fatalf("RunOnce() error = %v", err)
	}
	if len(nonces) != 2 || nonces[0] == "" || nonces[0] == nonces[1] {
		t.Fatalf("nonces = %v, want two distinct nonces", nonces)
	}
}

func TestHTTPBackendStopsAfterOneReplayRetry(t *testing.T) {
	calls := 0
	server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		calls++
		writer.WriteHeader(http.StatusConflict)
		_, _ = writer.Write([]byte(`{"version":1,"error":{"code":"replay"}}`))
	}))
	defer server.Close()

	backend, err := NewHTTPBackend(server.URL, "test-key-1", base64.StdEncoding.EncodeToString(make([]byte, 32)), server.Client())
	if err != nil {
		t.Fatal(err)
	}
	_, err = backend.Report(context.Background(), ReportRequest{Version: 1, Results: []ReportItem{}})
	if err == nil {
		t.Fatal("Report() error = nil")
	}
	if calls != 2 {
		t.Fatalf("replay calls = %d, want 2", calls)
	}
	apiErr, ok := err.(*APIError)
	if !ok || apiErr.Status != http.StatusConflict || apiErr.Code != "replay" {
		t.Fatalf("error = %#v, want replay conflict", err)
	}
}

func TestHTTPBackendRejectsNonContractClaimResponses(t *testing.T) {
	valid := `{"version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[]}`
	cases := []struct {
		name string
		body string
		code string
	}{
		{name: "unknown field", body: `{"version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[],"extra":true}`, code: "invalid_response"},
		{name: "case variant field", body: `{"Version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[]}`, code: "invalid_response"},
		{name: "duplicate field", body: `{"version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[],"deliveries":[]}`, code: "invalid_response"},
		{name: "trailing json", body: valid + `{}`, code: "invalid_response"},
		{name: "wrong type", body: `{"version":1,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":"5","deliveries":[]}`, code: "invalid_response"},
		{name: "null field", body: `{"version":1,"server_time":null,"poll_after_seconds":5,"deliveries":[]}`, code: "invalid_response"},
		{name: "missing version", body: `{"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[]}`, code: "invalid_response"},
		{name: "unsupported version", body: `{"version":2,"server_time":"2026-09-15T00:00:00Z","poll_after_seconds":5,"deliveries":[]}`, code: "unsupported_version"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.Header().Set("content-type", "application/json")
				_, _ = writer.Write([]byte(tc.body))
			}))
			defer server.Close()
			backend, err := NewHTTPBackend(server.URL, "test-key-1", base64.StdEncoding.EncodeToString(make([]byte, 32)), server.Client())
			if err != nil {
				t.Fatal(err)
			}
			_, err = backend.Claim(context.Background(), ClaimRequest{Version: 1, WorkerID: "oracle-web-push-1", Limit: 5, VAPIDKeyVersion: "staging-20260910-01", VAPIDFingerprint: "sha256:" + string(make([]byte, 64))})
			if err == nil {
				t.Fatal("Claim() error = nil")
			}
			apiErr, ok := err.(*APIError)
			if !ok || apiErr.Code != tc.code {
				t.Fatalf("Claim() error = %#v, want code %q", err, tc.code)
			}
		})
	}
}

func TestHTTPBackendRejectsNonContractErrorResponses(t *testing.T) {
	cases := []struct {
		name string
		body string
		code string
	}{
		{name: "unknown field", body: `{"version":1,"error":{"code":"replay"},"extra":true}`, code: "invalid_response"},
		{name: "case variant field", body: `{"Version":1,"error":{"code":"replay"}}`, code: "invalid_response"},
		{name: "duplicate field", body: `{"version":1,"error":{"code":"replay","code":"replay"}}`, code: "invalid_response"},
		{name: "trailing json", body: `{"version":1,"error":{"code":"replay"}}{}`, code: "invalid_response"},
		{name: "wrong type", body: `{"version":1,"error":{"code":"replay","retry_after_seconds":"1"}}`, code: "invalid_response"},
		{name: "null field", body: `{"version":1,"error":null}`, code: "invalid_response"},
		{name: "missing version", body: `{"error":{"code":"replay"}}`, code: "invalid_response"},
		{name: "unsupported version", body: `{"version":2,"error":{"code":"replay"}}`, code: "unsupported_version"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewTLSServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
				writer.WriteHeader(http.StatusServiceUnavailable)
				_, _ = writer.Write([]byte(tc.body))
			}))
			defer server.Close()
			backend, err := NewHTTPBackend(server.URL, "test-key-1", base64.StdEncoding.EncodeToString(make([]byte, 32)), server.Client())
			if err != nil {
				t.Fatal(err)
			}
			_, err = backend.Report(context.Background(), ReportRequest{Version: 1, Results: []ReportItem{}})
			if err == nil {
				t.Fatal("Report() error = nil")
			}
			apiErr, ok := err.(*APIError)
			if !ok || apiErr.Code != tc.code {
				t.Fatalf("Report() error = %#v, want code %q", err, tc.code)
			}
		})
	}
}

func containsSecret(value string) bool {
	return value == "must-not-escape" || value == `{"secret":"must-not-escape"}`
}
