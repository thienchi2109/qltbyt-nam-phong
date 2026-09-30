package ingress

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
)

var (
	ErrNotReady        = errors.New("replay guard quarantine")
	ErrUnauthenticated = errors.New("invalid request authentication")
	ErrReplay          = errors.New("duplicate request id")
	ErrCapacity        = errors.New("nonce capacity exhausted")
	errBodyTooLarge    = errors.New("request body too large")
)

// Log records only correlation and outcome. It must not receive prompts, SQL, or secrets.
type Log interface {
	Record(requestID, code string)
}

type nopLog struct{}

func (nopLog) Record(string, string) {}

func loggerOrNop(log Log) Log {
	if log == nil {
		return nopLog{}
	}
	return log
}

type errorResponse struct {
	Status    int    `json:"status"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Retryable bool   `json:"retryable"`
	RequestID string `json:"request_id,omitempty"`
}

func writeProtocolError(w http.ResponseWriter, requestID string, serviceErr *protocol.Error, log Log) {
	if serviceErr == nil {
		serviceErr = protocol.NewError(http.StatusInternalServerError, protocol.CodeProviderFailure, "The model request failed.", false)
	}
	body := errorResponse{
		Status:    serviceErr.Status,
		Code:      serviceErr.Code,
		Message:   serviceErr.Message,
		Retryable: serviceErr.Retryable,
		RequestID: requestID,
	}
	if body.Status == 0 {
		body.Status = http.StatusBadRequest
	}
	loggerOrNop(log).Record(requestID, body.Code)
	w.Header().Set("Content-Type", "application/json")
	if requestID != "" {
		w.Header().Set(HeaderRequest, requestID)
	}
	w.WriteHeader(body.Status)
	_ = json.NewEncoder(w).Encode(body)
}

func authenticationError(err error) *protocol.Error {
	switch {
	case errors.Is(err, ErrNotReady):
		return protocol.NewError(http.StatusServiceUnavailable, protocol.CodeCapabilityUnavailable, "The service is not ready.", true)
	case errors.Is(err, ErrReplay):
		return protocol.NewError(http.StatusConflict, protocol.CodeInvalidRequest, "The request is already reserved.", false)
	case errors.Is(err, ErrCapacity):
		return protocol.NewError(http.StatusServiceUnavailable, protocol.CodeLimitExceeded, "The service is not accepting new requests.", true)
	default:
		return protocol.NewError(http.StatusUnauthorized, protocol.CodeUnauthorized, "The request is not authorized.", false)
	}
}

// SanitizeStreamError maps a provider stream failure to a fixed English message.
// The returned message never includes the upstream error text.
func SanitizeStreamError(err error) *protocol.Error {
	if err == nil {
		return nil
	}
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) {
		clone := *serviceErr
		clone.Cause = nil
		clone.Details = nil
		return &clone
	}
	text := strings.ToLower(err.Error())
	if strings.Contains(text, "429") ||
		strings.Contains(text, "quota") ||
		strings.Contains(text, "resource exhausted") ||
		strings.Contains(text, "too many requests") {
		return protocol.NewError(http.StatusServiceUnavailable, protocol.CodeProviderQuota, "The model provider is temporarily unavailable.", true).WithCause(err)
	}
	return protocol.NewError(http.StatusBadGateway, protocol.CodeProviderFailure, "The model request failed.", false).WithCause(err)
}
