// Package protocol is the app-neutral chat contract for the shared AI service.
package protocol

import (
	"encoding/json"
	"strings"
	"time"
)

const ProtocolVersion = "v1"

const (
	RoleSystem    = "system"
	RoleUser      = "user"
	RoleAssistant = "assistant"
	RoleTool      = "tool"
)

const (
	TransportGateway          = "gateway"
	TransportGoogle           = "google"
	TransportOpenAICompatible = "openai-compatible"
)

const (
	CodeInvalidRequest        = "invalid_request"
	CodeCapabilityUnavailable = "capability_unavailable"
	CodeUnauthorized          = "unauthorized"
	CodeLimitExceeded         = "limit_exceeded"
	CodeProviderFailure       = "provider_failure"
	CodeProviderQuota         = "provider_quota"
	CodeCancelled             = "cancelled"
	CodeToolLimit             = "tool_limit"
)

const (
	EventStart      = "start"
	EventStartStep  = "start-step"
	EventText       = "text"
	EventToolCall   = "tool-call"
	EventToolResult = "tool-result"
	EventArtifact   = "artifact"
	EventError      = "error"
	EventFinishStep = "finish-step"
	EventFinish     = "finish"
	EventDone       = "done"
)

const (
	DefaultMaxMessages       = 40
	DefaultMaxInputChars     = 120_000
	DefaultMaxOutputTokens   = 2048
	DefaultMaxToolSteps      = 5
	DefaultMaxToolInputChars = 120_000
	DefaultMaxToolOutput     = 120_000
	ReservationTTL           = 120 * time.Second
	WorkBudget               = 55 * time.Second
	CleanupBudget            = 5 * time.Second
	RouteBudget              = WorkBudget + CleanupBudget
	DrainGraceMin            = 60 * time.Second
	DrainGraceMax            = 90 * time.Second
	DefaultGatewayModel      = "google/gemini-3.1-flash-lite-preview"
	DefaultGoogleModel       = "gemini-3.1-flash-lite-preview"
)

// Limits are the per-request ceilings enforced before and during one run.
type Limits struct {
	MaxMessages       int
	MaxInputChars     int
	MaxOutputTokens   int
	MaxToolSteps      int
	MaxToolInputChars int
	MaxToolOutput     int
}

// DefaultLimits returns the ceilings carried forward from the current chat route.
func DefaultLimits() Limits {
	return Limits{
		MaxMessages:       DefaultMaxMessages,
		MaxInputChars:     DefaultMaxInputChars,
		MaxOutputTokens:   DefaultMaxOutputTokens,
		MaxToolSteps:      DefaultMaxToolSteps,
		MaxToolInputChars: DefaultMaxToolInputChars,
		MaxToolOutput:     DefaultMaxToolOutput,
	}
}

// Resolved replaces non-positive fields with DefaultLimits.
func (l Limits) Resolved() Limits {
	defaults := DefaultLimits()
	if l.MaxMessages <= 0 {
		l.MaxMessages = defaults.MaxMessages
	}
	if l.MaxInputChars <= 0 {
		l.MaxInputChars = defaults.MaxInputChars
	}
	if l.MaxOutputTokens <= 0 {
		l.MaxOutputTokens = defaults.MaxOutputTokens
	}
	if l.MaxToolSteps <= 0 {
		l.MaxToolSteps = defaults.MaxToolSteps
	}
	if l.MaxToolInputChars <= 0 {
		l.MaxToolInputChars = defaults.MaxToolInputChars
	}
	if l.MaxToolOutput <= 0 {
		l.MaxToolOutput = defaults.MaxToolOutput
	}
	return l
}

// Identity is the trusted envelope carried by the BFF. The shared core does not
// treat it as authorization by itself.
type Identity struct {
	Issuer           string         `json:"issuer"`
	Audience         string         `json:"audience"`
	Subject          string         `json:"subject"`
	Tenant           string         `json:"tenant"`
	IssuedAt         int64          `json:"issued_at"`
	ExpiresAt        int64          `json:"expires_at"`
	TrustedApp       TrustedApp     `json:"trusted_app"`
	CapabilityClaims map[string]any `json:"capability_claims,omitempty"`
}

// TrustedApp names the app and capabilities a signing key is allowed to call.
type TrustedApp struct {
	AppID         string   `json:"app_id"`
	CapabilityIDs []string `json:"capability_ids"`
}

// Message is one chat turn. Tool fields are optional history.
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	Name       string     `json:"name,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

// ToolCall is a model-requested tool invocation.
type ToolCall struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// Request is the canonical app-neutral chat request.
// Context is untrusted input and is not authorization.
type Request struct {
	ProtocolVersion   string         `json:"protocol_version"`
	AppID             string         `json:"app_id"`
	CapabilityID      string         `json:"capability_id"`
	CapabilityVersion string         `json:"capability_version"`
	RequestID         string         `json:"request_id"`
	Identity          Identity       `json:"identity"`
	Messages          []Message      `json:"messages"`
	RequestedTools    []string       `json:"requested_tools"`
	Context           map[string]any `json:"context,omitempty"`
}

// Artifact is capability-defined data emitted before the terminal finish event.
type Artifact struct {
	Name    string          `json:"name"`
	Payload json.RawMessage `json:"payload"`
}

// Event is one normalized stream event. RequestID correlates the whole run.
type Event struct {
	Type       string          `json:"type"`
	RequestID  string          `json:"request_id"`
	Step       int             `json:"step,omitempty"`
	Text       string          `json:"text,omitempty"`
	ToolName   string          `json:"tool_name,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
	Payload    json.RawMessage `json:"payload,omitempty"`
	Error      *Error          `json:"error,omitempty"`
}

// Error is the stable pre-stream and in-stream failure contract.
type Error struct {
	Status       int               `json:"status"`
	Code         string            `json:"code"`
	Message      string            `json:"message"`
	Retryable    bool              `json:"retryable"`
	Details      map[string]string `json:"details,omitempty"`
	RetryAfterMs int               `json:"retry_after_ms,omitempty"`
	RequestID    string            `json:"request_id,omitempty"`
	Cause        error             `json:"-"`
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func (e *Error) Unwrap() error { return e.Cause }

// NewError builds a sanitized service error. Message must already be safe to return.
func NewError(status int, code, message string, retryable bool) *Error {
	return &Error{Status: status, Code: code, Message: message, Retryable: retryable}
}

// WithRequest returns a copy bound to a request ID.
func (e *Error) WithRequest(requestID string) *Error {
	if e == nil {
		return nil
	}
	clone := *e
	clone.RequestID = requestID
	return &clone
}

// WithCause returns a copy that unwraps to cause without copying cause text into Message.
func (e *Error) WithCause(cause error) *Error {
	if e == nil {
		return nil
	}
	clone := *e
	clone.Cause = cause
	return &clone
}

// Validate checks the structural request and input ceilings.
// It does not authorize the caller and does not read context as authority.
func Validate(request Request, limits Limits) error {
	limits = limits.Resolved()
	if request.ProtocolVersion != ProtocolVersion {
		return NewError(400, CodeInvalidRequest, "The protocol version is not supported.", false)
	}
	if strings.TrimSpace(request.RequestID) == "" ||
		strings.TrimSpace(request.AppID) == "" ||
		strings.TrimSpace(request.CapabilityID) == "" ||
		strings.TrimSpace(request.CapabilityVersion) == "" {
		return NewError(400, CodeInvalidRequest, "The request is missing a routing identifier.", false)
	}
	if len(request.Messages) == 0 {
		return NewError(400, CodeInvalidRequest, "The request does not include a message.", false)
	}
	if len(request.Messages) > limits.MaxMessages {
		return NewError(400, CodeLimitExceeded, "Request exceeds message limit.", false)
	}
	for _, message := range request.Messages {
		switch message.Role {
		case RoleSystem, RoleUser, RoleAssistant, RoleTool:
		default:
			return NewError(400, CodeInvalidRequest, "The request contains an unsupported message role.", false)
		}
	}
	encoded, err := json.Marshal(request.Messages)
	if err != nil || len(encoded) > limits.MaxInputChars {
		return NewError(400, CodeLimitExceeded, "Request exceeds input size limit.", false)
	}
	return nil
}
