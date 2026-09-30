package provider

import (
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

func TestResolveRetainsThreeTransports(t *testing.T) {
	gateway, err := Resolve(map[string]string{})
	if err != nil || gateway.Transport != protocol.TransportGateway || gateway.Model != protocol.DefaultGatewayModel {
		t.Fatalf("gateway = %+v %v", gateway, err)
	}
	google, err := Resolve(map[string]string{"GOOGLE_GENERATIVE_AI_API_KEY": "key-a"})
	if err != nil || google.Transport != protocol.TransportGoogle || google.Model != protocol.DefaultGoogleModel {
		t.Fatalf("google = %+v %v", google, err)
	}
	compatible, err := Resolve(map[string]string{
		"AI_DEFAULT_CHAT_PROVIDER": "openai-compatible",
		"AI_DEFAULT_CHAT_MODEL":    "stub-model",
	})
	if err != nil || compatible.Transport != protocol.TransportOpenAICompatible || compatible.Model != "stub-model" {
		t.Fatalf("compatible = %+v %v", compatible, err)
	}
	if _, err := Resolve(map[string]string{"AI_PROVIDER": "bifrost"}); err == nil {
		t.Fatal("unsupported transport was accepted")
	}
	nvidia, err := ConfigFromEnv(map[string]string{
		"AI_PROVIDER":     "nvidia",
		"AI_MODEL":        "google/gemma-4-31b-it",
		"NVIDIA_API_KEY":  "secret",
		"NVIDIA_BASE_URL": "https://integrate.api.nvidia.com/v1/chat/completions",
	})
	if err != nil || nvidia.Transport != protocol.TransportNVIDIA || nvidia.Model != "google/gemma-4-31b-it" {
		t.Fatalf("nvidia = %+v %v", nvidia, err)
	}
}

func TestChainConfigFromEnvIsOrderedAndRequiresSecrets(t *testing.T) {
	chain, err := ChainConfigFromEnv(map[string]string{
		"AI_PROVIDER_CHAIN":            "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite",
		"NVIDIA_API_KEY":               "nvidia-secret",
		"NVIDIA_BASE_URL":              "https://integrate.api.nvidia.com/v1/chat/completions",
		"GOOGLE_GENERATIVE_AI_API_KEY": "google-secret",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(chain.Pairs) != 2 || chain.Pairs[0].Priority != 1 || chain.Pairs[0].Provider != protocol.TransportNVIDIA || chain.Pairs[1].Provider != protocol.TransportGoogle || chain.Pairs[1].Model != "gemini-3.5-flash-lite" {
		t.Fatalf("chain = %+v", chain)
	}
	if _, err := ChainConfigFromEnv(map[string]string{"AI_PROVIDER_CHAIN": "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite", "NVIDIA_API_KEY": "only-one", "NVIDIA_BASE_URL": "https://example.test/v1"}); err == nil {
		t.Fatal("missing fallback secret was accepted")
	}
}

func TestChainConfigFromEnvRejectsUnapprovedProviderModelPairs(t *testing.T) {
	base := map[string]string{
		"NVIDIA_API_KEY":               "nvidia-secret",
		"NVIDIA_BASE_URL":              "https://example.test/v1",
		"GOOGLE_GENERATIVE_AI_API_KEY": "google-secret",
	}
	for _, chain := range []string{
		"nvidia/google/gemma-4-26b-a4b-it,google/gemini-3.5-flash-lite",
		"nvidia/google/gemma-4-31b-it,google/gemini-3.8-flash",
		"nvidia/google/gemma-4-31b-it,openai-compatible/gpt-4.1",
	} {
		env := cloneEnv(base)
		env["AI_PROVIDER_CHAIN"] = chain
		if _, err := ChainConfigFromEnv(env); err == nil {
			t.Fatalf("unapproved chain %q was accepted", chain)
		}
	}
}

func TestChainConfigFromEnvAllowsGeminiFirst(t *testing.T) {
	chain, err := ChainConfigFromEnv(map[string]string{
		"AI_PROVIDER_CHAIN":            "google/gemini-3.5-flash-lite,nvidia/google/gemma-4-31b-it",
		"NVIDIA_API_KEY":               "nvidia-secret",
		"NVIDIA_BASE_URL":              "https://example.test/v1",
		"GOOGLE_GENERATIVE_AI_API_KEY": "google-secret",
	})
	if err != nil {
		t.Fatalf("gemini-first chain: %v", err)
	}
	if len(chain.Pairs) != 2 || chain.Pairs[0].Provider != protocol.TransportGoogle || chain.Pairs[0].Model != "gemini-3.5-flash-lite" || chain.Pairs[1].Provider != protocol.TransportNVIDIA || chain.Pairs[1].Model != "google/gemma-4-31b-it" {
		t.Fatalf("gemini-first pairs = %+v", chain.Pairs)
	}
}

func TestGoogleTransportStripsProviderPrefix(t *testing.T) {
	resolved, err := Resolve(map[string]string{
		"AI_PROVIDER": "google",
		"AI_MODEL":    "google/gemini-3.1-flash-lite-preview",
	})
	if err != nil || resolved.Transport != protocol.TransportGoogle || resolved.Model != "gemini-3.1-flash-lite-preview" {
		t.Fatalf("google = %+v %v", resolved, err)
	}
	gateway, err := Resolve(map[string]string{
		"AI_PROVIDER":           "gateway",
		"AI_DEFAULT_CHAT_MODEL": "google/gemini-3.1-flash-lite-preview",
	})
	if err != nil || gateway.Model != "google/gemini-3.1-flash-lite-preview" {
		t.Fatalf("gateway = %+v %v", gateway, err)
	}
}

func TestThinkingLevelOnlyForGemini(t *testing.T) {
	if ThinkingLevel("google/gemini-3.1-flash-lite-preview") != "medium" {
		t.Fatal("gateway gemini model lost medium thinking")
	}
	if ThinkingLevel("gemini-3.1-flash-lite-preview") != "medium" {
		t.Fatal("google gemini model lost medium thinking")
	}
	if ThinkingLevel("gemma-3") != "" || ThinkingLevel("openai/gpt-4.1") != "" {
		t.Fatal("non-gemini model received a thinking level")
	}
}

func TestKeyPoolRotatesOnQuotaAndResetsHourly(t *testing.T) {
	pool := newKeyPool([]string{"key-a", "key-b"})
	now := time.Unix(1_700_000_000, 0)
	index, key, ok := pool.current(now)
	if !ok || index != 0 || key != "key-a" {
		t.Fatalf("first = (%d,%q,%v)", index, key, ok)
	}
	index, key, ok = pool.current(now)
	if !ok || index != 0 || key != "key-a" {
		t.Fatalf("sticky key changed without quota error: (%d,%q,%v)", index, key, ok)
	}
	if !pool.rotate(now, 0) {
		t.Fatal("rotation did not move to the second key")
	}
	index, key, ok = pool.current(now)
	if !ok || index != 1 || key != "key-b" {
		t.Fatalf("rotated = (%d,%q,%v)", index, key, ok)
	}
	if pool.rotate(now, 1) {
		t.Fatal("exhausted pool returned another key")
	}
	index, key, ok = pool.current(now.Add(time.Hour))
	if !ok || index != 1 || key != "key-b" {
		t.Fatalf("reset = (%d,%q,%v)", index, key, ok)
	}
}
