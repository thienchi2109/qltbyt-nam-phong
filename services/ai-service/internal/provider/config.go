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
	case protocol.TransportGateway:
		if !providerPrefixedModel.MatchString(model) {
			return Resolved{}, protocol.NewError(500, protocol.CodeInvalidRequest, "The gateway model id must include a provider prefix.", false)
		}
	case protocol.TransportGoogle:
	case protocol.TransportOpenAICompatible:
		if explicitModel == "" {
			return Resolved{}, protocol.NewError(500, protocol.CodeInvalidRequest, "An explicit model is required for the openai-compatible transport.", false)
		}
	default:
		return Resolved{}, protocol.NewError(400, protocol.CodeInvalidRequest, "The requested model transport is not supported.", false)
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
			return Config{}, protocol.NewError(500, protocol.CodeInvalidRequest, "The gateway transport is missing its API key.", false)
		}
	case protocol.TransportGoogle:
		cfg.APIKeys = GoogleKeys(env)
		cfg.BaseURL = read(env, "GOOGLE_GENERATIVE_AI_BASE_URL")
		if len(cfg.APIKeys) == 0 {
			return Config{}, protocol.NewError(500, protocol.CodeInvalidRequest, "The google transport is missing its API key.", false)
		}
	case protocol.TransportOpenAICompatible:
		cfg.APIKey = read(env, "AI_OPENAI_COMPATIBLE_API_KEY")
		cfg.BaseURL = read(env, "AI_OPENAI_COMPATIBLE_BASE_URL")
		if cfg.BaseURL == "" || cfg.APIKey == "" {
			return Config{}, protocol.NewError(500, protocol.CodeInvalidRequest, "The openai-compatible transport is missing its endpoint or API key.", false)
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

// ThinkingLevel returns medium for Gemini model IDs and empty for every other model.
func ThinkingLevel(model string) string {
	model = strings.TrimPrefix(model, "google/")
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
