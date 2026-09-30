package provider

import (
	"context"
	"errors"
	"strings"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
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

func TestInitializationDiagnosticKeepsOnlySafeProviderMetadata(t *testing.T) {
	err := &ProviderError{
		Provider: protocol.TransportNVIDIA,
		Model:    "google/gemma-4-31b-it",
		Class:    ErrorClassConfiguration,
		Cause:    errors.New("api-key=authority-secret upstream=private.example"),
	}
	got := InitializationDiagnostic(err)
	want := "provider.initialization.nvidia.google.gemma-4-31b-it.configuration"
	if got != want {
		t.Fatalf("InitializationDiagnostic() = %q, want %q", got, want)
	}
	if strings.Contains(got, "authority-secret") || strings.Contains(got, "private.example") {
		t.Fatalf("InitializationDiagnostic exposed cause: %q", got)
	}
	unsafe := InitializationDiagnostic(&ProviderError{Provider: "nvidia\n", Model: "key=authority-secret", Class: ErrorClassTransport})
	if strings.ContainsAny(unsafe, "\n=") || strings.Contains(unsafe, "authority-secret") {
		t.Fatalf("unsafe adapter metadata escaped: %q", unsafe)
	}
}

func TestConfigurationDiagnosticPreservesOnlyStableClassification(t *testing.T) {
	err := protocol.NewError(500, protocol.CodeInvalidRequest, "The google transport is missing its API key.", false).WithDiagnostic(protocol.DiagnosticProviderConfigurationCredentials)
	if got := ConfigurationDiagnostic(err); got != protocol.DiagnosticProviderConfigurationCredentials {
		t.Fatalf("ConfigurationDiagnostic() = %q, want %q", got, protocol.DiagnosticProviderConfigurationCredentials)
	}
	if got := ConfigurationDiagnostic(errors.New("provider secret=authority-secret")); got != protocol.DiagnosticProviderConfiguration {
		t.Fatalf("unknown configuration error = %q, want %q", got, protocol.DiagnosticProviderConfiguration)
	}
	unsafe := protocol.NewError(500, protocol.CodeInvalidRequest, "configuration", false).WithDiagnostic("provider.configuration.secret=authority-secret")
	if got := ConfigurationDiagnostic(unsafe); got != protocol.DiagnosticProviderConfiguration {
		t.Fatalf("unsafe configuration diagnostic = %q, want %q", got, protocol.DiagnosticProviderConfiguration)
	}
}

func TestNewChainWrapsAdapterOpenFailureWithProviderMetadata(t *testing.T) {
	pairs := ApprovedPhase59Chain()
	pairs[0].Config = Config{Transport: pairs[0].Provider, Model: pairs[0].Model}
	pairs[1].Config = Config{Transport: pairs[1].Provider, Model: pairs[1].Model}
	err := error(nil)
	_, err = NewChain(context.Background(), ChainConfig{Pairs: pairs, MaxAttempts: 2})
	if err == nil {
		t.Fatal("NewChain() unexpectedly accepted missing adapter credentials")
	}
	var providerErr *ProviderError
	if !errors.As(err, &providerErr) || providerErr == nil {
		t.Fatalf("NewChain() error = %T %v, want ProviderError", err, err)
	}
	want := "provider.initialization.nvidia.google.gemma-4-31b-it.configuration"
	if got := InitializationDiagnostic(err); got != want {
		t.Fatalf("InitializationDiagnostic(NewChain()) = %q, want %q", got, want)
	}
}

func TestProviderConfigurationErrorsCarryStableDiagnostics(t *testing.T) {
	if _, err := ChainConfigFromEnv(map[string]string{"AI_PROVIDER_CHAIN": "invalid"}); ConfigurationDiagnostic(err) != protocol.DiagnosticProviderConfigurationChain {
		t.Fatalf("chain configuration diagnostic = %q", ConfigurationDiagnostic(err))
	}
	if _, err := ConfigFromEnv(map[string]string{
		"AI_PROVIDER": "google",
		"AI_MODEL":    "gemini-3.5-flash-lite",
	}); ConfigurationDiagnostic(err) != protocol.DiagnosticProviderConfigurationCredentials {
		t.Fatalf("credential configuration diagnostic = %q", ConfigurationDiagnostic(err))
	}
}
