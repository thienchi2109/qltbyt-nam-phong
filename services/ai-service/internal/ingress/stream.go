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
func ServeProviderStream(ctx context.Context, w http.ResponseWriter, reader *schema.StreamReader[*schema.Message], requestID string, log Log) error {
	if reader == nil {
		return nil
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
	if err := writeStreamData(w, uiChunk{Type: "start", MessageID: requestID}); err != nil {
		return err
	}
	if err := writeStreamData(w, uiChunk{Type: "start-step"}); err != nil {
		return err
	}
	textID := "text-1"
	textOpen := false
	sawError := false
	openText := func() error {
		if !textOpen {
			if err := writeStreamData(w, uiChunk{Type: "text-start", ID: textID}); err != nil {
				return err
			}
			textOpen = true
		}
		return nil
	}
	closeText := func() error {
		if textOpen {
			if err := writeStreamData(w, uiChunk{Type: "text-end", ID: textID}); err != nil {
				return err
			}
			textOpen = false
		}
		return nil
	}
	for {
		if err := ctx.Err(); err != nil {
			closeReader()
			_ = closeText()
			loggerOrNop(log).Record(requestID, protocolCancelled())
			return err
		}
		chunk, err := reader.Recv()
		if ctx.Err() != nil {
			closeReader()
			_ = closeText()
			loggerOrNop(log).Record(requestID, protocolCancelled())
			return ctx.Err()
		}
		if errors.Is(err, io.EOF) {
			if writeErr := closeText(); writeErr != nil {
				return writeErr
			}
			reason := "stop"
			if sawError {
				reason = "error"
			}
			if writeErr := writeStreamData(w, uiChunk{Type: "finish-step"}); writeErr != nil {
				return writeErr
			}
			if writeErr := writeStreamData(w, uiChunk{Type: "finish", FinishReason: reason}); writeErr != nil {
				return writeErr
			}
			if writeErr := writeStreamRaw(w, "[DONE]"); writeErr != nil {
				return writeErr
			}
			loggerOrNop(log).Record(requestID, "done")
			return nil
		}
		if err != nil {
			sawError = true
			if writeErr := closeText(); writeErr != nil {
				return writeErr
			}
			safe := SanitizeStreamError(err)
			if writeErr := writeStreamData(w, uiChunk{Type: "error", ErrorText: safe.Message}); writeErr != nil {
				return writeErr
			}
			loggerOrNop(log).Record(requestID, safe.Code)
			continue
		}
		if chunk != nil && chunk.Content != "" {
			if writeErr := openText(); writeErr != nil {
				return writeErr
			}
			if writeErr := writeStreamData(w, uiChunk{Type: "text-delta", ID: textID, Delta: chunk.Content}); writeErr != nil {
				return writeErr
			}
		}
	}
}

func writeStreamData(w http.ResponseWriter, event interface{}) error {
	encoded, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return writeStreamRaw(w, string(encoded))
}

func writeStreamRaw(w http.ResponseWriter, payload string) error {
	frame := "data: " + payload + "\n\n"
	n, err := io.WriteString(w, frame)
	if err != nil {
		return err
	}
	if n != len(frame) {
		return io.ErrShortWrite
	}
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
	return nil
}

func protocolCancelled() string {
	return "cancelled"
}
