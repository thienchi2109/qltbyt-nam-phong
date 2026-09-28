package main

import (
	"bytes"
	"context"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/composition"
)

func TestReadSecretFileTrimsOnlyFileWhitespaceAndRejectsEmpty(t *testing.T) {
	path := filepath.Join(t.TempDir(), "secret")
	if err := os.WriteFile(path, []byte("  secret-value \n"), 0o400); err != nil {
		t.Fatal(err)
	}
	value, err := readSecretFile(path)
	if err != nil {
		t.Fatalf("read secret = %v", err)
	}
	if string(value) != "secret-value" {
		t.Fatalf("secret = %q", value)
	}
	empty := filepath.Join(t.TempDir(), "empty")
	if err := os.WriteFile(empty, []byte(" \n"), 0o400); err != nil {
		t.Fatal(err)
	}
	if _, err := readSecretFile(empty); err == nil || strings.Contains(err.Error(), "secret-value") {
		t.Fatalf("empty secret error = %v", err)
	}
}

func TestLoadRuntimeConfigReadsExternalSecretsWithoutReplacingFileContract(t *testing.T) {
	dir := t.TempDir()
	files := map[string]string{
		"AI_SERVICE_HMAC_SECRET_FILE":        "hmac",
		"AI_SERVICE_BROKER_SECRET_FILE":      "broker",
		"NVIDIA_API_KEY_FILE":                "nvidia",
		"GOOGLE_GENERATIVE_AI_API_KEYS_FILE": "google",
	}
	env := map[string]string{
		"AI_DATABASE_URL":               "postgresql://ai_query_tool:secret@pooler.example:6543/postgres?sslmode=require",
		"AI_SERVICE_HMAC_KEY_ID":        "key-1",
		"AI_PROVIDER_CHAIN":             "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite",
		"NVIDIA_BASE_URL":               "https://nvidia.invalid/v1/chat/completions",
		"GOOGLE_GENERATIVE_AI_BASE_URL": "https://google.invalid",
	}
	for name, value := range files {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte(value+"\n"), 0o400); err != nil {
			t.Fatal(err)
		}
		env[name] = path
	}
	cfg, err := loadRuntimeConfig(env)
	if err != nil {
		t.Fatalf("load runtime config = %v", err)
	}
	if string(cfg.hmacSecret) != "hmac" || string(cfg.brokerSecret) != "broker" {
		t.Fatalf("loaded secrets = %q/%q", cfg.hmacSecret, cfg.brokerSecret)
	}
	if cfg.reservationTTL < 120*time.Second {
		t.Fatalf("reservation TTL = %s", cfg.reservationTTL)
	}
	if cfg.databaseURL != env["AI_DATABASE_URL"] {
		t.Fatal("AI_DATABASE_URL was not retained for query composition")
	}
	if _, ok := cfg.providerEnv["AI_DATABASE_URL"]; ok {
		t.Fatal("AI_DATABASE_URL was forwarded to provider configuration")
	}
	if cfg.providerEnv["NVIDIA_API_KEY"] != "nvidia" || cfg.providerEnv["GOOGLE_GENERATIVE_AI_API_KEYS"] != "google" {
		t.Fatalf("provider env did not receive file values: %#v", cfg.providerEnv)
	}
	if cfg.providerEnv["NVIDIA_API_KEY_FILE"] == "" || cfg.providerEnv["GOOGLE_GENERATIVE_AI_API_KEYS_FILE"] == "" {
		t.Fatal("file path contract was removed")
	}
}

func TestLoadRuntimeConfigRequiresExternalPoolerURLContract(t *testing.T) {
	for _, tc := range []struct {
		name string
		url  string
	}{
		{name: "missing URL"},
		{name: "wrong role", url: "postgresql://postgres:secret@pooler.example:6543/postgres?sslmode=require"},
		{name: "wrong port", url: "postgresql://ai_query_tool:secret@pooler.example:5432/postgres?sslmode=require"},
		{name: "wrong database", url: "postgresql://ai_query_tool:secret@pooler.example:6543/app?sslmode=require"},
		{name: "TLS disabled", url: "postgresql://ai_query_tool:secret@pooler.example:6543/postgres?sslmode=disable"},
		{name: "local host", url: "postgresql://ai_query_tool:secret@localhost:6543/postgres?sslmode=require"},
		{name: "loopback address", url: "postgresql://ai_query_tool:secret@127.0.0.1:6543/postgres?sslmode=require"},
		{name: "wrong role prefix", url: "postgresql://ai_query_tool_admin:secret@pooler.example:6543/postgres?sslmode=require"},
		{name: "missing password", url: "postgresql://ai_query_tool@pooler.example:6543/postgres?sslmode=require"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env, cleanup := validRuntimeEnv(t)
			defer cleanup()
			env["AI_DATABASE_URL"] = tc.url
			if _, err := loadRuntimeConfig(env); err == nil {
				t.Fatal("invalid external-pooler configuration was accepted")
			} else if strings.Contains(err.Error(), "secret") {
				t.Fatalf("configuration error exposed credential data: %v", err)
			}
		})
	}

	for _, username := range []string{"ai_query_tool", "ai_query_tool.projectref"} {
		t.Run("accepted pooler user "+username, func(t *testing.T) {
			env, cleanup := validRuntimeEnv(t)
			defer cleanup()
			env["AI_DATABASE_URL"] = "postgresql://" + username + ":secret@pooler.example:6543/postgres?sslmode=require"
			if _, err := loadRuntimeConfig(env); err != nil {
				t.Fatalf("valid external-pooler configuration rejected: %v", err)
			}
		})
	}
}

func TestPoolerStartupLogUsesRedactedDiagnostic(t *testing.T) {
	_, err := composition.OpenPoolerQueryExecutor(context.Background(), "postgresql://ai_query_tool:authority-secret@pooler.example:6543/postgres?sslmode=require", 0)
	if err == nil || err.Error() != "external pooler query executor is unavailable" {
		t.Fatalf("pooler error = %v", err)
	}
	previous := log.Writer()
	var output bytes.Buffer
	log.SetOutput(&output)
	t.Cleanup(func() { log.SetOutput(previous) })
	logPoolerConnectionFailure(err)
	if !strings.Contains(output.String(), "stage=configuration cause=sql_invalid_limits") {
		t.Fatalf("pooler diagnostic missing from startup log: %s", output.String())
	}
	if strings.Contains(output.String(), "authority-secret") {
		t.Fatalf("pooler startup log exposed credentials: %s", output.String())
	}
}

func TestRuntimeHandlerReadinessFailsClosedWhenConfigIsInvalid(t *testing.T) {
	runtime := newServiceRuntime(map[string]string{})
	if runtime == nil || runtime.handler == nil {
		t.Fatal("invalid config did not produce a health-capable runtime")
	}
	response := httptest.NewRecorder()
	runtime.handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable || !strings.Contains(response.Body.String(), "not_ready") {
		t.Fatalf("invalid config readiness = %d %s", response.Code, response.Body.String())
	}
	health := httptest.NewRecorder()
	runtime.handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if health.Code != http.StatusOK {
		t.Fatalf("invalid config health = %d", health.Code)
	}
}

func TestRuntimeHandlerReadinessFailsClosedWhenDatabaseURLIsMissing(t *testing.T) {
	env, cleanup := validRuntimeEnv(t)
	defer cleanup()
	delete(env, "AI_DATABASE_URL")
	runtime := newServiceRuntime(env)
	if runtime == nil || runtime.configErr == nil {
		t.Fatalf("missing AI_DATABASE_URL did not fail runtime configuration closed: %#v", runtime)
	}
	if runtime.handler.ConfigReady == nil || runtime.handler.ConfigReady() {
		t.Fatal("empty capability registry was reported ready")
	}
	response := httptest.NewRecorder()
	runtime.handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("restart quarantine readiness = %d %s, want fail-closed", response.Code, response.Body.String())
	}
}

func TestBuildTargetCompiles(t *testing.T) {
	output := filepath.Join(t.TempDir(), "ai-service")
	command := exec.Command("go", "build", "-o", output, ".")
	command.Dir = "."
	if result, err := command.CombinedOutput(); err != nil {
		t.Fatalf("go build . = %v\n%s", err, result)
	}
}

func TestRuntimeLifecycleUsesBoundedStop(t *testing.T) {
	runtime := newServiceRuntime(map[string]string{})
	if runtime == nil || runtime.lifecycle == nil {
		t.Fatal("runtime lifecycle missing")
	}
	if runtime.lifecycle.StopTimeout() <= 0 {
		t.Fatal("runtime stop timeout was not configured")
	}
}

func TestPrivateListenAddrRejectsPublicBind(t *testing.T) {
	if _, err := privateListenAddr("0.0.0.0:8080"); err == nil {
		t.Fatal("public listen address was accepted")
	}
	if address, err := privateListenAddr("127.0.0.1:8080"); err != nil || address != "127.0.0.1:8080" {
		t.Fatalf("loopback listen address = %q, %v", address, err)
	}
}

func TestCleanupGraceCannotExceedBoundedBudget(t *testing.T) {
	env, cleanup := validRuntimeEnv(t)
	defer cleanup()
	env["AI_DATABASE_URL"] = "postgresql://ai_query_tool:secret@pooler.example:6543/postgres?sslmode=require"
	env["AI_SERVICE_CLEANUP_GRACE"] = "6s"
	if _, err := loadRuntimeConfig(env); err == nil {
		t.Fatal("cleanup grace exceeded bounded budget")
	}
}

func validRuntimeEnv(t *testing.T) (map[string]string, func()) {
	t.Helper()
	dir := t.TempDir()
	values := map[string]string{
		"AI_SERVICE_HMAC_SECRET_FILE":        "hmac-secret",
		"AI_SERVICE_BROKER_SECRET_FILE":      "broker-secret",
		"NVIDIA_API_KEY_FILE":                "nvidia-key",
		"GOOGLE_GENERATIVE_AI_API_KEYS_FILE": "google-key",
	}
	env := map[string]string{
		"AI_SERVICE_HMAC_KEY_ID":        "key-1",
		"AI_PROVIDER_CHAIN":             "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite",
		"NVIDIA_BASE_URL":               "https://nvidia.invalid/v1/chat/completions",
		"GOOGLE_GENERATIVE_AI_BASE_URL": "https://google.invalid",
		"AI_SERVICE_DRAIN_GRACE":        "60s",
		"AI_SERVICE_CLEANUP_GRACE":      "5s",
		"AI_SERVICE_MAX_CONCURRENT":     "2",
	}
	for name, value := range values {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte(value), 0o400); err != nil {
			t.Fatal(err)
		}
		env[name] = path
	}
	return env, func() {}
}
