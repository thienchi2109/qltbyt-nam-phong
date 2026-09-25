package ingress

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
)

const maxBodyBytes = 1 << 20

// Handler is the neutral POST /v1/chat boundary. It does not know any app adapter.
type Handler struct {
	Guard    *ReplayGuard
	Registry *registry.Registry
	Runner   *orchestration.Runner
	Now      func() time.Time
	Log      Log
}

// ServeHTTP verifies the signed envelope before any model call.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestID := requestIDFrom(r)
	if r.Method != http.MethodPost || r.URL.Path != Path {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusNotFound, protocol.CodeInvalidRequest, "The request is not supported.", false), h.Log)
		return
	}
	if cookie := r.Header.Get("Cookie"); cookie != "" {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusUnauthorized, protocol.CodeUnauthorized, "The request is not authorized.", false), h.Log)
		return
	}
	body, err := readRawBody(r)
	if err != nil {
		if errors.Is(err, errBodyTooLarge) {
			writeProtocolError(w, requestID, protocol.NewError(http.StatusRequestEntityTooLarge, protocol.CodeLimitExceeded, "Request exceeds input size limit.", false), h.Log)
			return
		}
		writeProtocolError(w, requestID, protocol.NewError(http.StatusBadRequest, protocol.CodeInvalidRequest, "The request is not valid.", false), h.Log)
		return
	}
	now := h.now()
	authenticated, err := h.Guard.Authenticate(now, r.Header, body)
	if err != nil {
		writeProtocolError(w, firstNonEmpty(authenticated.RequestID, requestID), authenticationError(err), h.Log)
		return
	}
	requestID = authenticated.RequestID
	var request protocol.Request
	if err := json.Unmarshal(body, &request); err != nil {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusBadRequest, protocol.CodeInvalidRequest, "The request is not valid.", false), h.Log)
		return
	}
	if h.Registry == nil || h.Runner == nil {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusServiceUnavailable, protocol.CodeCapabilityUnavailable, "The capability version is unavailable.", false), h.Log)
		return
	}
	if _, err := h.Registry.Lookup(request.AppID, request.CapabilityID, request.CapabilityVersion); err != nil {
		writeProtocolError(w, requestID, publicOrFallback(requestID, err), h.Log)
		return
	}
	if err := h.Guard.Admit(now, authenticated); err != nil {
		writeProtocolError(w, requestID, authenticationError(err), h.Log)
		return
	}
	result, runErr := h.Runner.Stream(r.Context(), request)
	if len(result.Events) == 0 {
		writeProtocolError(w, requestID, publicOrFallback(requestID, runErr), h.Log)
		return
	}
	h.writeEvents(w, requestID, result.Events)
}

func (h *Handler) now() time.Time {
	if h.Now != nil {
		return h.Now()
	}
	return time.Now()
}

func (h *Handler) writeEvents(w http.ResponseWriter, requestID string, events []protocol.Event) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set(HeaderRequest, requestID)
	for _, event := range events {
		payload := streamEvent{Type: event.Type, RequestID: requestID}
		switch event.Type {
		case protocol.EventText:
			payload.Text = event.Text
		case protocol.EventError:
			if event.Error != nil {
				payload.Code = event.Error.Code
				payload.Message = event.Error.Message
				payload.Retryable = event.Error.Retryable
				loggerOrNop(h.Log).Record(requestID, event.Error.Code)
			}
		case protocol.EventDone:
			loggerOrNop(h.Log).Record(requestID, protocol.EventDone)
		}
		writeStreamData(w, payload)
	}
}

func readRawBody(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, io.ErrUnexpectedEOF
	}
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodyBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxBodyBytes {
		return nil, errBodyTooLarge
	}
	if len(body) == 0 {
		return nil, io.ErrUnexpectedEOF
	}
	return body, nil
}

func requestIDFrom(r *http.Request) string {
	if r == nil {
		return ""
	}
	if value := stringsTrim(r.Header.Get(HeaderRequestID)); value != "" {
		return value
	}
	return stringsTrim(r.Header.Get(HeaderRequest))
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func publicOrFallback(requestID string, err error) *protocol.Error {
	if err == nil {
		return protocol.NewError(http.StatusInternalServerError, protocol.CodeProviderFailure, "The model request failed.", false).WithRequest(requestID)
	}
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) {
		return serviceErr.WithRequest(requestID)
	}
	return protocol.NewError(http.StatusBadGateway, protocol.CodeProviderFailure, "The model request failed.", false).WithRequest(requestID)
}
