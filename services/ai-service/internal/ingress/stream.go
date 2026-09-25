package ingress

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sync"

	"github.com/cloudwego/eino/schema"
)

type streamEvent struct {
	Type      string `json:"type"`
	Text      string `json:"text,omitempty"`
	Code      string `json:"code,omitempty"`
	Message   string `json:"message,omitempty"`
	Retryable bool   `json:"retryable,omitempty"`
	RequestID string `json:"request_id,omitempty"`
}

// ServeProviderStream writes provider chunks as they arrive.
// On client cancel it closes the reader so a later Send observes the reader
// side as closed. It never closes the writer; the forwarder owns writer.Close.
func ServeProviderStream(ctx context.Context, w http.ResponseWriter, reader *schema.StreamReader[*schema.Message], requestID string, log Log) {
	if reader == nil {
		return
	}
	var closeOnce sync.Once
	closeReader := func() { closeOnce.Do(func() { reader.Close() }) }
	defer closeReader()
	if ctx == nil {
		ctx = context.Background()
	}
	stop := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			closeReader()
		case <-stop:
		}
	}()
	defer close(stop)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	if requestID != "" {
		w.Header().Set(HeaderRequest, requestID)
	}
	sawError := false
	for {
		if err := ctx.Err(); err != nil {
			closeReader()
			loggerOrNop(log).Record(requestID, protocolCancelled())
			return
		}
		chunk, err := reader.Recv()
		if ctx.Err() != nil {
			closeReader()
			loggerOrNop(log).Record(requestID, protocolCancelled())
			return
		}
		if errors.Is(err, io.EOF) {
			if !sawError {
				writeStreamData(w, streamEvent{Type: "finish", RequestID: requestID})
				writeStreamData(w, streamEvent{Type: "done", RequestID: requestID})
				loggerOrNop(log).Record(requestID, "done")
			}
			return
		}
		if err != nil {
			sawError = true
			safe := SanitizeStreamError(err)
			safe.RequestID = requestID
			writeStreamData(w, streamEvent{
				Type:      "error",
				Code:      safe.Code,
				Message:   safe.Message,
				Retryable: safe.Retryable,
				RequestID: requestID,
			})
			loggerOrNop(log).Record(requestID, safe.Code)
			continue
		}
		if chunk != nil && chunk.Content != "" {
			writeStreamData(w, streamEvent{Type: "text", Text: chunk.Content, RequestID: requestID})
		}
	}
}

func writeStreamData(w http.ResponseWriter, event streamEvent) {
	encoded, err := json.Marshal(event)
	if err != nil {
		return
	}
	_, _ = w.Write([]byte("data: "))
	_, _ = w.Write(encoded)
	_, _ = w.Write([]byte("\n\n"))
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

func protocolCancelled() string {
	return "cancelled"
}
