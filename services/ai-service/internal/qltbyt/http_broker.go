package qltbyt

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync/atomic"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

const (
	brokerPath        = "/api/internal/ai/broker/v1"
	brokerBodyLimit   = 64 * 1024
	brokerResultLimit = 64 * 1024
	brokerErrorLimit  = 8 * 1024
	brokerCallBudget  = 5 * time.Second
)

// Operation identifies the wire operation sent to the application-owned BFF.
type Operation string

const (
	OperationCall          Operation = "call"
	OperationCleanup       Operation = "cleanup"
	BrokerOperationCall              = OperationCall
	BrokerOperationCleanup           = OperationCleanup
)

// OperationAwareBroker is the optional extension used by the gate to preserve
// call versus cleanup on the wire. Broker remains the capability-facing seam.
type OperationAwareBroker interface {
	Broker
	CallOperation(ctx context.Context, operation Operation, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error)
}

// OperationBroker is the shorter compatibility name for the operation-aware
// transport extension.
type OperationBroker = OperationAwareBroker

// CleanupBroker is implemented by transports that expose the bounded cleanup
// operation separately from normal calls.
type CleanupBroker interface {
	Cleanup(ctx context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error)
}

// HTTPBroker calls the server-only Next.js BFF broker endpoint. It accepts only
// the opaque token retained by parseCredential; it never mints a project JWT.
type HTTPBroker struct {
	Endpoint string
	Client   *http.Client
}

// BFFBroker is a descriptive alias for HTTPBroker.
type BFFBroker = HTTPBroker

// NewHTTPBroker validates and normalizes the BFF broker endpoint.
func NewHTTPBroker(endpoint string, client *http.Client, _ ...[]byte) (*HTTPBroker, error) {
	value := strings.TrimSpace(endpoint)
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("broker endpoint is unavailable")
	}
	if parsed.Path == "" || parsed.Path == "/" {
		parsed.Path = brokerPath
	}
	if parsed.Path != brokerPath {
		return nil, errors.New("broker endpoint path is invalid")
	}
	if client == nil {
		client = http.DefaultClient
	}
	return &HTTPBroker{Endpoint: parsed.String(), Client: client}, nil
}

// NewBFFBroker constructs the same operation-aware transport under its domain name.
func NewBFFBroker(endpoint string, client *http.Client, secret ...[]byte) (*BFFBroker, error) {
	return NewHTTPBroker(endpoint, client, secret...)
}

func (b *HTTPBroker) Call(ctx context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error) {
	return b.CallOperation(ctx, OperationCall, cred, rpc, payload)
}

func (b *HTTPBroker) Cleanup(ctx context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error) {
	return b.CallOperation(ctx, OperationCleanup, cred, rpc, payload)
}

// CallOperation preserves operation through the HTTP envelope and rejects
// cleanup/RPC mismatches before making a network request.
func (b *HTTPBroker) CallOperation(ctx context.Context, operation Operation, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error) {
	if b == nil || b.Client == nil || strings.TrimSpace(b.Endpoint) == "" {
		return nil, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The data broker is unavailable.", true)
	}
	if err := validateOperationRPC(operation, rpc); err != nil {
		return nil, err
	}
	token := strings.TrimSpace(cred.token)
	if token == "" {
		return nil, protocol.NewError(401, protocol.CodeUnauthorized, "The request is not authorized.", false)
	}
	if err := validatePayloadObject(payload); err != nil {
		return nil, err
	}
	requestID := brokerRequestID(ctx)
	envelope := struct {
		ProtocolVersion string          `json:"protocol_version"`
		RequestID       string          `json:"request_id"`
		Operation       Operation       `json:"operation"`
		RPC             string          `json:"rpc"`
		Payload         json.RawMessage `json:"payload"`
	}{"v1", requestID, operation, rpc, append(json.RawMessage(nil), payload...)}
	body, err := json.Marshal(envelope)
	if err != nil || len(body) > brokerBodyLimit {
		return nil, protocol.NewError(400, protocol.CodeInvalidRequest, "The broker request is invalid.", false)
	}
	callCtx, cancel := boundedBrokerContext(ctx, brokerCallBudget)
	defer cancel()
	request, err := http.NewRequestWithContext(callCtx, http.MethodPost, b.Endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The data broker is unavailable.", true).WithCause(err)
	}
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Request-ID", requestID)
	response, err := b.Client.Do(request)
	if err != nil {
		if callCtx.Err() != nil {
			return nil, callCtx.Err()
		}
		return nil, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The data broker is unavailable.", true).WithCause(err)
	}
	defer response.Body.Close()
	limit := int64(brokerResultLimit)
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		limit = brokerErrorLimit
	}
	responseBody, readErr := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if readErr != nil {
		return nil, protocol.NewError(502, protocol.CodeProviderFailure, "The data broker response is invalid.", true).WithCause(readErr)
	}
	if (response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices && len(responseBody) > brokerResultLimit) ||
		(response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices) && len(responseBody) > brokerErrorLimit {
		return nil, protocol.NewError(502, protocol.CodeProviderFailure, "The data broker response is too large.", false)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, brokerHTTPError(response.StatusCode)
	}
	var result struct {
		ProtocolVersion string          `json:"protocol_version"`
		RequestID       string          `json:"request_id"`
		RPC             string          `json:"rpc"`
		Result          json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(responseBody, &result); err != nil || result.ProtocolVersion != "v1" || result.RequestID != requestID || result.RPC != rpc || len(result.Result) == 0 {
		return nil, protocol.NewError(502, protocol.CodeProviderFailure, "The data broker response is invalid.", false)
	}
	return append(json.RawMessage(nil), result.Result...), nil
}

func validateOperationRPC(operation Operation, rpc string) error {
	if !knownRPC(rpc) {
		return protocol.NewError(403, protocol.CodeUnauthorized, "The RPC is not allowlisted.", false)
	}
	switch operation {
	case OperationCall:
		if rpc == RPCQuotaFinalize {
			return protocol.NewError(403, protocol.CodeUnauthorized, "The call operation cannot finalize quota.", false)
		}
	case OperationCleanup:
		if rpc != RPCAudit && rpc != RPCQuotaFinalize {
			return protocol.NewError(403, protocol.CodeUnauthorized, "The cleanup operation is not allowed for this RPC.", false)
		}
	default:
		return protocol.NewError(400, protocol.CodeInvalidRequest, "The broker operation is invalid.", false)
	}
	return nil
}

func validatePayloadObject(payload json.RawMessage) error {
	var object map[string]json.RawMessage
	if len(bytes.TrimSpace(payload)) == 0 || json.Unmarshal(payload, &object) != nil || object == nil {
		return protocol.NewError(400, protocol.CodeInvalidRequest, "The broker payload is invalid.", false)
	}
	return nil
}

func brokerHTTPError(status int) error {
	switch status {
	case 499:
		return protocol.NewError(499, protocol.CodeCancelled, "The broker request was cancelled.", false)
	case http.StatusUnauthorized:
		return protocol.NewError(401, protocol.CodeUnauthorized, "The request is not authorized.", false)
	case http.StatusForbidden:
		return protocol.NewError(403, protocol.CodeUnauthorized, "The broker request is not allowed.", false)
	case http.StatusBadRequest, http.StatusUnsupportedMediaType, http.StatusRequestEntityTooLarge:
		return protocol.NewError(status, protocol.CodeInvalidRequest, "The broker request is invalid.", false)
	default:
		retryable := status >= 500
		return protocol.NewError(status, protocol.CodeProviderFailure, "The data broker could not complete the request.", retryable)
	}
}

func boundedBrokerContext(parent context.Context, budget time.Duration) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	if deadline, ok := parent.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining < budget {
			budget = remaining
		}
	}
	if budget <= 0 {
		return context.WithCancel(parent)
	}
	return context.WithTimeout(parent, budget)
}

var brokerRequestCounter atomic.Uint64

func brokerRequestID(ctx context.Context) string {
	if value, ok := requestIDFromContext(ctx); ok {
		return value
	}
	var random [8]byte
	if _, err := rand.Read(random[:]); err == nil {
		return "go-" + hex.EncodeToString(random[:])
	}
	return fmt.Sprintf("go-%d", brokerRequestCounter.Add(1))
}

type requestIDContextKey struct{}

// WithRequestID binds an existing ingress correlation id to broker calls.
func WithRequestID(ctx context.Context, requestID string) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if !validBrokerRequestID(requestID) {
		return ctx
	}
	return context.WithValue(ctx, requestIDContextKey{}, requestID)
}

func requestIDFromContext(ctx context.Context) (string, bool) {
	if ctx == nil {
		return "", false
	}
	value, ok := ctx.Value(requestIDContextKey{}).(string)
	return value, ok && validBrokerRequestID(value)
}

// validBrokerRequestID mirrors the BFF's bounded correlation-id grammar.
// Invalid ingress values are ignored and brokerRequestID generates a safe id.
func validBrokerRequestID(value string) bool {
	if len(value) == 0 || len(value) > 128 {
		return false
	}
	for _, char := range value {
		if (char >= 'A' && char <= 'Z') || (char >= 'a' && char <= 'z') ||
			(char >= '0' && char <= '9') || char == '.' || char == '_' || char == ':' || char == '-' {
			continue
		}
		return false
	}
	return true
}
