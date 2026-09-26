package ingress

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"example.com/shared-ai-service/fixtures/secondapp"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

func TestHandlerPreservesIncomingDeadline(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-deadline", Secret: []byte("secret-deadline"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	reg := registry.New()
	if err := reg.Register(secondapp.Capability{}); err != nil {
		t.Fatal(err)
	}
	var seenDeadline time.Time
	handler := &Handler{
		Guard:     NewReplayGuard(started, []Key{key}),
		Registry:  reg,
		Admission: NewAdmission(16),
		Now:       time.Now,
		Runner: &orchestration.Runner{
			Registry: reg,
			Usage:    usage.NewMemory(time.Now),
			Open: func(ctx context.Context, _ protocol.Request) (orchestration.ModelSession, error) {
				seenDeadline, _ = ctx.Deadline()
				return openSession{chat: &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
					return testmodel.UsageMessage("ok", "stop", 1, 1), nil
				}}}, nil
			},
		},
	}
	request := signedRequest(key, time.Now(), "deadline-request")
	originalDeadline := time.Now().Add(6 * time.Second)
	httpRequest := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(request.body)))
	httpRequest = httpRequest.WithContext(mustDeadlineContext(t, httpRequest.Context(), originalDeadline))
	copyHeaders(httpRequest, request.header)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httpRequest)
	if seenDeadline.IsZero() {
		t.Fatal("runner context had no deadline")
	}
	if seenDeadline.After(originalDeadline.Add(-protocol.CleanupBudget)) {
		t.Fatalf("deadline did not reserve cleanup: got %s after work deadline %s", seenDeadline, originalDeadline.Add(-protocol.CleanupBudget))
	}
}

func TestAdmissionRejectsBeforeSecondProviderOpen(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-admission", Secret: []byte("secret-admission"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	startedProvider := make(chan struct{})
	releaseProvider := make(chan struct{})
	chat := &testmodel.Scripted{StreamFunc: func(ctx context.Context, _ []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
		close(startedProvider)
		reader, writer := schema.Pipe[*schema.Message](1)
		go func() {
			<-releaseProvider
			_ = writer.Send(nil, errors.New("provider released"))
			writer.Close()
		}()
		return reader, nil
	}}
	handler := testHandler(t, started, key, &opens, chat)
	handler.Admission = NewAdmission(1)
	first := signedRequest(key, time.Now(), "admission-1")
	second := signedRequest(key, time.Now(), "admission-2")
	firstRequest := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(first.body)))
	copyHeaders(firstRequest, first.header)
	firstDone := make(chan struct{})
	go func() {
		handler.ServeHTTP(httptest.NewRecorder(), firstRequest)
		close(firstDone)
	}()
	select {
	case <-startedProvider:
	case <-time.After(time.Second):
		t.Fatal("first provider did not start")
	}
	secondResponse := post(handler, second)
	if secondResponse.Code != http.StatusServiceUnavailable {
		t.Fatalf("second status = %d body = %s", secondResponse.Code, secondResponse.Body.String())
	}
	if opens.Load() != 1 {
		t.Fatalf("provider opens = %d", opens.Load())
	}
	if handler.Guard.Contains("admission-2") {
		t.Fatal("rejected admission retained a live nonce")
	}
	close(releaseProvider)
	select {
	case <-firstDone:
	case <-time.After(time.Second):
		t.Fatal("first request did not finish")
	}
}

func TestReadyProbeStaysFalseDuringReplayQuarantine(t *testing.T) {
	started := time.Now()
	key := Key{ID: "key-probe", Secret: []byte("secret-probe"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	handler := &Handler{Guard: NewReplayGuard(started, []Key{key}), Registry: registry.New(), Admission: NewAdmission(16), Runner: &orchestration.Runner{}}
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable || !strings.Contains(response.Body.String(), "not_ready") {
		t.Fatalf("ready probe = %d %s", response.Code, response.Body.String())
	}
	health := httptest.NewRecorder()
	handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if health.Code != http.StatusOK {
		t.Fatalf("health probe = %d", health.Code)
	}
}

func TestReadyProbeStaysFalseWhenAdmissionCannotAdmit(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-probe-capacity", Secret: []byte("secret-probe-capacity"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	handler := testHandler(t, started, key, &opens, &testmodel.Scripted{})
	handler.Admission = NewAdmission(0)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable || !strings.Contains(response.Body.String(), "not_ready") {
		t.Fatalf("ready probe = %d %s", response.Code, response.Body.String())
	}
}

func TestZeroAdmissionRejectsBeforeProvider(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-zero-admission", Secret: []byte("secret-zero-admission"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	handler := testHandler(t, started, key, &opens, &testmodel.Scripted{})
	handler.Admission = NewAdmission(0)
	response := post(handler, signedRequest(key, time.Now(), "zero-admission"))
	if response.Code != http.StatusServiceUnavailable || opens.Load() != 0 {
		t.Fatalf("zero admission = %d opens=%d body=%s", response.Code, opens.Load(), response.Body.String())
	}
}

func TestMissingAdmissionRejectsAndStaysUnready(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-missing-admission", Secret: []byte("secret-missing-admission"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	handler := testHandler(t, started, key, &opens, &testmodel.Scripted{})
	handler.Admission = nil
	ready := httptest.NewRecorder()
	handler.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if ready.Code != http.StatusServiceUnavailable {
		t.Fatalf("ready status = %d body=%s", ready.Code, ready.Body.String())
	}
	response := post(handler, signedRequest(key, time.Now(), "missing-admission"))
	if response.Code != http.StatusServiceUnavailable || opens.Load() != 0 {
		t.Fatalf("missing admission = %d opens=%d body=%s", response.Code, opens.Load(), response.Body.String())
	}
}

func TestEmptyReplayKeyRegistryStaysUnready(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	guard := NewReplayGuard(started, nil)
	if guard.Ready(time.Now()) {
		t.Fatal("empty replay key registry became ready")
	}
}

func TestReplayKeyRegistryRejectsInvalidOrDuplicateEntriesForReadiness(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	valid := Key{ID: "key-registry", Secret: []byte("secret"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	for name, keys := range map[string][]Key{
		"malformed": {valid, {ID: " bad-key", Secret: []byte("secret"), Issuer: valid.Issuer, Audience: valid.Audience, AppID: valid.AppID, CapabilityID: valid.CapabilityID}},
		"duplicate": {valid, valid},
	} {
		t.Run(name, func(t *testing.T) {
			if NewReplayGuard(started, keys).Ready(time.Now()) {
				t.Fatal("invalid replay key registry became ready")
			}
		})
	}
}

func TestWriteStreamRawReturnsWriterError(t *testing.T) {
	want := errors.New("client disconnected")
	err := writeStreamRaw(failingWriter{err: want}, `{"type":"start"}`)
	if !errors.Is(err, want) {
		t.Fatalf("write error = %v, want %v", err, want)
	}
}

func TestHandlerWriteEventsPropagatesDisconnect(t *testing.T) {
	log := &captureLog{}
	err := (&Handler{Log: log}).writeEvents(failingWriter{err: errors.New("client disconnected")}, "req-write", []protocol.Event{{Type: protocol.EventStart}})
	if err == nil || !strings.Contains(log.text(), "req-write client_disconnected") {
		t.Fatalf("write events error=%v log=%q", err, log.text())
	}
}

func TestHandlerLogsAndStopsOnStreamDisconnect(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-http-write", Secret: []byte("secret-http-write"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	chat := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return testmodel.UsageMessage("hello", "stop", 1, 1), nil
	}}
	handler := testHandler(t, started, key, &opens, chat)
	log := &captureLog{}
	handler.Log = log
	request := signedRequest(key, time.Now(), "http-disconnect")
	httpRequest := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(request.body)))
	copyHeaders(httpRequest, request.header)
	handler.ServeHTTP(failingWriter{err: errors.New("client disconnected")}, httpRequest)
	if opens.Load() != 1 || !strings.Contains(log.text(), "http-disconnect client_disconnected") {
		t.Fatalf("provider opens=%d log=%q", opens.Load(), log.text())
	}
}

func TestUIChunksFinishAfterArtifactsAndDone(t *testing.T) {
	chunks, _ := uiChunks("req-order", []protocol.Event{
		{Type: protocol.EventStart},
		{Type: protocol.EventArtifact, ToolName: "repairRequestDraft", Payload: []byte(`{"draftOnly":true}`)},
		{Type: protocol.EventFinish},
	})
	if len(chunks) != 3 || chunks[1].Type != "data-artifact" || chunks[2].Type != "finish" {
		t.Fatalf("chunks = %+v", chunks)
	}
}

func TestHMACRejectsMismatchedTrustedCapabilityClaim(t *testing.T) {
	started := time.Now().Add(-Quarantine - time.Second)
	key := Key{ID: "key-claims", Secret: []byte("secret-claims"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	guard := NewReplayGuard(started, []Key{key})
	request := signedRequest(key, time.Now(), "claim-request")
	request.body = []byte(strings.Replace(string(request.body), `"audience":"ai-service-v1"`, `"audience":"ai-service-v1","trusted_app":{"app_id":"second-app","capability_ids":["other"]}`, 1))
	timestamp := request.header.Get(HeaderTimestamp)
	request.header.Set(HeaderSignature, Sign(key.Secret, timestamp, "claim-request", key.ID, request.body))
	if _, err := guard.Authenticate(time.Now(), request.header, request.body); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("trusted capability claim error = %v", err)
	}
}

type failingWriter struct {
	err    error
	header http.Header
	status int
}

func (w failingWriter) Header() http.Header {
	if w.header == nil {
		return make(http.Header)
	}
	return w.header
}
func (w failingWriter) WriteHeader(status int) { w.status = status }
func (w failingWriter) Write([]byte) (int, error) {
	return 0, w.err
}

func mustDeadlineContext(t *testing.T, parent context.Context, deadline time.Time) context.Context {
	t.Helper()
	ctx, cancel := context.WithDeadline(parent, deadline)
	t.Cleanup(cancel)
	return ctx
}

var _ model.ToolCallingChatModel = (*testmodel.Scripted)(nil)
