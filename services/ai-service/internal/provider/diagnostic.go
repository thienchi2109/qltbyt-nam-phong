package provider

import (
	"errors"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
)

// ConfigurationDiagnostic returns a stable startup classification. It never
// includes the public message or the wrapped cause, which may contain secrets.
func ConfigurationDiagnostic(err error) string {
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) && serviceErr != nil {
		switch serviceErr.DiagnosticCode {
		case protocol.DiagnosticProviderConfiguration,
			protocol.DiagnosticProviderConfigurationChain,
			protocol.DiagnosticProviderConfigurationModel,
			protocol.DiagnosticProviderConfigurationCredentials:
			return serviceErr.DiagnosticCode
		}
	}
	return protocol.DiagnosticProviderConfiguration
}

func annotateConfigurationError(err error, diagnosticCode string) error {
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) && serviceErr != nil {
		return serviceErr.WithDiagnostic(diagnosticCode)
	}
	return err
}

// InitializationDiagnostic returns a redacted adapter-open classification.
// Provider and model labels are configuration metadata; wrapped SDK errors are
// deliberately excluded because they can contain credentials or payloads.
func InitializationDiagnostic(err error) string {
	var providerErr *ProviderError
	if !errors.As(err, &providerErr) || providerErr == nil {
		return protocol.DiagnosticProviderInitialization
	}
	parts := []string{protocol.DiagnosticProviderInitialization}
	for _, value := range []string{providerErr.Provider, providerErr.Model, string(providerErr.Class)} {
		label := safeDiagnosticLabel(value)
		if label == "" {
			continue
		}
		parts = append(parts, label)
	}
	return strings.Join(parts, ".")
}

func safeDiagnosticLabel(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = strings.ReplaceAll(value, "/", ".")
	if value == "" || len(value) > 64 {
		return ""
	}
	for _, char := range value {
		if (char < 'a' || char > 'z') && (char < '0' || char > '9') && char != '.' && char != '_' && char != '-' {
			return "redacted"
		}
	}
	return value
}
