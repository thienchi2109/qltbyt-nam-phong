package webpush

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

const contractClaim = `{"version":1,"server_time":"2026-10-28T00:00:00Z","poll_after_seconds":5,"deliveries":[{"delivery_id":"00000000-0000-0000-0000-000000000001","attempt_token":"00000000-0000-0000-0000-000000000002","attempt":2,"subscription_id":"00000000-0000-0000-0000-000000000003","subscription_revision":"9007199254740993","lease_expires_at":"2026-10-28T00:00:45Z","deadline":"2026-10-28T01:00:00Z","ttl_seconds":60,"vapid_key_version":"staging-20260910-01","endpoint":"https://push.example.test/send","keys":{"p256dh":"public","auth":"auth"},"payload_base64":"e30="}]}`

func contractBackend(t *testing.T, handler http.HandlerFunc) *HTTPBackend {
	t.Helper()
	server := httptest.NewTLSServer(handler)
	t.Cleanup(server.Close)
	backend, err := NewHTTPBackend(server.URL, "rotated-key-2", base64.StdEncoding.EncodeToString(make([]byte, 32)), server.Client())
	if err != nil {
		t.Fatal(err)
	}
	return backend
}

func TestHTTPBackendMapsQLTBYTContract(t *testing.T) {
	claimBody := `{"version":1,"worker_id":"oracle-web-push-1","limit":5,"vapid_key_version":"staging-20260910-01","vapid_fingerprint":"sha256:test"}`
	for _, result := range []string{"applied", "duplicate", "stale"} {
		t.Run(result, func(t *testing.T) {
			calls := 0
			backend := contractBackend(t, func(writer http.ResponseWriter, request *http.Request) {
				calls++
				body, err := io.ReadAll(request.Body)
				if err != nil {
					t.Error(err)
				}
				wantBody := claimBody
				wantPath := claimPath
				response := contractClaim
				if calls == 2 {
					wantBody = `{"version":1,"results":[{"delivery_id":"00000000-0000-0000-0000-000000000001","attempt_token":"00000000-0000-0000-0000-000000000002","subscription_revision":"9007199254740993","outcome":"transient","provider_status":null,"retry_after_seconds":null}]}`
					wantPath = reportPath
					response = `{"version":1,"results":[{"delivery_id":"00000000-0000-0000-0000-000000000001","result":"` + result + `"}]}`
				}
				if request.Method != http.MethodPost || request.URL.RequestURI() != wantPath || string(body) != wantBody {
					t.Errorf("request = %s %s %s", request.Method, request.URL.RequestURI(), body)
				}
				if request.Header.Get("x-web-push-key-id") != "rotated-key-2" || request.Header.Get("x-web-push-timestamp") != "1793145600" || request.Header.Get("x-web-push-nonce") != strings.Repeat("00", 16) {
					t.Errorf("auth headers = %v", request.Header)
				}
				wantSignature := signRequest(make([]byte, 32), "rotated-key-2", http.MethodPost, wantPath, "1793145600", strings.Repeat("00", 16), []byte(wantBody))
				if request.Header.Get("x-web-push-signature") != wantSignature {
					t.Error("signature does not bind exact contract body/path")
				}
				_, _ = writer.Write([]byte(response))
			})
			backend.clock = func() time.Time { return time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC) }
			backend.nonce = func() ([16]byte, error) { return [16]byte{}, nil }
			response, err := backend.Claim(context.Background(), ClaimRequest{WorkerID: "oracle-web-push-1", Limit: 5, VAPIDKeyVersion: "staging-20260910-01", VAPIDFingerprint: "sha256:test"})
			if err != nil {
				t.Fatal(err)
			}
			wantDelivery := testDelivery()
			wantDelivery.Attempt = 2
			wantDelivery.SubscriptionRevision = "9007199254740993"
			wantDelivery.LeaseExpiresAt = "2026-10-28T00:00:45Z"
			wantDelivery.Deadline = "2026-10-28T01:00:00Z"
			wantDelivery.PayloadBase64 = "e30="
			if response.ServerTime != "2026-10-28T00:00:00Z" || response.PollAfterSeconds != 5 || !reflect.DeepEqual(response.Deliveries, []Delivery{wantDelivery}) {
				t.Fatalf("claim mapping = %+v", response)
			}
			report := ReportRequest{Results: []ReportItem{reportItem(response.Deliveries[0], "transient", nil, nil)}}
			ack, err := backend.Report(context.Background(), report)
			if err != nil || !reflect.DeepEqual(ack.Results, []ReportResult{{DeliveryID: wantDelivery.DeliveryID, Result: result}}) {
				t.Fatalf("report mapping = %+v, %v", ack, err)
			}
			if calls != 2 {
				t.Fatalf("calls = %d, want 2", calls)
			}
		})
	}
}

func TestHTTPBackendRejectsInvalidSemanticReplies(t *testing.T) {
	for _, tc := range []struct{ name, body string }{
		{"poll", strings.Replace(contractClaim, `"poll_after_seconds":5`, `"poll_after_seconds":6`, 1)},
		{"UUID", strings.Replace(contractClaim, `000000000001`, `00000000000A`, 1)},
		{"revision", strings.Replace(contractClaim, `"9007199254740993"`, `""`, 1)},
		{"attempt", strings.Replace(contractClaim, `"attempt":2`, `"attempt":0`, 1)},
		{"lease", strings.Replace(contractClaim, `2026-10-28T00:00:45Z`, `invalid`, 1)},
		{"deadline", strings.Replace(contractClaim, `2026-10-28T01:00:00Z`, `invalid`, 1)},
		{"TTL", strings.Replace(contractClaim, `"ttl_seconds":60`, `"ttl_seconds":-1`, 1)},
	} {
		t.Run("claim/"+tc.name, func(t *testing.T) {
			backend := contractBackend(t, func(writer http.ResponseWriter, _ *http.Request) { _, _ = writer.Write([]byte(tc.body)) })
			response, err := backend.Claim(context.Background(), ClaimRequest{})
			assertInvalidBackendReply(t, err)
			if len(response.Deliveries) != 0 {
				t.Fatal("invalid claim exposed deliveries")
			}
		})
	}
	const item = `{"delivery_id":"00000000-0000-0000-0000-000000000001","result":"applied"}`
	for _, tc := range []struct{ name, results string }{
		{"missing", `[]`},
		{"duplicate", `[` + item + `,` + item + `]`},
		{"unexpected ID", `[` + strings.Replace(item, `000000000001`, `000000000009`, 1) + `]`},
		{"unknown result", `[` + strings.Replace(item, `applied`, `sent`, 1) + `]`},
		{"uppercase UUID", `[` + strings.Replace(item, `000000000001`, `00000000000A`, 1) + `]`},
	} {
		t.Run("report/"+tc.name, func(t *testing.T) {
			backend := contractBackend(t, func(writer http.ResponseWriter, _ *http.Request) {
				_, _ = writer.Write([]byte(`{"version":1,"results":` + tc.results + `}`))
			})
			response, err := backend.Report(context.Background(), ReportRequest{Results: []ReportItem{reportItem(testDelivery(), "accepted", nil, nil)}})
			assertInvalidBackendReply(t, err)
			if len(response.Results) != 0 {
				t.Fatal("invalid report exposed acknowledgements")
			}
		})
	}
}

func assertInvalidBackendReply(t *testing.T, err error) {
	t.Helper()
	var apiErr *APIError
	var backendErr *BackendError
	if !errors.Is(err, ErrInvalidResponse) || !errors.As(err, &apiErr) || apiErr.Code != "invalid_response" || !errors.As(err, &backendErr) || backendErr.Retryable {
		t.Fatalf("error = %v, want terminal invalid response preserving APIError", err)
	}
}

func TestHTTPBackendAuthFailureAndTimeout(t *testing.T) {
	for _, operation := range []string{"claim", "report"} {
		for _, failure := range []string{"unauthorized", "timeout"} {
			t.Run(operation+"/"+failure, func(t *testing.T) {
				release := make(chan struct{})
				backend := contractBackend(t, func(writer http.ResponseWriter, request *http.Request) {
					if failure == "timeout" {
						select {
						case <-request.Context().Done():
						case <-release:
						}
						return
					}
					writer.WriteHeader(http.StatusUnauthorized)
					_, _ = writer.Write([]byte(`{"version":1,"error":{"code":"unauthorized"}}`))
				})
				defer close(release)
				ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
				defer cancel()
				var err error
				if operation == "claim" {
					_, err = backend.Claim(ctx, ClaimRequest{})
				} else {
					_, err = backend.Report(ctx, ReportRequest{})
				}
				var apiErr *APIError
				var backendErr *BackendError
				if !errors.As(err, &apiErr) || !errors.As(err, &backendErr) {
					t.Fatalf("error = %v, want APIError + BackendError", err)
				}
				if failure == "timeout" {
					if !errors.Is(err, context.DeadlineExceeded) || !backendErr.Retryable {
						t.Fatalf("timeout = %v, want retryable context deadline", err)
					}
				} else if apiErr.Status != 401 || apiErr.Code != "unauthorized" || backendErr.Retryable {
					t.Fatalf("auth error = %v, want terminal unauthorized", err)
				}
			})
		}
	}
}

func TestHTTPBackendMapsNonNullReportFields(t *testing.T) {
	status, retry := 429, 30
	backend := contractBackend(t, func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		const want = `{"version":1,"results":[{"delivery_id":"00000000-0000-0000-0000-000000000001","attempt_token":"00000000-0000-0000-0000-000000000002","subscription_revision":"1","outcome":"transient","provider_status":429,"retry_after_seconds":30}]}`
		if string(body) != want {
			t.Errorf("report body = %s, want %s", body, want)
		}
		_, _ = writer.Write([]byte(`{"version":1,"results":[{"delivery_id":"00000000-0000-0000-0000-000000000001","result":"applied"}]}`))
	})
	_, err := backend.Report(context.Background(), ReportRequest{Results: []ReportItem{reportItem(testDelivery(), "transient", &status, &retry)}})
	if err != nil {
		t.Fatal(err)
	}
}

func TestQLTBYTSingleAppWorkerPreservesReportOutcome(t *testing.T) {
	for _, rejected := range []bool{false, true} {
		t.Run(map[bool]string{false: "stale", true: "unauthorized"}[rejected], func(t *testing.T) {
			reports := 0
			backend := contractBackend(t, func(writer http.ResponseWriter, request *http.Request) {
				if request.URL.Path == claimPath {
					_, _ = writer.Write([]byte(contractClaim))
					return
				}
				reports++
				body, _ := io.ReadAll(request.Body)
				for _, field := range []string{`"attempt_token":"00000000-0000-0000-0000-000000000002"`, `"subscription_revision":"9007199254740993"`, `"outcome":"accepted"`, `"provider_status":201`} {
					if !strings.Contains(string(body), field) {
						t.Errorf("missing %s in worker report %s", field, body)
					}
				}
				if rejected {
					writer.WriteHeader(http.StatusUnauthorized)
					_, _ = writer.Write([]byte(`{"version":1,"error":{"code":"unauthorized"}}`))
					return
				}
				_, _ = writer.Write([]byte(`{"version":1,"results":[{"delivery_id":"00000000-0000-0000-0000-000000000001","result":"stale"}]}`))
			})
			key := testVAPIDKey(t)
			sender := &fakeSender{result: ProviderResult{Status: 201}}
			worker := NewWorker(WorkerConfig{
				API: backend, Sender: sender, VAPID: key,
				ExpectedVersion: key.Version, ExpectedPublicKey: key.PublicKey, ExpectedFingerprint: key.Fingerprint,
				Now: func() time.Time { return time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC) },
			})
			err := worker.RunOnce(context.Background())
			if rejected {
				var apiErr *APIError
				if !errors.As(err, &apiErr) || apiErr.Status != 401 {
					t.Fatalf("RunOnce() = %v, want report auth failure", err)
				}
			} else if err != nil {
				t.Fatalf("RunOnce() = %v", err)
			}
			if reports != 1 || len(sender.sends) != 1 {
				t.Fatalf("reports/sends = %d/%d, want 1/1", reports, len(sender.sends))
			}
		})
	}
}
