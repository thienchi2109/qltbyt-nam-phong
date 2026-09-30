package ingress

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
)

const maxBodyBytes = 1 << 20

// Handler is the neutral POST /v1/chat boundary. It does not know any app adapter.
type Handler struct {
	Guard     *ReplayGuard
	Registry  *registry.Registry
	Runner    *orchestration.Runner
	Admission *Admission
	Lifecycle *Lifecycle
	Metrics   ObservationSink
	// ConfigReady lets the runtime entrypoint fail readiness closed when
	// external provider/configuration validation has not completed.
	ConfigReady func() bool
	Now         func() time.Time
	Log         Log
}

// ServeHTTP verifies the signed envelope before any model call.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	requestID := requestIDFrom(r)
	if r.Method == http.MethodGet && (r.URL.Path == "/healthz" || r.URL.Path == "/readyz") {
		h.serveProbe(w, r.URL.Path == "/readyz")
		return
	}
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
	if h.Guard == nil {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusServiceUnavailable, protocol.CodeCapabilityUnavailable, "The service is not ready.", true), h.Log)
		return
	}
	authenticated, err := h.Guard.Authenticate(now, r.Header, body)
	if err != nil {
		log.Printf("ai-service auth diagnostic=%s request_id=%s", authDiagnostic(err), requestID)
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
	if h.ConfigReady != nil && !h.ConfigReady() {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusServiceUnavailable, protocol.CodeCapabilityUnavailable, "The service is not ready.", true), h.Log)
		return
	}
	if h.Guard == nil || !h.admission().Ready() {
		writeProtocolError(w, requestID, protocol.NewError(http.StatusServiceUnavailable, protocol.CodeLimitExceeded, "The service is not accepting new requests.", true), h.Log)
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
	admissionCtx, release, admitted := h.admission().Acquire(r.Context())
	if !admitted {
		h.Guard.Release(authenticated.RequestID)
		writeProtocolError(w, requestID, protocol.NewError(http.StatusServiceUnavailable, protocol.CodeLimitExceeded, "The service is not accepting new requests.", true), h.Log)
		return
	}
	defer release()
	started := time.Now()
	ctx, cancel := requestContext(admissionCtx)
	defer cancel()
	result, runErr := h.Runner.Stream(ctx, request)
	if len(result.Events) == 0 {
		h.observe(request, result.Provider, outcomeFor(runErr, ctx), usageClassification(result), time.Since(started))
		writeProtocolError(w, requestID, publicOrFallback(requestID, runErr), h.Log)
		return
	}
	h.observe(request, result.Provider, outcomeFor(runErr, ctx), usageClassification(result), time.Since(started))
	if err := h.writeEvents(w, requestID, result.Events); err != nil {
		// writeEvents records the sanitized disconnect outcome; stop without
		// attempting to write a second response after the client is gone.
		return
	}
}

func (h *Handler) observe(request protocol.Request, provider protocol.ProviderMetadata, outcome, usage string, latency time.Duration) {
	if h == nil {
		return
	}
	observation := SanitizeObservation(Observation{
		RequestID:           request.RequestID,
		AppID:               request.AppID,
		CapabilityID:        request.CapabilityID,
		Provider:            provider.Provider,
		Model:               provider.Model,
		Latency:             latency,
		Outcome:             outcome,
		UsageClassification: usage,
	})
	if h.Metrics != nil {
		h.Metrics.Observe(observation)
	}
	if sink, ok := h.Log.(ObservationSink); ok {
		sink.Observe(observation)
	}
}

func outcomeFor(runErr error, ctx context.Context) string {
	if runErr != nil {
		if ctx != nil && errors.Is(ctx.Err(), context.Canceled) {
			return protocol.CodeCancelled
		}
		return protocol.CodeProviderFailure
	}
	return "completed"
}

func usageClassification(result orchestration.Result) string {
	if result.Reconciliation.Knowledge != "" {
		return result.Reconciliation.Knowledge
	}
	if result.Reconciliation.Uncertainty != "" {
		return result.Reconciliation.Uncertainty
	}
	return "unknown"
}

func requestContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	if deadline, ok := parent.Deadline(); ok {
		// Reserve the shared cleanup allowance inside the caller's original
		// deadline; the runner owns detached reconciliation after cancellation.
		return context.WithDeadline(parent, deadline.Add(-protocol.CleanupBudget))
	}
	return context.WithTimeout(parent, protocol.WorkBudget)
}

func (h *Handler) serveProbe(w http.ResponseWriter, ready bool) {
	status := http.StatusOK
	state := "ok"
	configReady := h.ConfigReady != nil && h.ConfigReady()
	if ready && (!configReady || h.Guard == nil || !h.Guard.Ready(h.now()) || h.Registry == nil || h.Runner == nil || h.Runner.Open == nil || h.Runner.Usage == nil || !h.admission().Ready()) {
		status = http.StatusServiceUnavailable
		state = "not_ready"
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": state})
}

func (h *Handler) now() time.Time {
	if h.Now != nil {
		return h.Now()
	}
	return time.Now()
}

func (h *Handler) admission() *Admission {
	if h == nil {
		return nil
	}
	if h.Lifecycle != nil && h.Lifecycle.Admission != nil {
		return h.Lifecycle.Admission
	}
	return h.Admission
}

// Drain marks the handler unready, rejects new work, and gives active streams
// a bounded grace period before canceling their request contexts.
func (h *Handler) Drain(ctx context.Context, grace time.Duration) error {
	if h == nil || h.admission() == nil {
		return nil
	}
	if h.Lifecycle != nil {
		if grace <= 0 {
			return h.Lifecycle.Drain(ctx)
		}
		return h.Lifecycle.DrainWithGrace(ctx, grace)
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if grace <= 0 {
		grace = protocol.DrainGraceMin
	}
	if grace > protocol.DrainGraceMax {
		grace = protocol.DrainGraceMax
	}
	stopCtx, cancel := context.WithTimeout(ctx, grace)
	defer cancel()
	return h.admission().Drain(stopCtx)
}

func (h *Handler) writeEvents(w http.ResponseWriter, requestID string, events []protocol.Event) error {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set(uiStreamHeader, uiStreamVersion)
	w.Header().Set(HeaderRequest, requestID)
	chunks, _ := uiChunks(requestID, events)
	for _, chunk := range chunks {
		if chunk.Type == "error" {
			loggerOrNop(h.Log).Record(requestID, "error")
		}
		if err := writeStreamData(w, chunk); err != nil {
			loggerOrNop(h.Log).Record(requestID, "client_disconnected")
			return err
		}
	}
	if err := writeStreamRaw(w, "[DONE]"); err != nil {
		loggerOrNop(h.Log).Record(requestID, "client_disconnected")
		return err
	}
	loggerOrNop(h.Log).Record(requestID, protocol.EventDone)
	return nil
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
