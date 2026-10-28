package webpush

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type appKeySender struct {
	t     *testing.T
	key   string
	sends int
}

func (s *appKeySender) Send(_ context.Context, _ Delivery, key VAPIDKey, _ time.Duration) (ProviderResult, error) {
	s.sends++
	if key.PublicKey != s.key {
		s.t.Error("sender received another app's VAPID key")
	}
	return ProviderResult{Status: http.StatusCreated}, nil
}

// Each fixture is a separate authenticated source, including its own report
// fence. Identical delivery/subscription IDs are intentional.
func appTestSource(t *testing.T, cfg AppConfig, token string, version string) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	reports := &atomic.Int32{}
	secret, err := decodeHMACSecret(cfg.HMACSecret)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		keyID := r.Header.Get("x-web-push-key-id")
		want := signRequest(secret, keyID, r.Method, r.URL.RequestURI(), r.Header.Get("x-web-push-timestamp"), r.Header.Get("x-web-push-nonce"), body)
		if keyID != cfg.HMACKeyID || r.Header.Get("x-web-push-signature") != want {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"version":1,"error":{"code":"unauthorized"}}`))
			return
		}
		switch r.URL.Path {
		case claimPath:
			var claim qltbytClaimRequest
			if err := json.Unmarshal(body, &claim); err != nil || claim.VAPIDKeyVersion != cfg.VAPIDVersion || claim.VAPIDFingerprint != cfg.VAPIDFingerprint {
				t.Error("claim used another app's VAPID artifact")
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			response := strings.Replace(contractClaim, `00000000-0000-0000-0000-000000000002`, token, 1)
			response = strings.Replace(response, `"staging-20260910-01"`, `"`+version+`"`, 1)
			_, _ = w.Write([]byte(response))
		case reportPath:
			var report qltbytReportRequest
			if err := json.Unmarshal(body, &report); err != nil || len(report.Results) != 1 || report.Results[0].AttemptToken != token || report.Results[0].Outcome != "accepted" {
				t.Error("report crossed source fence or had incorrect result")
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			reports.Add(1)
			_, _ = w.Write([]byte(`{"version":1,"results":[{"delivery_id":"00000000-0000-0000-0000-000000000001","result":"applied"}]}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	return server, reports
}

func appTestWorker(t *testing.T, binding AppBinding, publicKey string) *appKeySender {
	t.Helper()
	sender := &appKeySender{t: t, key: publicKey}
	binding.Worker.sender = sender
	binding.Worker.now = func() time.Time { return time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC) }
	return sender
}

func TestAppBindingsIsolateSameLocalIDs(t *testing.T) {
	a := appTestConfig(t, "app-a", "", 1)
	b := appTestConfig(t, "app-b", "", 2)
	first, firstReports := appTestSource(t, a, "00000000-0000-0000-0000-000000000002", a.VAPIDVersion)
	second, secondReports := appTestSource(t, b, "00000000-0000-0000-0000-000000000004", b.VAPIDVersion)
	a.Origin, b.Origin = first.URL, second.URL
	bindings, err := NewAppBindings([]AppConfig{a, b}, first.Client())
	if err != nil {
		t.Fatal(err)
	}
	if bindings[0].Health == bindings[1].Health || bindings[0].Worker.metrics == bindings[1].Worker.metrics {
		t.Fatal("apps share health or metric state")
	}
	for index, cfg := range []AppConfig{a, b} {
		if bindings[index].ID != cfg.ID || bindings[index].Worker.sender.(WebPushSender).Subject != cfg.VAPIDSubject {
			t.Fatal("binding lost configured app identity or sender subject")
		}
		sender := appTestWorker(t, bindings[index], cfg.VAPIDPublicKey)
		if err := bindings[index].Worker.RunOnce(context.Background()); err != nil {
			t.Fatal(err)
		}
		if sender.sends != 1 {
			t.Fatal("app did not send its delivery exactly once")
		}
	}
	if firstReports.Load() != 1 || secondReports.Load() != 1 {
		t.Fatal("reports did not return to both claiming sources")
	}
}

func TestAppBindingRejectsWrongCredentialAndDeliveryKeyVersion(t *testing.T) {
	for _, failure := range []string{"credential", "delivery key version"} {
		t.Run(failure, func(t *testing.T) {
			cfg := appTestConfig(t, "app-a", "", 1)
			version := cfg.VAPIDVersion
			if failure == "delivery key version" {
				version = "another-app-version"
			}
			server, reports := appTestSource(t, cfg, "00000000-0000-0000-0000-000000000002", version)
			cfg.Origin = server.URL
			if failure == "credential" {
				cfg.HMACSecret = base64.StdEncoding.EncodeToString(make([]byte, 32))
			}
			bindings, err := NewAppBindings([]AppConfig{cfg}, server.Client())
			if err != nil {
				t.Fatal(err)
			}
			sender := appTestWorker(t, bindings[0], cfg.VAPIDPublicKey)
			err = bindings[0].Worker.RunOnce(context.Background())
			if failure == "credential" {
				var apiErr *APIError
				if !errors.As(err, &apiErr) || apiErr.Status != http.StatusUnauthorized {
					t.Fatalf("wrong credential error = %v, want unauthorized", err)
				}
			} else if !errors.Is(err, ErrVAPIDMismatch) {
				t.Fatalf("wrong delivery version error = %v, want VAPID mismatch", err)
			}
			if sender.sends != 0 || reports.Load() != 0 {
				t.Fatal("invalid credential or key caused a send/report")
			}
		})
	}
}

func TestAppBindingCredentialRotationKeepsIdentityAndVAPID(t *testing.T) {
	cfg := appTestConfig(t, "qltbyt", "https://qltbyt.example", 1)
	rotated := cfg
	rotated.HMACKeyID = "rotated-slot"
	rotated.HMACSecret = base64.StdEncoding.EncodeToString(make([]byte, 32))
	server, reports := appTestSource(t, rotated, "00000000-0000-0000-0000-000000000002", cfg.VAPIDVersion)
	cfg.Origin, rotated.Origin = server.URL, server.URL
	before, err := NewAppBindings([]AppConfig{cfg}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	after, err := NewAppBindings([]AppConfig{rotated}, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	if before[0].ID != after[0].ID || before[0].Worker.vapid.PublicKey != after[0].Worker.vapid.PublicKey || before[0].Worker.vapid.Version != after[0].Worker.vapid.Version {
		t.Fatal("credential rotation changed app identity or VAPID artifact")
	}
	if before[0].Worker.api.(*HTTPBackend).keyID == after[0].Worker.api.(*HTTPBackend).keyID {
		t.Fatal("credential rotation retained the old slot")
	}
	sender := appTestWorker(t, after[0], cfg.VAPIDPublicKey)
	if err := after[0].Worker.RunOnce(context.Background()); err != nil || sender.sends != 1 || reports.Load() != 1 {
		t.Fatalf("rotated credential did not authenticate claim/report: %v", err)
	}
}
