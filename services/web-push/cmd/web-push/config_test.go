package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRuntimeConfigRetainsLegacyEnvironment(t *testing.T) {
	values := map[string]string{
		"WEB_PUSH_ORIGIN": "https://legacy.example", "WEB_PUSH_HMAC_KEY_ID": "slot",
		"WEB_PUSH_HMAC_SECRET": "secret", "WEB_PUSH_PAUSED": "false",
		"WEB_PUSH_VAPID_KEY_VERSION": "v1", "WEB_PUSH_VAPID_SUBJECT": "mailto:legacy@example.test",
	}
	configs, address, multi, err := loadRuntimeConfig(valuesGet(values))
	if err != nil || multi || address != defaultHealthAddress || len(configs) != 1 {
		t.Fatalf("legacy config: apps=%d address=%q multi=%v err=%v", len(configs), address, multi, err)
	}
	cfg := configs[0]
	if cfg.ID != "qltbyt" || cfg.Paused || cfg.Origin != values["WEB_PUSH_ORIGIN"] || cfg.HMACSecret != values["WEB_PUSH_HMAC_SECRET"] || cfg.VAPIDPath != "/run/secrets/web_push_vapid_private_key" {
		t.Fatal("legacy configuration/defaults changed")
	}
}

func TestRuntimeFileConfigIsExplicitAndPausedByDefault(t *testing.T) {
	path := filepath.Join(t.TempDir(), "apps.json")
	if err := os.WriteFile(path, []byte(`[{"id":"app-a","origin":"https://a.example"},{"id":"app-b","paused":false}]`), 0600); err != nil {
		t.Fatal(err)
	}
	values := map[string]string{
		"WEB_PUSH_APPS_CONFIG_PATH": path, "WEB_PUSH_ORIGIN": "https://ignored.example",
		"WEB_PUSH_PAUSED": "unclear", "WEB_PUSH_HMAC_SECRET": "must-not-inherit",
	}
	configs, _, multi, err := loadRuntimeConfig(valuesGet(values))
	if err != nil || !multi || len(configs) != 2 {
		t.Fatalf("file configuration: multi=%v apps=%d err=%v", multi, len(configs), err)
	}
	if !configs[0].Paused || configs[1].Paused || configs[0].HMACSecret != "" || configs[1].Origin != "" || configs[0].WorkerID != "oracle-web-push-1" {
		t.Fatal("file mode lost default pause or inherited legacy values")
	}
	values["WEB_PUSH_APPS_CONFIG_PATH"] += ".missing"
	if _, _, _, err := loadRuntimeConfig(valuesGet(values)); err == nil {
		t.Fatal("missing file fell back to legacy environment")
	}
	values["WEB_PUSH_HEALTH_ADDR"] = "0.0.0.0:8080"
	if _, _, _, err := loadRuntimeConfig(valuesGet(values)); err == nil {
		t.Fatal("file configuration allowed public health binding")
	}
}

func TestRuntimeFileConfigRejectsAmbiguousUnboundedOrMalformedInput(t *testing.T) {
	for _, input := range []string{
		`null`, `{}`, `[]`, `[null]`, `[{}]`, `[{"id":"APP"}]`,
		`[{"id":"a","Paused":false}]`, `[{"id":"a","unknown":true}]`,
		`[{"id":"a","id":"b"}]`, `[{"id":"a","paused":true,"paused":false}]`,
		`[{"id":"a","paused":null}]`, `[{"id":"a","paused":"false"}]`,
		`[{"id":"a","origin":12}]`, `[{"id":"a"}] []`, `[{"id":"a"}] trailing`,
		`[{"id":"a"}`, `[{"id":"a","origin":{}}]`,
		"[" + strings.Repeat(`{"id":"a"},`, 16) + `{"id":"b"}]`,
		strings.Repeat(" ", maxAppsConfigBytes+1),
	} {
		t.Run(input[:min(len(input), 60)], func(t *testing.T) {
			if _, err := readAppConfigs(strings.NewReader(input)); err == nil {
				t.Fatal("accepted invalid file configuration")
			}
		})
	}
}
