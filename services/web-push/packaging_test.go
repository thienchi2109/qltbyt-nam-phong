package webpush

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// Opt-in Linux Docker rehearsal. All secrets/sources are synthetic; no public
// provider is contacted. The production Sender rejects the private endpoint.
// ponytail: one job per source checks handoff, not throughput or durable storage.
func TestPackagingImageHandoff(t *testing.T) {
	image := os.Getenv("WEB_PUSH_PACKAGING_IMAGE")
	if image == "" {
		t.Skip("set WEB_PUSH_PACKAGING_IMAGE to a locally built image")
	}
	rollback := os.Getenv("WEB_PUSH_ROLLBACK_IMAGE")
	if rollback == "" {
		t.Fatal("set WEB_PUSH_ROLLBACK_IMAGE to an immutable prior-source artifact")
	}
	listener, err := net.Listen("tcp", "127.0.0.1:8080")
	if err != nil {
		t.Fatalf("rehearsal requires unused host loopback port 8080: %v", err)
	}
	_ = listener.Close()
	image = strings.TrimSpace(packagingDocker(t, "image", "inspect", "--format", "{{.Id}}", image))
	rollback = strings.TrimSpace(packagingDocker(t, "image", "inspect", "--format", "{{.Id}}", rollback))
	t.Logf("candidate=%s rollback=%s", image, rollback)
	_, a := secondAppBinding(t, "equipment-fixture", 1, `{"kind":"equipment-due"}`)
	_, b := secondAppBinding(t, "results-fixture", 2, `{"kind":"assay-ready"}`)
	initialA, initialB := a.snapshot().subscription, b.snapshot().subscription
	secrets := t.TempDir()
	// Docker Compose bind secrets do not remap uid/mode. Match the actual
	// scratch UID rather than making secrets world-readable.
	if err := os.Chmod(secrets, 0755); err != nil {
		t.Fatal(err)
	}
	var certificates []byte
	for _, source := range []*secondAppSource{a, b} {
		server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != claimPath {
				source.serveHTTP(w, r)
				return
			}
			recorder := httptest.NewRecorder()
			source.serveHTTP(recorder, r)
			if recorder.Code != http.StatusOK {
				for key, values := range recorder.Header() {
					w.Header()[key] = values
				}
				w.WriteHeader(recorder.Code)
				_, _ = w.Write(recorder.Body.Bytes())
				return
			}
			var response qltbytClaimResponse
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Error(err)
				w.WriteHeader(500)
				return
			}
			for i := range response.Deliveries {
				response.Deliveries[i].Endpoint = "https://127.0.0.1/never-contacted"
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(response)
		}))
		t.Cleanup(server.Close)
		certificates = append(certificates, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})...)
		source.cfg.Origin = server.URL
		key, err := os.ReadFile(source.cfg.VAPIDPath)
		if err != nil {
			t.Fatal(err)
		}
		filename := source.cfg.ID + ".key"
		packagingSecret(t, secrets, filename, key)
		source.cfg.VAPIDPath = "/run/secrets/" + filename
	}
	packagingSecret(t, secrets, "ca.pem", certificates)
	legacy := func(cfg AppConfig) []byte {
		return []byte(fmt.Sprintf("SSL_CERT_FILE=/run/secrets/ca.pem\nWEB_PUSH_ORIGIN=%s\nWEB_PUSH_WORKER_ID=%s\nWEB_PUSH_PAUSED=false\nWEB_PUSH_HMAC_KEY_ID=%s\nWEB_PUSH_HMAC_SECRET=%s\nWEB_PUSH_VAPID_PRIVATE_KEY_PATH=%s\nWEB_PUSH_VAPID_KEY_VERSION=%s\nWEB_PUSH_VAPID_PUBLIC_KEY=%s\nWEB_PUSH_VAPID_FINGERPRINT=%s\nWEB_PUSH_VAPID_SUBJECT=%s\n", cfg.Origin, cfg.WorkerID, cfg.HMACKeyID, cfg.HMACSecret, cfg.VAPIDPath, cfg.VAPIDVersion, cfg.VAPIDPublicKey, cfg.VAPIDFingerprint, cfg.VAPIDSubject))
	}
	packagingSecret(t, secrets, "legacy.env", legacy(a.cfg))
	blocked := make(chan struct{}, 1)
	a.blockReport = blocked
	old := packagingStart(t, rollback, secrets, "legacy.env")
	packagingAwait(t, func() bool { return len(blocked) == 1 })
	first := a.snapshot()
	packagingStop(t, old)
	if first.job.attempt != 1 || first.job.done || first.applyCount != 0 {
		t.Fatal("prior process did not leave an unreported lease/backlog")
	}
	a.mu.Lock()
	a.blockReport = nil
	a.mu.Unlock()
	badB := b.cfg
	badB.HMACSecret = base64.StdEncoding.EncodeToString(make([]byte, 32))
	data, err := json.Marshal([]AppConfig{a.cfg, badB})
	if err != nil {
		t.Fatal(err)
	}
	packagingSecret(t, secrets, "apps.json", data)
	packagingSecret(t, secrets, "multi.env", []byte("SSL_CERT_FILE=/run/secrets/ca.pem\nWEB_PUSH_APPS_CONFIG_PATH=/run/secrets/apps.json\n"))
	current := packagingStart(t, image, secrets, "multi.env")
	packagingAwait(t, func() bool {
		codeA, _ := packagingGet("/readyz/equipment-fixture")
		codeB, bodyB := packagingGet("/readyz/results-fixture")
		return codeA == 200 && codeB == 503 && strings.Contains(bodyB, "stopped")
	})
	code, body := packagingGet("/readyz")
	if code != 503 || !strings.Contains(body, `"ready":false`) || a.snapshot().job.attempt != 1 || b.snapshot().job.attempt != 0 {
		t.Fatal("required app failure/lease fencing did not survive the artifact handoff")
	}
	code, body = packagingGet("/metrics")
	if code != 200 || !strings.Contains(body, `app_id="equipment-fixture"`) || !strings.Contains(body, `app_id="results-fixture"`) {
		t.Fatal("per-app metrics are missing")
	}
	packagingStop(t, current)
	// Terminal workers recover only after a real config correction + restart.
	// B exercises delivery/report in the candidate while A's old lease remains.
	data, err = json.Marshal([]AppConfig{a.cfg, b.cfg})
	if err != nil {
		t.Fatal(err)
	}
	packagingSecret(t, secrets, "apps.json", data)
	current = packagingStart(t, image, secrets, "multi.env")
	packagingAwait(t, func() bool { code, _ := packagingGet("/readyz"); return b.snapshot().job.done && code == 200 })
	if a.snapshot().job.attempt != 1 || a.snapshot().applyCount != 0 || b.snapshot().applyCount != 1 ||
		b.snapshot().reports[0].Outcome != "unsafe_endpoint" || b.snapshot().subscription != initialB {
		t.Fatal("candidate did not recover its own source without changing the other source lease")
	}
	packagingStop(t, current)
	// Advance only the fixture source clock; never sleep out a production lease
	// or reset its token/attempt/subscription. Existing WP06 tests cover stale reports.
	a.mu.Lock()
	a.state.now = first.job.lease.Add(time.Second)
	a.mu.Unlock()
	old = packagingStart(t, rollback, secrets, "legacy.env")
	packagingAwait(t, func() bool { return a.snapshot().job.done })
	code, body = packagingGet("/readyz")
	if code != 200 || strings.TrimSpace(body) != "ready" {
		t.Fatalf("legacy readiness semantics changed: %d %q", code, body)
	}
	packagingStop(t, old)
	state := a.snapshot()
	if state.job.attempt != 2 || state.job.token == first.job.token || state.applyCount != 1 ||
		state.reports[0].Outcome != "unsafe_endpoint" || state.subscription != initialA ||
		b.snapshot().subscription != initialB || !b.snapshot().job.done || b.snapshot().job.attempt != 1 || b.snapshot().applyCount != 1 {
		t.Fatal("rollback lost source subscriptions, pending work, or attempt fencing")
	}
	// Smoke the new production artifact in legacy mode too, after historical
	// rollback. This is a separate configuration check, not a second rollback.
	current = packagingStart(t, image, secrets, "legacy.env")
	packagingAwait(t, func() bool {
		code, body := packagingGet("/readyz")
		return code == 200 && strings.TrimSpace(body) == "ready"
	})
	packagingStop(t, current)
	t.Log("single prior artifact -> multi candidate (one auth failure) -> single prior: source subscription/outbox preserved; private provider rejected; no real send/consent/device proof")
}

func packagingSecret(t *testing.T, directory, name string, data []byte) {
	t.Helper()
	path := filepath.Join(directory, name)
	if err := os.WriteFile(path, data, 0400); err != nil {
		t.Fatal(err)
	}
	if err := os.Chown(path, 65532, 65532); err != nil {
		t.Fatalf("fixture needs ownership matching container UID 65532: %v", err)
	}
}

func packagingDocker(t *testing.T, args ...string) string {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "docker", args...).CombinedOutput()
	if err != nil {
		// Never dump env-file contents or inspect environment with HMAC secrets.
		t.Fatalf("docker %s failed: %v: %.2048s", args[0], err, out)
	}
	return string(out)
}

func packagingStart(t *testing.T, image, directory, env string) string {
	t.Helper()
	name := fmt.Sprintf("wp08-rehearsal-%d", time.Now().UnixNano())
	// Register before start so even a partially successful docker run is cleaned.
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		out, err := exec.CommandContext(ctx, "docker", "rm", "-f", name).CombinedOutput()
		if err != nil {
			t.Errorf("task container cleanup %s failed: %v: %.1024s", name, err, out)
		}
	})
	id := strings.TrimSpace(packagingDocker(t, "run", "-d", "--name", name, "--label", "qltbyt.wp08=rehearsal", "--network", "host", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--env-file", filepath.Join(directory, env), "--mount", "type=bind,source="+directory+",target=/run/secrets,readonly", image))
	t.Logf("container=%s id=%s image=%s mode=%s", name, id, image, env)
	packagingAwait(t, func() bool { code, _ := packagingGet("/healthz"); return code == 200 })
	return name
}

func packagingStop(t *testing.T, name string) {
	t.Helper()
	started := time.Now()
	packagingDocker(t, "stop", "--time", "15", name)
	state := strings.TrimSpace(packagingDocker(t, "inspect", "--format", "{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Running}}", name))
	if state != "0 false false" || time.Since(started) >= 15*time.Second {
		t.Fatalf("shutdown was not graceful: %s", state)
	}
	t.Logf("stopped=%s elapsed=%s exit=0", name, time.Since(started).Round(time.Millisecond))
}

func packagingGet(path string) (int, string) {
	client := &http.Client{Timeout: time.Second, Transport: &http.Transport{Proxy: nil}}
	defer client.CloseIdleConnections()
	response, err := client.Get("http://127.0.0.1:8080" + path)
	if err != nil {
		return 0, ""
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(response.Body, 32*1024))
	return response.StatusCode, string(body)
}

func packagingAwait(t *testing.T, ready func() bool) {
	t.Helper()
	deadline := time.Now().Add(15 * time.Second)
	for time.Now().Before(deadline) {
		if ready() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("rehearsal condition did not become true within 15s")
}
