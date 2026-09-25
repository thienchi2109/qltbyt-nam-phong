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
	w.Header().Set(uiStreamHeader, uiStreamVersion)
	if requestID != "" {
		w.Header().Set(HeaderRequest, requestID)
	}
	writeStreamData(w, uiChunk{Type: "start", MessageID: requestID})
	writeStreamData(w, uiChunk{Type: "start-step"})
	textID := "text-1"
	textOpen := false
	sawError := false
	openText := func() {
		if !textOpen {
			writeStreamData(w, uiChunk{Type: "text-start", ID: textID})
			textOpen = true
		}
	}
	closeText := func() {
		if textOpen {
			writeStreamData(w, uiChunk{Type: "text-end", ID: textID})
			textOpen = false
		}
	}
	for {
		if err := ctx.Err(); err != nil {
			closeReader()
			closeText()
			loggerOrNop(log).Record(requestID, protocolCancelled())
			return
		}
		chunk, err := reader.Recv()
		if ctx.Err() != nil {
			closeReader()
			closeText()
			loggerOrNop(log).Record(requestID, protocolCancelled())
			return
		}
		if errors.Is(err, io.EOF) {
			closeText()
			reason := "stop"
			if sawError {
				reason = "error"
			}
			writeStreamData(w, uiChunk{Type: "finish-step"})
			writeStreamData(w, uiChunk{Type: "finish", FinishReason: reason})
			writeStreamRaw(w, "[DONE]")
			loggerOrNop(log).Record(requestID, "done")
			return
		}
		if err != nil {
			sawError = true
			closeText()
			safe := SanitizeStreamError(err)
			writeStreamData(w, uiChunk{Type: "error", ErrorText: safe.Message})
			loggerOrNop(log).Record(requestID, safe.Code)
			continue
		}
		if chunk != nil && chunk.Content != "" {
			openText()
			writeStreamData(w, uiChunk{Type: "text-delta", ID: textID, Delta: chunk.Content})
		}
	}
}

func writeStreamData(w http.ResponseWriter, event interface{}) {
	encoded, err := json.Marshal(event)
	if err != nil {
		return
	}
	writeStreamRaw(w, string(encoded))
}

func writeStreamRaw(w http.ResponseWriter, payload string) {
	_, _ = w.Write([]byte("data: "))
	_, _ = w.Write([]byte(payload))
	_, _ = w.Write([]byte("\n\n"))
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

func protocolCancelled() string {
	return "cancelled"
}
