package provider

import (
	"context"
	"errors"
	"testing"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"google.golang.org/genai"
)

func TestClassifyTypedProviderErrors(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want ErrorClass
	}{
		{
			name: "openai quota",
			err:  &openai.APIError{HTTPStatusCode: 429, Code: "insufficient_quota"},
			want: ErrorClassQuotaExhausted,
		},
		{
			name: "openai rate limit",
			err:  &openai.APIError{HTTPStatusCode: 429, Code: "rate_limit_exceeded"},
			want: ErrorClassRateLimited,
		},
		{
			name: "gemini quota",
			err:  genai.APIError{Code: 429, Status: "RESOURCE_EXHAUSTED"},
			want: ErrorClassQuotaExhausted,
		},
		{
			name: "gemini rate limit",
			err:  &genai.APIError{Code: 429, Status: "RATE_LIMIT_EXCEEDED"},
			want: ErrorClassRateLimited,
		},
		{
			name: "auth quota wording",
			err:  &openai.APIError{HTTPStatusCode: 401, Code: "invalid_api_key", Message: "quota project"},
			want: ErrorClassTransport,
		},
		{
			name: "server quota wording",
			err:  &openai.APIError{HTTPStatusCode: 503, Code: "insufficient_quota", Message: "quota"},
			want: ErrorClassTransport,
		},
		{
			name: "raw quota wording",
			err:  errors.New("quota project is unavailable"),
			want: ErrorClassTransport,
		},
		{
			name: "deadline",
			err:  context.DeadlineExceeded,
			want: ErrorClassTransport,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := ClassifyError(test.err); got != test.want {
				t.Fatalf("ClassifyError() = %q, want %q", got, test.want)
			}
		})
	}
}
