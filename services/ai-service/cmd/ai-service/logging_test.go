package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/ingress"
)

func TestRuntimeLogsRequestErrorsAndObservations(t *testing.T) {
	for _, configured := range []bool{false, true} {
		t.Run(map[bool]string{false: "invalid-config", true: "configured"}[configured], func(t *testing.T) {
			var output bytes.Buffer
			previous := log.Writer()
			log.SetOutput(&output)
			t.Cleanup(func() { log.SetOutput(previous) })
			env := map[string]string{}
			if configured {
				var cleanup func()
				env, cleanup = validRuntimeEnv(t)
				defer cleanup()
				env["AI_DATABASE_URL"] = "postgresql://ai_query_tool:secret@pooler.example:6543/postgres?sslmode=require"
			}
			runtime := newServiceRuntime(env)
			defer runtime.close()
			if configured && runtime.configErr != nil {
				t.Fatalf("configuration failed: %v", runtime.configErr)
			}
			request := httptest.NewRequest(http.MethodGet, "/unsupported", nil)
			request.Header.Set("X-Request-ID", "request-123")
			runtime.handler.ServeHTTP(httptest.NewRecorder(), request)
			var record map[string]any
			if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &record); err != nil {
				t.Fatalf("request did not emit JSON log: %q (%v)", output.String(), err)
			}
			if record["request_id"] != "request-123" || record["outcome"] != "invalid_request" {
				t.Fatalf("error log = %v", record)
			}
			output.Reset()
			sink, ok := runtime.handler.Log.(ingress.ObservationSink)
			if !ok {
				t.Fatal("runtime has no observation logger")
			}
			sink.Observe(ingress.Observation{RequestID: "request-123", Provider: "google", Model: "gemini-3.5-flash-lite", Outcome: "completed", Latency: 150 * time.Millisecond})
			if err := json.Unmarshal(bytes.TrimSpace(output.Bytes()), &record); err != nil {
				t.Fatal(err)
			}
			if record["request_id"] != "request-123" || record["outcome"] != "completed" || record["provider"] != "google" || record["latency_ms"] != float64(150) {
				t.Fatalf("observation log = %v", record)
			}
			output.Reset()
			runtime.handler.Log.Record("api_key=secret", "SELECT * FROM users")
			sink.Observe(ingress.Observation{Model: "sk-sensitive", Outcome: "prompt-sensitive"})
			for _, sensitive := range []string{"api_key", "secret", "SELECT", "users", "sk-sensitive", "prompt-sensitive"} {
				if strings.Contains(output.String(), sensitive) {
					t.Fatalf("log leaked %q: %s", sensitive, output.String())
				}
			}
			if strings.Count(output.String(), "redacted") != 4 {
				t.Fatalf("sensitive fields not redacted: %s", output.String())
			}
		})
	}
}
