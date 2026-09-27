package provider

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/testmodel"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type fakeSession struct {
	provider string
	model    string
	chat     model.ToolCallingChatModel
}

func (s *fakeSession) Transport() string      { return s.provider }
func (s *fakeSession) ModelName() string      { return s.model }
func (s *fakeSession) ThinkingLevel() string  { return "" }
func (s *fakeSession) KeyIndex() int          { return 0 }
func (s *fakeSession) AttemptLimit() int      { return 1 }
func (s *fakeSession) RotateOnQuota(int) bool { return false }
func (s *fakeSession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	return s.chat, 0, nil
}
func (s *fakeSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func fakePairs() []ProviderModelPair {
	return []ProviderModelPair{
		{Priority: 1, Provider: protocol.TransportNVIDIA, Model: "google/gemma-4-31b-it", Capabilities: DefaultChatProfile},
		{Priority: 2, Provider: protocol.TransportGoogle, Model: "gemini-3.5-flash-lite", Capabilities: DefaultChatProfile},
	}
}

func TestFallbackPrimarySuccessUsesOnlyPrimary(t *testing.T) {
	primary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return testmodel.UsageMessage("primary", "stop", 3, 2), nil
	}}
	secondary := &testmodel.Scripted{}
	chain, err := NewFakeChain(ChainConfig{Pairs: fakePairs(), MaxAttempts: 2}, []Session{
		&fakeSession{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		&fakeSession{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
	})
	if err != nil {
		t.Fatal(err)
	}
	chat, _, err := chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	message, err := chat.Generate(context.Background(), []*schema.Message{schema.UserMessage("hello")})
	if err != nil || message.Content != "primary" {
		t.Fatalf("primary = %#v, %v", message, err)
	}
	if secondary.Calls != 0 {
		t.Fatalf("fallback calls = %d", secondary.Calls)
	}
	chain.MarkProviderOutcome("success", "")
	metadata := chain.Metadata()
	if metadata.Provider != protocol.TransportNVIDIA || metadata.Model != "google/gemma-4-31b-it" || metadata.Outcome != "success" || len(metadata.Attempts) != 1 {
		t.Fatalf("metadata = %+v", metadata)
	}
	encoded, err := json.Marshal(metadata)
	if err != nil || string(encoded) == "" || string(encoded) == "primary" {
		t.Fatalf("metadata encoding = %s", encoded)
	}
	if strings.Contains(string(encoded), "primary") || strings.Contains(string(encoded), "secret") || strings.Contains(string(encoded), "hello") {
		t.Fatalf("metadata leaked content: %s", encoded)
	}
}

func TestNormalizeEventKeepsUsageAndTypedErrorRedacted(t *testing.T) {
	event := NormalizeEvent(testmodel.UsageMessage("hello", "stop", 2, 1), nil)
	if event.Type != EventText || event.Text != "hello" || event.Usage == nil || event.Usage.TotalTokens != 3 {
		t.Fatalf("normalized event = %+v", event)
	}
	errEvent := NormalizeEvent(nil, &ProviderError{Provider: "nvidia", Model: "google/gemma-4-31b-it", Class: ErrorClassQuotaExhausted, Cause: errors.New("raw secret payload")})
	if errEvent.Type != EventError || errEvent.Error == nil || errEvent.Error.Error() == "raw secret payload" {
		t.Fatalf("normalized error = %+v", errEvent)
	}
}

func TestFallbackQuotaBeforeStreamUsesNextPairOnce(t *testing.T) {
	primary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return nil, &ProviderError{Class: ErrorClassQuotaExhausted}
	}}
	secondary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return testmodel.UsageMessage("fallback", "stop", 4, 3), nil
	}}
	chain, err := NewFakeChain(ChainConfig{Pairs: fakePairs(), MaxAttempts: 2}, []Session{
		&fakeSession{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		&fakeSession{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
	})
	if err != nil {
		t.Fatal(err)
	}
	chat, leased, err := chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := chat.Generate(context.Background(), []*schema.Message{schema.UserMessage("hello")}); !IsQuotaError(err) {
		t.Fatalf("primary error = %v", err)
	}
	if !chain.RotateOnQuota(leased) {
		t.Fatal("chain did not advance after pre-stream quota exhaustion")
	}
	chat, _, err = chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	message, err := chat.Generate(context.Background(), []*schema.Message{schema.UserMessage("hello")})
	if err != nil || message.Content != "fallback" {
		t.Fatalf("fallback = %#v, %v", message, err)
	}
	if primary.Calls != 1 || secondary.Calls != 1 {
		t.Fatalf("calls = %d/%d", primary.Calls, secondary.Calls)
	}
	chain.MarkProviderOutcome("success", "")
	metadata := chain.Metadata()
	if len(metadata.Attempts) != 2 || metadata.Attempts[0].Outcome != "fallback" || metadata.Attempts[1].Outcome != "success" {
		t.Fatalf("metadata = %+v", metadata)
	}
}

func TestFallbackMidStreamFailureDoesNotSwitch(t *testing.T) {
	primary := &testmodel.Scripted{StreamFunc: func(context.Context, []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
		reader, writer := schema.Pipe[*schema.Message](2)
		go func() {
			_ = writer.Send(schema.AssistantMessage("partial", nil), nil)
			_ = writer.Send(nil, errors.New("upstream disconnected"))
			writer.Close()
		}()
		return reader, nil
	}}
	secondary := &testmodel.Scripted{}
	chain, err := NewFakeChain(ChainConfig{Pairs: fakePairs(), MaxAttempts: 2}, []Session{
		&fakeSession{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		&fakeSession{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
	})
	if err != nil {
		t.Fatal(err)
	}
	chat, _, err := chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	stream, err := chat.Stream(context.Background(), []*schema.Message{schema.UserMessage("hello")})
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	chunk, err := stream.Recv()
	if err != nil || chunk.Content != "partial" {
		t.Fatalf("first chunk = %#v, %v", chunk, err)
	}
	_, err = stream.Recv()
	if err == nil || errors.Is(err, io.EOF) {
		t.Fatalf("stream error = %v", err)
	}
	if chain.active != 0 || secondary.Calls != 0 {
		t.Fatalf("switched after stream failure: active=%d secondary=%d", chain.active, secondary.Calls)
	}
}

func TestFallbackFailureStopsAtSecondPair(t *testing.T) {
	primary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return nil, &ProviderError{Class: ErrorClassQuotaExhausted}
	}}
	secondary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return nil, &ProviderError{Class: ErrorClassTransport}
	}}
	chain, err := NewFakeChain(ChainConfig{Pairs: fakePairs(), MaxAttempts: 2}, []Session{
		&fakeSession{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		&fakeSession{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
	})
	if err != nil {
		t.Fatal(err)
	}
	chat, leased, err := chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := chat.Generate(context.Background(), []*schema.Message{schema.UserMessage("hello")}); !IsQuotaError(err) {
		t.Fatalf("primary error = %v", err)
	}
	if !chain.RotateOnQuota(leased) {
		t.Fatal("primary did not advance")
	}
	chat, leased, err = chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := chat.Generate(context.Background(), []*schema.Message{schema.UserMessage("hello")}); err == nil || IsQuotaError(err) {
		t.Fatalf("secondary error = %v", err)
	}
	if chain.RotateOnQuota(leased) {
		t.Fatal("chain exceeded two-attempt ceiling")
	}
	if _, _, err := chain.ChatModel(context.Background()); err == nil {
		t.Fatal("exhausted chain returned a model")
	}
}

func TestFallbackConfigFailsClosed(t *testing.T) {
	cases := []struct {
		name string
		cfg  ChainConfig
	}{
		{name: "empty", cfg: ChainConfig{Pairs: nil, MaxAttempts: 2}},
		{name: "duplicate-priority", cfg: ChainConfig{Pairs: []ProviderModelPair{{Priority: 1, Provider: "a", Model: "a"}, {Priority: 1, Provider: "b", Model: "b"}}, MaxAttempts: 2}},
		{name: "incompatible-capabilities", cfg: ChainConfig{Pairs: []ProviderModelPair{{Priority: 1, Provider: "a", Model: "a", Capabilities: DefaultChatProfile}, {Priority: 2, Provider: "b", Model: "b", Capabilities: CapabilityProfile{Streaming: true}}}, MaxAttempts: 2}},
		{name: "invalid-ceiling", cfg: ChainConfig{Pairs: []ProviderModelPair{{Priority: 1, Provider: "a", Model: "a", Capabilities: DefaultChatProfile}}, MaxAttempts: 3}},
		{name: "config-model-mismatch", cfg: ChainConfig{Pairs: []ProviderModelPair{{Priority: 1, Provider: protocol.TransportNVIDIA, Model: "google/gemma-4-31b-it", Config: Config{Transport: protocol.TransportNVIDIA, Model: "google/other-model"}, Capabilities: DefaultChatProfile}, {Priority: 2, Provider: protocol.TransportGoogle, Model: "gemini-3.5-flash-lite", Capabilities: DefaultChatProfile}}, MaxAttempts: 2}},
		{name: "approved-pairs-incompatible", cfg: ChainConfig{Pairs: []ProviderModelPair{{Priority: 1, Provider: protocol.TransportNVIDIA, Model: "google/gemma-4-31b-it", Capabilities: CapabilityProfile{Streaming: true}}, {Priority: 2, Provider: protocol.TransportGoogle, Model: "gemini-3.5-flash-lite", Capabilities: CapabilityProfile{Streaming: true}}}, MaxAttempts: 2}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			if _, err := NewFakeChain(test.cfg, make([]Session, len(test.cfg.Pairs))); err == nil {
				t.Fatal("invalid chain was accepted")
			}
		})
	}
	if _, err := ChainConfigFromEnv(map[string]string{"AI_PROVIDER_CHAIN": "nvidia/google/gemma-4-31b-it,google/gemini-3.5-flash-lite"}); err == nil {
		t.Fatal("missing provider secrets were accepted")
	}
}

func TestFallbackAttemptCeilingIsTwo(t *testing.T) {
	pairs := append(fakePairs(), ProviderModelPair{Priority: 3, Provider: "third", Model: "third", Capabilities: DefaultChatProfile})
	if _, err := NewFakeChain(ChainConfig{Pairs: pairs, MaxAttempts: 3}, []Session{nil, nil, nil}); err == nil {
		t.Fatal("three-attempt chain was accepted")
	}
}

func TestDefaultAttemptLimitAndRateLimitMetadata(t *testing.T) {
	primary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return nil, &ProviderError{Class: ErrorClassRateLimited}
	}}
	chain, err := NewFakeChain(ChainConfig{Pairs: fakePairs()}, []Session{
		&fakeSession{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		&fakeSession{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: &testmodel.Scripted{}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if chain.AttemptLimit() != 2 {
		t.Fatalf("default attempt limit = %d, want 2", chain.AttemptLimit())
	}
	chat, index, err := chain.ChatModel(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := chat.Generate(context.Background(), []*schema.Message{schema.UserMessage("hello")}); !IsQuotaError(err) {
		t.Fatalf("rate-limit error = %v", err)
	}
	chain.MarkProviderOutcome("fallback", string(ErrorClassRateLimited))
	if !chain.RotateOnQuota(index) {
		t.Fatal("rate-limited pair did not advance")
	}
	metadata := chain.Metadata()
	if got := metadata.Attempts[0].ErrorClass; got != string(ErrorClassRateLimited) {
		t.Fatalf("attempt error class = %q", got)
	}
}
