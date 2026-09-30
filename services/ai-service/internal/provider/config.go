package provider

import (
	"net/http"
	"regexp"
	"strings"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

var providerPrefixedModel = regexp.MustCompile(`(?i)^[a-z0-9][a-z0-9-]*/.+$`)

// Config selects one retained transport. HTTPClient is optional and is used by tests.
type Config struct {
	Transport   string
	Model       string
	APIKey      string
	APIKeys     []string
	BaseURL     string
	MaxTokens   int
	Temperature *float32
	HTTPClient  *http.Client
	Now         func() time.Time
}

// Resolved is the transport decision before credentials are attached.
type Resolved struct {
	Transport string
	Model     string
}

// ChainConfigFromEnv parses an explicit ordered provider/model chain. The
// format is `provider/model,provider/model`; model names may contain further
// slashes. Secrets are read from the existing provider-specific variables.
func ChainConfigFromEnv(env map[string]string) (ChainConfig, error) {
	raw := read(env, "AI_PROVIDER_CHAIN")
	if raw == "" {
		return ChainConfig{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationChain, "The provider fallback chain is missing its configuration.")
	}
	var pairs []ProviderModelPair
	for priority, item := range strings.Split(raw, ",") {
		item = strings.TrimSpace(item)
		separator := strings.IndexByte(item, '/')
		if separator <= 0 || separator == len(item)-1 {
			return ChainConfig{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationChain, "The provider fallback chain contains an invalid pair.")
		}
		providerName := strings.ToLower(strings.TrimSpace(item[:separator]))
		modelName := strings.TrimSpace(item[separator+1:])
		configEnv := cloneEnv(env)
		configEnv["AI_PROVIDER"] = providerName
		configEnv["AI_MODEL"] = modelName
		configEnv["AI_DEFAULT_CHAT_PROVIDER"] = providerName
		configEnv["AI_DEFAULT_CHAT_MODEL"] = modelName
		cfg, err := ConfigFromEnv(configEnv)
		if err != nil {
			return ChainConfig{}, err
		}
		pairs = append(pairs, ProviderModelPair{Priority: priority + 1, Provider: providerName, Model: cfg.Model, Config: cfg, Capabilities: DefaultChatProfile})
	}
	validated, maxAttempts, err := validateChain(ChainConfig{Pairs: pairs, MaxAttempts: 2})
	if err != nil {
		return ChainConfig{}, annotateConfigurationError(err, protocol.DiagnosticProviderConfigurationChain)
	}
	return ChainConfig{Pairs: validated, MaxAttempts: maxAttempts}, nil
}

func cloneEnv(env map[string]string) map[string]string {
	cloned := make(map[string]string, len(env)+4)
	for key, value := range env {
		cloned[key] = value
	}
	return cloned
}

// Resolve applies the retained transport selection rules.
func Resolve(env map[string]string) (Resolved, error) {
	providerName := firstNonEmpty(read(env, "AI_DEFAULT_CHAT_PROVIDER"), read(env, "AI_PROVIDER"))
	if providerName == "" {
		switch {
		case read(env, "AI_MODEL") != "" && read(env, "AI_DEFAULT_CHAT_MODEL") == "":
			providerName = protocol.TransportGoogle
		case len(GoogleKeys(env)) > 0 && read(env, "AI_DEFAULT_CHAT_MODEL") == "":
			providerName = protocol.TransportGoogle
		default:
			providerName = protocol.TransportGateway
		}
	}
	providerName = strings.ToLower(providerName)
	explicitModel := firstNonEmpty(read(env, "AI_DEFAULT_CHAT_MODEL"), read(env, "AI_MODEL"))
	model := explicitModel
	if model == "" {
		if providerName == protocol.TransportGoogle {
			model = protocol.DefaultGoogleModel
		} else {
			model = protocol.DefaultGatewayModel
		}
	}
	switch providerName {
	case protocol.TransportGateway, protocol.TransportNVIDIA:
		if !providerPrefixedModel.MatchString(model) {
			return Resolved{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationModel, "The provider model id must include a provider prefix.")
		}
	case protocol.TransportGoogle:
		model = normalizeGeminiModel(model)
		if model == "" {
			return Resolved{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationModel, "The google transport is missing its model.")
		}
	case protocol.TransportOpenAICompatible:
		if explicitModel == "" {
			return Resolved{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationModel, "An explicit model is required for the openai-compatible transport.")
		}
	default:
		return Resolved{}, providerConfigurationErrorStatus(400, protocol.DiagnosticProviderConfigurationModel, "The requested model transport is not supported.")
	}
	return Resolved{Transport: providerName, Model: model}, nil
}

// ConfigFromEnv resolves a transport and attaches the credentials that transport requires.
func ConfigFromEnv(env map[string]string) (Config, error) {
	resolved, err := Resolve(env)
	if err != nil {
		return Config{}, err
	}
	cfg := Config{Transport: resolved.Transport, Model: resolved.Model, MaxTokens: protocol.DefaultMaxOutputTokens}
	switch resolved.Transport {
	case protocol.TransportGateway:
		cfg.APIKey = read(env, "AI_GATEWAY_API_KEY")
		cfg.BaseURL = read(env, "AI_GATEWAY_BASE_URL")
		if cfg.APIKey == "" {
			return Config{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationCredentials, "The gateway transport is missing its API key.")
		}
	case protocol.TransportNVIDIA:
		cfg.APIKey = firstNonEmpty(read(env, "NVIDIA_API_KEY"), read(env, "AI_NVIDIA_API_KEY"))
		cfg.BaseURL = firstNonEmpty(read(env, "NVIDIA_BASE_URL"), read(env, "AI_NVIDIA_BASE_URL"))
		if cfg.APIKey == "" || cfg.BaseURL == "" {
			return Config{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationCredentials, "The NVIDIA transport is missing its endpoint or API key.")
		}
	case protocol.TransportGoogle:
		cfg.APIKeys = GoogleKeys(env)
		cfg.BaseURL = read(env, "GOOGLE_GENERATIVE_AI_BASE_URL")
		if len(cfg.APIKeys) == 0 {
			return Config{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationCredentials, "The google transport is missing its API key.")
		}
	case protocol.TransportOpenAICompatible:
		cfg.APIKey = read(env, "AI_OPENAI_COMPATIBLE_API_KEY")
		cfg.BaseURL = read(env, "AI_OPENAI_COMPATIBLE_BASE_URL")
		if cfg.BaseURL == "" || cfg.APIKey == "" {
			return Config{}, providerConfigurationError(protocol.DiagnosticProviderConfigurationCredentials, "The openai-compatible transport is missing its endpoint or API key.")
		}
	}
	return cfg, nil
}

// GoogleKeys reads the single-key and comma-separated key-pool variables.
func GoogleKeys(env map[string]string) []string {
	if pool := read(env, "GOOGLE_GENERATIVE_AI_API_KEYS"); pool != "" {
		var keys []string
		for _, key := range strings.Split(pool, ",") {
			key = strings.TrimSpace(key)
			if key != "" {
				keys = append(keys, key)
			}
		}
		if len(keys) > 0 {
			return keys
		}
	}
	if single := read(env, "GOOGLE_GENERATIVE_AI_API_KEY"); single != "" {
		return []string{single}
	}
	return nil
}

// normalizeGeminiModel strips the gateway provider prefix before the Gemini API.
func normalizeGeminiModel(model string) string {
	return strings.TrimPrefix(strings.TrimSpace(model), "google/")
}

// ThinkingLevel returns medium for Gemini model IDs and empty for every other model.
func ThinkingLevel(model string) string {
	model = normalizeGeminiModel(model)
	if strings.HasPrefix(model, "gemini-") {
		return "medium"
	}
	return ""
}

func read(env map[string]string, key string) string {
	if env == nil {
		return ""
	}
	return strings.TrimSpace(env[key])
}

func providerConfigurationError(diagnosticCode, message string) *protocol.Error {
	return providerConfigurationErrorStatus(500, diagnosticCode, message)
}

func providerConfigurationErrorStatus(status int, diagnosticCode, message string) *protocol.Error {
	return protocol.NewError(status, protocol.CodeInvalidRequest, message, false).WithDiagnostic(diagnosticCode)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
