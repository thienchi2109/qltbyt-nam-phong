package main

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

func TestAppConfigDefaultsToPaused(t *testing.T) {
	values := map[string]string{
		"WEB_PUSH_VAPID_KEY_VERSION": "staging-20260910-01",
		"WEB_PUSH_VAPID_PUBLIC_KEY":  "public",
		"WEB_PUSH_VAPID_FINGERPRINT": "sha256:fingerprint",
		"WEB_PUSH_VAPID_SUBJECT":     "mailto:test@example.test",
	}
	cfg, err := loadConfig(valuesGet(values))
	if err != nil {
		t.Fatalf("loadConfig() error = %v", err)
	}
	if !cfg.paused {
		t.Fatal("loadConfig() paused = false, want true")
	}
	if cfg.healthAddress != defaultHealthAddress {
		t.Fatalf("health address = %q, want %q", cfg.healthAddress, defaultHealthAddress)
	}
	if cfg.appID != "qltbyt" || cfg.workerID != "oracle-web-push-1" || cfg.vapidVersion != values["WEB_PUSH_VAPID_KEY_VERSION"] || cfg.vapidPublicKey != values["WEB_PUSH_VAPID_PUBLIC_KEY"] || cfg.vapidFingerprint != values["WEB_PUSH_VAPID_FINGERPRINT"] {
		t.Fatal("legacy configuration changed identity, worker or VAPID artifact")
	}
}

func TestAppConfigUsesOperatorIdentityAcrossCredentialRotation(t *testing.T) {
	values := map[string]string{"WEB_PUSH_APP_ID": "another-app", "WEB_PUSH_HMAC_KEY_ID": "old-slot"}
	before, err := loadConfig(valuesGet(values))
	if err != nil {
		t.Fatal(err)
	}
	values["WEB_PUSH_HMAC_KEY_ID"] = "new-slot"
	after, err := loadConfig(valuesGet(values))
	if err != nil || before.appID != "another-app" || after.appID != before.appID || after.hmacKeyID != "new-slot" {
		t.Fatal("credential rotation changed trusted operator app identity")
	}
}

func TestAppConfigInvalidPauseFailsClosed(t *testing.T) {
	values := map[string]string{
		"WEB_PUSH_PAUSED":            "unclear",
		"WEB_PUSH_VAPID_KEY_VERSION": "staging-20260910-01",
		"WEB_PUSH_VAPID_PUBLIC_KEY":  "public",
		"WEB_PUSH_VAPID_FINGERPRINT": "sha256:fingerprint",
		"WEB_PUSH_VAPID_SUBJECT":     "mailto:test@example.test",
	}
	cfg, err := loadConfig(valuesGet(values))
	if err == nil || !cfg.paused {
		t.Fatalf("loadConfig() = %+v, %v; want paused error", cfg, err)
	}
}

func TestAppConfigRejectsInvalidAppIdentity(t *testing.T) {
	for _, appID := range []string{"tenant/42", "APP", "qltbyt\nsecond", strings.Repeat("a", 65)} {
		t.Run(appID, func(t *testing.T) {
			if _, err := loadConfig(valuesGet(map[string]string{"WEB_PUSH_APP_ID": appID})); err == nil {
				t.Fatal("loadConfig accepted an invalid operator app identity")
			}
		})
	}
}

func TestStartupErrorLogRedactsRawError(t *testing.T) {
	var output bytes.Buffer
	raw := errors.New("private-key-secret endpoint=https://push.example.test")
	writeStartupError(&output, "vapid_unavailable", raw)
	if strings.Contains(output.String(), "private-key-secret") || strings.Contains(output.String(), "push.example.test") {
		t.Fatalf("startup log leaked raw error: %q", output.String())
	}
	if !strings.Contains(output.String(), "vapid_unavailable") {
		t.Fatalf("startup log omitted stable code: %q", output.String())
	}
}

func TestStartupErrorCodeIsBounded(t *testing.T) {
	var output bytes.Buffer
	writeStartupError(&output, "bad code\nendpoint", errors.New("raw"))
	if got := output.String(); got != "web_push_error code=internal_error\n" {
		t.Fatalf("bounded startup log = %q", got)
	}
}

func TestGetenvUsesFallback(t *testing.T) {
	if got := getenv("WEB_PUSH_TEST_MISSING", "paused"); got != "paused" {
		t.Fatalf("getenv() = %q, want fallback", got)
	}
}

func valuesGet(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}
