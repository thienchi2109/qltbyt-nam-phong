package ingress

import (
	"context"
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

func TestDuplicateSignedRequestDoesNotOpenProviderTwice(t *testing.T) {
	started := time.Unix(1_700_000_000, 0).UTC()
	now := started.Add(Quarantine)
	key := Key{ID: "key-1", Secret: []byte("secret-1"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	handler := testHandler(t, started, key, &opens, &testmodel.Scripted{})
	request := signedRequest(key, now, "same-request")
	first := post(handler, request)
	if first.Code != http.StatusOK || !strings.Contains(first.Body.String(), "ok") {
		t.Fatalf("first = %d %s", first.Code, first.Body.String())
	}
	second := post(handler, request)
	if second.Code != http.StatusConflict || opens.Load() != 1 {
		t.Fatalf("second = %d opens %d body %s", second.Code, opens.Load(), second.Body.String())
	}
}

func TestCancelStopsProviderWithoutAnotherOpen(t *testing.T) {
	startedAt := time.Unix(1_700_000_000, 0).UTC()
	now := startedAt.Add(Quarantine)
	key := Key{ID: "key-1", Secret: []byte("secret-1"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	started := make(chan struct{})
	modelStub := &testmodel.Scripted{StreamFunc: func(ctx context.Context, _ []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
		close(started)
		<-ctx.Done()
		return nil, ctx.Err()
	}}
	handler := testHandler(t, startedAt, key, &opens, modelStub)
	request := signedRequest(key, now, "cancel-request")
	ctx, cancel := context.WithCancel(context.Background())
	httpRequest := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(request.body))).WithContext(ctx)
	copyHeaders(httpRequest, request.header)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		handler.ServeHTTP(recorder, httpRequest)
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("provider did not start")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return after cancel")
	}
	if opens.Load() != 1 {
		t.Fatalf("opens = %d", opens.Load())
	}
}

func TestQuarantineDoesNotOpenProvider(t *testing.T) {
	started := time.Unix(1_700_000_000, 0).UTC()
	key := Key{ID: "key-1", Secret: []byte("secret-1"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: secondapp.AppID, CapabilityID: secondapp.CapabilityID}
	var opens atomic.Int32
	handler := testHandler(t, started, key, &opens, &testmodel.Scripted{})
	request := signedRequest(key, started.Add(Quarantine), "during-quarantine")
	response := postAt(handler, request, started)
	if response.Code != http.StatusServiceUnavailable || opens.Load() != 0 {
		t.Fatalf("status %d opens %d", response.Code, opens.Load())
	}
}

func testHandler(t *testing.T, started time.Time, key Key, opens *atomic.Int32, chat model.ToolCallingChatModel) *Handler {
	t.Helper()
	reg := registry.New()
	if err := reg.Register(secondapp.Capability{}); err != nil {
		t.Fatal(err)
	}
	return &Handler{
		Guard:    NewReplayGuard(started, []Key{key}),
		Registry: reg,
		Now:      func() time.Time { return started.Add(Quarantine) },
		Runner: &orchestration.Runner{
			Registry: reg,
			Usage:    usage.NewMemory(func() time.Time { return started }),
			Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
				opens.Add(1)
				return openSession{chat: chat}, nil
			},
		},
	}
}

type openSession struct {
	chat model.ToolCallingChatModel
}

func (s openSession) AttemptLimit() int      { return 1 }
func (s openSession) RotateOnQuota(int) bool { return false }
func (s openSession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	return s.chat, 0, nil
}
func (s openSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func post(handler *Handler, request signed) *httptest.ResponseRecorder {
	return postAt(handler, request, time.Time{})
}

func postAt(handler *Handler, request signed, now time.Time) *httptest.ResponseRecorder {
	if !now.IsZero() {
		handler.Now = func() time.Time { return now }
	}
	httpRequest := httptest.NewRequest(http.MethodPost, Path, strings.NewReader(string(request.body)))
	copyHeaders(httpRequest, request.header)
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httpRequest)
	return recorder
}

func copyHeaders(target *http.Request, header http.Header) {
	for key, values := range header {
		for _, value := range values {
			target.Header.Add(key, value)
		}
	}
}
