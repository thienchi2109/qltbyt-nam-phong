package orchestration

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/provider"
)

func TestReviewDynamicHTTPClassification(t *testing.T) {
	for _, tc := range []struct {
		name         string
		status       int
		body         string
		delay        time.Duration
		wantFallback bool
		wantClass    string
	}{
		{"real_quota", 429, `{"error":{"message":"quota exhausted","type":"insufficient_quota","code":"insufficient_quota"}}`, 0, true, string(provider.ErrorClassQuotaExhausted)},
		{"real_rate_limit", 429, `{"error":{"message":"try again","type":"rate_limit_error","code":"rate_limit_exceeded"}}`, 0, true, string(provider.ErrorClassRateLimited)},
		{"auth_401_mentions_quota", 401, `{"error":{"message":"API key cannot access quota project","type":"authentication_error","code":"invalid_api_key"}}`, 0, false, string(provider.ErrorClassTransport)},
		{"auth_403_mentions_quota", 403, `{"error":{"message":"forbidden quota project","type":"authentication_error","code":"invalid_api_key"}}`, 0, false, string(provider.ErrorClassTransport)},
		{"server_5xx_mentions_quota", 500, `{"error":{"message":"quota exhausted while serving request","type":"server_error","code":"quota_exhausted"}}`, 0, false, string(provider.ErrorClassTransport)},
		{"timeout_mentions_quota", 429, `{"error":{"message":"quota exhausted after timeout","type":"insufficient_quota","code":"insufficient_quota"}}`, 100 * time.Millisecond, false, string(provider.ErrorClassTransport)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			primaryCalls, fallbackCalls := 0, 0
			primaryDone := make(chan struct{})
			primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				defer close(primaryDone)
				primaryCalls++
				if tc.delay > 0 {
					time.Sleep(tc.delay)
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(tc.status)
				_, _ = fmt.Fprint(w, tc.body)
			}))
			defer primary.Close()
			fallback := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				fallbackCalls++
				w.Header().Set("Content-Type", "application/json")
				_, _ = fmt.Fprint(w, `{"candidates":[{"content":{"role":"model","parts":[{"text":"fallback OK"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":1,"totalTokenCount":3}}`)
			}))
			defer fallback.Close()
			cfg, err := provider.ChainConfigFromEnv(map[string]string{"AI_PROVIDER_CHAIN": "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite", "NVIDIA_API_KEY": "fake", "NVIDIA_BASE_URL": primary.URL + "/v1/chat/completions", "GOOGLE_GENERATIVE_AI_API_KEY": "fake", "GOOGLE_GENERATIVE_AI_BASE_URL": fallback.URL})
			if err != nil {
				t.Fatal(err)
			}
			if tc.delay > 0 {
				cfg.Pairs[0].Config.HTTPClient = &http.Client{Timeout: 20 * time.Millisecond}
			}
			chain, err := provider.NewChain(context.Background(), cfg)
			if err != nil {
				t.Fatal(err)
			}
			result, err := newPhase59Runner(t, chain).Run(context.Background(), testRequest())
			if tc.delay > 0 {
				<-primaryDone
			}
			t.Logf("primary=%d fallback=%d err=%v metadata=%+v", primaryCalls, fallbackCalls, err, result.Provider)
			if (fallbackCalls > 0) != tc.wantFallback {
				t.Fatalf("fallback=%d wantFallback=%v", fallbackCalls, tc.wantFallback)
			}
			if len(result.Provider.Attempts) == 0 {
				t.Fatal("provider attempts are missing")
			}
			first := result.Provider.Attempts[0]
			if tc.wantFallback {
				if len(result.Provider.Attempts) != 2 || first.Outcome != "fallback" || first.ErrorClass != tc.wantClass || result.Provider.Attempts[1].Outcome != "success" {
					t.Fatalf("provider attempts = %+v", result.Provider.Attempts)
				}
			} else if len(result.Provider.Attempts) != 1 || first.Outcome != "failure" || first.ErrorClass != tc.wantClass {
				t.Fatalf("provider attempts = %+v", result.Provider.Attempts)
			}
		})
	}
}
