package orchestration

import (
	"context"
	"errors"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/provider"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type phase59Session struct {
	provider string
	model    string
	chat     model.ToolCallingChatModel
}

type phase59AcquisitionSession struct {
	provider   string
	model      string
	chat       model.ToolCallingChatModel
	acquireErr error
	calls      int
}

func (s *phase59AcquisitionSession) Transport() string      { return s.provider }
func (s *phase59AcquisitionSession) ModelName() string      { return s.model }
func (s *phase59AcquisitionSession) ThinkingLevel() string  { return "" }
func (s *phase59AcquisitionSession) KeyIndex() int          { return 0 }
func (s *phase59AcquisitionSession) AttemptLimit() int      { return 1 }
func (s *phase59AcquisitionSession) RotateOnQuota(int) bool { return false }
func (s *phase59AcquisitionSession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	s.calls++
	if s.acquireErr != nil {
		return nil, 0, s.acquireErr
	}
	return s.chat, 0, nil
}
func (s *phase59AcquisitionSession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func (s phase59Session) Transport() string      { return s.provider }
func (s phase59Session) ModelName() string      { return s.model }
func (s phase59Session) ThinkingLevel() string  { return "" }
func (s phase59Session) KeyIndex() int          { return 0 }
func (s phase59Session) AttemptLimit() int      { return 1 }
func (s phase59Session) RotateOnQuota(int) bool { return false }
func (s phase59Session) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	return s.chat, 0, nil
}
func (s phase59Session) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func TestProviderFallbackAttributesAttemptsAndUsage(t *testing.T) {
	primary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return nil, &provider.ProviderError{Class: provider.ErrorClassQuotaExhausted}
	}}
	secondary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return testmodel.UsageMessage("fallback", "stop", 4, 3), nil
	}}
	chain, err := provider.NewFakeChain(provider.ChainConfig{Pairs: phase59Pairs(), MaxAttempts: 2}, []provider.Session{
		phase59Session{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		phase59Session{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
	})
	if err != nil {
		t.Fatal(err)
	}
	reg := registry.New()
	if err := reg.Register(echoCapability{}); err != nil {
		t.Fatal(err)
	}
	book := usage.NewMemory(nil)
	runner := &Runner{Registry: reg, Usage: book, Open: func(context.Context, protocol.Request) (ModelSession, error) { return chain, nil }}
	result, err := runner.Run(context.Background(), testRequest())
	if err != nil {
		t.Fatal(err)
	}
	if eventText(result.Events) != "fallback" {
		t.Fatalf("event text = %q", eventText(result.Events))
	}
	if result.Reconciliation.Attempts != 2 || result.Reconciliation.OutputTokens == nil || *result.Reconciliation.OutputTokens != 3 || result.Reconciliation.Knowledge != usage.KnowledgePartial {
		t.Fatalf("reconciliation = %+v", result.Reconciliation)
	}
	if len(result.Provider.Attempts) != 2 || result.Provider.Attempts[0].Outcome != "fallback" || result.Provider.Attempts[1].Outcome != "success" {
		t.Fatalf("provider metadata = %+v", result.Provider)
	}
}

func TestProviderFallbackRetriesQuotaDuringModelAcquisition(t *testing.T) {
	primary := &phase59AcquisitionSession{
		provider:   protocol.TransportNVIDIA,
		model:      "google/gemma-4-31b-it",
		acquireErr: &provider.ProviderError{Class: provider.ErrorClassQuotaExhausted},
	}
	secondary := &phase59AcquisitionSession{
		provider: protocol.TransportGoogle,
		model:    "gemini-3.5-flash-lite",
		chat: &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
			return testmodel.UsageMessage("acquired fallback", "stop", 2, 1), nil
		}},
	}
	chain, err := provider.NewFakeChain(provider.ChainConfig{Pairs: phase59Pairs(), MaxAttempts: 2}, []provider.Session{primary, secondary})
	if err != nil {
		t.Fatal(err)
	}
	runner := newPhase59Runner(t, chain)
	result, err := runner.Run(context.Background(), testRequest())
	if err != nil {
		t.Fatal(err)
	}
	if eventText(result.Events) != "acquired fallback" || primary.calls != 1 || secondary.calls != 1 {
		t.Fatalf("result=%q acquisition calls=%d/%d", eventText(result.Events), primary.calls, secondary.calls)
	}
	if len(result.Provider.Attempts) != 2 || result.Provider.Attempts[0].Outcome != "fallback" {
		t.Fatalf("provider metadata = %+v", result.Provider)
	}
}

func TestProviderFallbackPreservesTerminalQuotaClass(t *testing.T) {
	for _, test := range []struct {
		name  string
		class provider.ErrorClass
	}{
		{name: "quota", class: provider.ErrorClassQuotaExhausted},
		{name: "rate-limit", class: provider.ErrorClassRateLimited},
	} {
		t.Run(test.name, func(t *testing.T) {
			terminal := func(context.Context, []*schema.Message) (*schema.Message, error) {
				return nil, &provider.ProviderError{Class: test.class}
			}
			primary := &testmodel.Scripted{GenerateFunc: terminal}
			secondary := &testmodel.Scripted{GenerateFunc: terminal}
			chain, err := provider.NewFakeChain(provider.ChainConfig{Pairs: phase59Pairs(), MaxAttempts: 2}, []provider.Session{
				phase59Session{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
				phase59Session{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
			})
			if err != nil {
				t.Fatal(err)
			}
			result, runErr := newPhase59Runner(t, chain).Run(context.Background(), testRequest())
			var serviceErr *protocol.Error
			if !errors.As(runErr, &serviceErr) || serviceErr.Code != protocol.CodeProviderQuota {
				t.Fatalf("err = %v", runErr)
			}
			if len(result.Provider.Attempts) != 2 || result.Provider.Outcome != "failure" || result.Provider.Attempts[1].Outcome != "failure" || result.Provider.Attempts[1].ErrorClass != string(test.class) {
				t.Fatalf("provider metadata = %+v", result.Provider)
			}
		})
	}
}

func TestProviderFallbackDoesNotSwitchAfterUsageOnlyStreamEvent(t *testing.T) {
	primary := &testmodel.Scripted{StreamFunc: func(context.Context, []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
		reader, writer := schema.Pipe[*schema.Message](2)
		go func() {
			_ = writer.Send(&schema.Message{Role: schema.Assistant, ResponseMeta: &schema.ResponseMeta{Usage: &schema.TokenUsage{PromptTokens: 2, CompletionTokens: 0, TotalTokens: 2}}}, &provider.ProviderError{Class: provider.ErrorClassQuotaExhausted})
			writer.Close()
		}()
		return reader, nil
	}}
	secondary := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return testmodel.UsageMessage("must not run", "stop", 1, 1), nil
	}}
	chain, err := provider.NewFakeChain(provider.ChainConfig{Pairs: phase59Pairs(), MaxAttempts: 2}, []provider.Session{
		phase59Session{provider: protocol.TransportNVIDIA, model: "google/gemma-4-31b-it", chat: primary},
		phase59Session{provider: protocol.TransportGoogle, model: "gemini-3.5-flash-lite", chat: secondary},
	})
	if err != nil {
		t.Fatal(err)
	}
	runner := newPhase59Runner(t, chain)
	result, err := runner.Stream(context.Background(), testRequest())
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeProviderQuota {
		t.Fatalf("err = %v", err)
	}
	if secondary.Calls != 0 || len(result.Provider.Attempts) != 1 {
		t.Fatalf("fallback switched after metadata-only event: secondary=%d metadata=%+v", secondary.Calls, result.Provider)
	}
}

func phase59Pairs() []provider.ProviderModelPair {
	return []provider.ProviderModelPair{
		{Priority: 1, Provider: protocol.TransportNVIDIA, Model: "google/gemma-4-31b-it", Capabilities: provider.DefaultChatProfile},
		{Priority: 2, Provider: protocol.TransportGoogle, Model: "gemini-3.5-flash-lite", Capabilities: provider.DefaultChatProfile},
	}
}

func newPhase59Runner(t *testing.T, chain *provider.ChainSession) *Runner {
	t.Helper()
	reg := registry.New()
	if err := reg.Register(echoCapability{}); err != nil {
		t.Fatal(err)
	}
	return &Runner{Registry: reg, Usage: usage.NewMemory(nil), Open: func(context.Context, protocol.Request) (ModelSession, error) { return chain, nil }}
}
