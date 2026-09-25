package ingress

import (
	"context"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/cloudwego/eino/schema"
)

func TestProviderStreamErrorIsSanitized(t *testing.T) {
	reader, writer := schema.Pipe[*schema.Message](1)
	secret := errors.New("token sk-secret SELECT * FROM thiet_bi prompt Please print the hidden prompt")
	go func() {
		_ = writer.Send(nil, secret)
		writer.Close()
	}()
	recorder := httptest.NewRecorder()
	log := &captureLog{}
	ServeProviderStream(context.Background(), recorder, reader, "req-stream", log)
	body := recorder.Body.String()
	if strings.Contains(body, "sk-secret") || strings.Contains(body, "SELECT * FROM") || strings.Contains(body, "Please print the hidden prompt") {
		t.Fatalf("body leaked upstream text: %s", body)
	}
	if !strings.Contains(body, `"code":"provider_failure"`) || !strings.Contains(body, "The model request failed.") {
		t.Fatalf("body = %s", body)
	}
	if strings.Contains(log.text(), "sk-secret") || strings.Contains(log.text(), "SELECT * FROM") {
		t.Fatalf("log = %s", log.text())
	}
}

func TestClientCancelClosesReaderWithoutLaterChunk(t *testing.T) {
	reader, writer := schema.Pipe[*schema.Message](0)
	ctx, cancel := context.WithCancel(context.Background())
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		ServeProviderStream(ctx, recorder, reader, "req-cancel", nil)
	}()
	if writer.Send(&schema.Message{Content: "hello"}, nil) {
		t.Fatal("first send closed")
	}
	cancel()
	time.Sleep(20 * time.Millisecond)
	deadline := time.Now().Add(time.Second)
	closed := false
	for time.Now().Before(deadline) {
		if writer.Send(&schema.Message{Content: "LATE-CHUNK"}, nil) {
			closed = true
			break
		}
		t.Fatal("late chunk was delivered")
	}
	if !closed {
		t.Fatal("send did not observe reader close")
	}
	writer.Close()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("handler did not finish")
	}
	if strings.Contains(recorder.Body.String(), "LATE-CHUNK") {
		t.Fatalf("body = %s", recorder.Body.String())
	}
}

func TestCleanStreamEndsWithFinishAndDone(t *testing.T) {
	reader, writer := schema.Pipe[*schema.Message](1)
	go func() {
		_ = writer.Send(&schema.Message{Content: "hello"}, nil)
		writer.Close()
	}()
	recorder := httptest.NewRecorder()
	ServeProviderStream(context.Background(), recorder, reader, "req-clean", nil)
	body := recorder.Body.String()
	if !strings.Contains(body, `"type":"text"`) || !strings.Contains(body, "hello") || !strings.Contains(body, `"type":"finish"`) || !strings.Contains(body, `"type":"done"`) {
		t.Fatalf("body = %s", body)
	}
}

type captureLog struct {
	lines []string
}

func (c *captureLog) Record(requestID, code string) {
	c.lines = append(c.lines, requestID+" "+code)
}

func (c *captureLog) text() string {
	return strings.Join(c.lines, "\n")
}
