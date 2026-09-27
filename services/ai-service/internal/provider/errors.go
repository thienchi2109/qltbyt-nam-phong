package provider

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino-ext/components/model/openai"
	"google.golang.org/genai"
)

// ErrorClass is the provider-neutral classification used by orchestration.
// Provider SDK status and structured fields are interpreted at the adapter boundary.
type ErrorClass string

const (
	ErrorClassUnknown        ErrorClass = "unknown"
	ErrorClassQuotaExhausted ErrorClass = "quota-exhausted"
	ErrorClassRateLimited    ErrorClass = "rate-limited"
	ErrorClassTransport      ErrorClass = "transport"
	ErrorClassConfiguration  ErrorClass = "configuration"
)

// ProviderError carries a redacted provider/model label and a stable class.
// The upstream response body is retained only as an unwrap cause and is never
// exposed through Error().
type ProviderError struct {
	Provider   string
	Model      string
	Class      ErrorClass
	Status     int
	RetryAfter int
	Cause      error
}

func (e *ProviderError) Error() string {
	if e == nil {
		return ""
	}
	if e.Provider == "" {
		return fmt.Sprintf("provider request failed (%s)", e.Class)
	}
	return fmt.Sprintf("%s provider request failed (%s)", e.Provider, e.Class)
}

func (e *ProviderError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Cause
}

// ProviderFallbackEligible is the typed handoff consumed by orchestration.
func (e *ProviderError) ProviderFallbackEligible() bool {
	if e == nil {
		return false
	}
	return e.Class == ErrorClassQuotaExhausted || e.Class == ErrorClassRateLimited
}

// ProviderErrorClass lets orchestration preserve the adapter classification
// without inspecting provider-specific error text.
func (e *ProviderError) ProviderErrorClass() string {
	if e == nil {
		return ""
	}
	return string(e.Class)
}

func newProviderError(pair ProviderModelPair, class ErrorClass, cause error) *ProviderError {
	if class == ErrorClassUnknown {
		class = ErrorClassTransport
	}
	return &ProviderError{Provider: pair.Provider, Model: pair.Model, Class: class, Cause: cause}
}

// ClassifyError turns known provider and service failures into one stable class.
func ClassifyError(err error) ErrorClass {
	if err == nil {
		return ErrorClassUnknown
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return ErrorClassTransport
	}
	var providerErr *ProviderError
	if errors.As(err, &providerErr) && providerErr != nil {
		return providerErr.Class
	}
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) && serviceErr != nil {
		switch serviceErr.Code {
		case protocol.CodeProviderQuota:
			return ErrorClassQuotaExhausted
		case protocol.CodeInvalidRequest:
			return ErrorClassConfiguration
		}
	}
	if class, ok := classifySDKError(err); ok {
		return class
	}
	return ErrorClassTransport
}

func classifySDKError(err error) (ErrorClass, bool) {
	var openAIError *openai.APIError
	if errors.As(err, &openAIError) && openAIError != nil {
		return classifyStructuredProviderError(
			openAIError.HTTPStatusCode,
			fmt.Sprint(openAIError.Code),
			openAIError.Type,
			openAIError.HTTPStatus,
		), true
	}
	var geminiError genai.APIError
	if errors.As(err, &geminiError) {
		return classifyStructuredProviderError(geminiError.Code, geminiError.Status), true
	}
	var geminiErrorPointer *genai.APIError
	if errors.As(err, &geminiErrorPointer) && geminiErrorPointer != nil {
		return classifyStructuredProviderError(geminiErrorPointer.Code, geminiErrorPointer.Status), true
	}
	return ErrorClassTransport, false
}

func classifyStructuredProviderError(httpStatus int, fields ...string) ErrorClass {
	// Authentication and server failures never permit provider fallback, even
	// when a structured error includes quota-like wording.
	if httpStatus == 401 || httpStatus == 403 || httpStatus >= 500 {
		return ErrorClassTransport
	}
	if hasStructuredValue(fields, "insufficient_quota", "resource_exhausted") {
		return ErrorClassQuotaExhausted
	}
	if hasStructuredValue(fields, "rate_limit_exceeded", "rate_limited", "rate-limit-exceeded", "rate-limit") {
		return ErrorClassRateLimited
	}
	if httpStatus == 429 {
		return ErrorClassRateLimited
	}
	return ErrorClassTransport
}

func hasStructuredValue(fields []string, wanted ...string) bool {
	for _, field := range fields {
		field = strings.ToLower(strings.TrimSpace(field))
		for _, value := range wanted {
			if field == value {
				return true
			}
		}
	}
	return false
}

// IsQuotaError reports whether an error permits the pre-stream fallback rule.
func IsQuotaError(err error) bool {
	class := ClassifyError(err)
	return class == ErrorClassQuotaExhausted || class == ErrorClassRateLimited
}

func wrapProviderError(pair ProviderModelPair, err error) error {
	if err == nil {
		return nil
	}
	var providerErr *ProviderError
	if errors.As(err, &providerErr) && providerErr != nil {
		clone := *providerErr
		if clone.Provider == "" {
			clone.Provider = pair.Provider
		}
		if clone.Model == "" {
			clone.Model = pair.Model
		}
		return &clone
	}
	return newProviderError(pair, ClassifyError(err), err)
}
