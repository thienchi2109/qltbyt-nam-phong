package orchestration

import (
	"context"
	"errors"
	"io"
	"sync"

	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type meterState struct {
	mu      sync.Mutex
	calls   []usage.CallUsage
	emitted bool
}

func (s *meterState) record(message *schema.Message, invoked bool) {
	if !invoked {
		return
	}
	call := usage.CallUsage{ProviderStarted: true}
	if message != nil && message.ResponseMeta != nil && message.ResponseMeta.Usage != nil {
		input := message.ResponseMeta.Usage.PromptTokens
		output := message.ResponseMeta.Usage.CompletionTokens
		call.InputTokens = &input
		call.OutputTokens = &output
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, call)
	if message != nil && (message.Content != "" || len(message.ToolCalls) > 0) {
		s.emitted = true
	}
}

func (s *meterState) mergeStreamUsage(next schema.TokenUsage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.calls) == 0 {
		input := next.PromptTokens
		output := next.CompletionTokens
		s.calls = append(s.calls, usage.CallUsage{
			ProviderStarted: true,
			InputTokens:     &input,
			OutputTokens:    &output,
		})
		return
	}
	last := &s.calls[len(s.calls)-1]
	if last.InputTokens == nil || last.OutputTokens == nil {
		input := next.PromptTokens
		output := next.CompletionTokens
		last.InputTokens = &input
		last.OutputTokens = &output
		return
	}
	if next.PromptTokens >= *last.InputTokens && next.CompletionTokens >= *last.OutputTokens {
		input := next.PromptTokens
		output := next.CompletionTokens
		last.InputTokens = &input
		last.OutputTokens = &output
		return
	}
	input := *last.InputTokens + next.PromptTokens
	output := *last.OutputTokens + next.CompletionTokens
	last.InputTokens = &input
	last.OutputTokens = &output
}

func (s *meterState) snapshot() ([]usage.CallUsage, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	calls := make([]usage.CallUsage, len(s.calls))
	copy(calls, s.calls)
	return calls, s.emitted
}

type meteringModel struct {
	inner model.ToolCallingChatModel
	state *meterState
}

func newMeteringModel(inner model.ToolCallingChatModel, state *meterState) *meteringModel {
	return &meteringModel{inner: inner, state: state}
}

func (m *meteringModel) WithTools(tools []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	inner, err := m.inner.WithTools(tools)
	if err != nil {
		return nil, err
	}
	return &meteringModel{inner: inner, state: m.state}, nil
}

func (m *meteringModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	message, err := m.inner.Generate(ctx, input, opts...)
	m.state.record(message, true)
	return message, err
}

func (m *meteringModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	reader, err := m.inner.Stream(ctx, input, opts...)
	if err != nil {
		m.state.record(nil, true)
		return nil, err
	}
	m.state.record(nil, true)
	outgoing, writer := schema.Pipe[*schema.Message](8)
	go forwardStream(reader, writer, m.state)
	return outgoing, nil
}

func forwardStream(reader *schema.StreamReader[*schema.Message], writer *schema.StreamWriter[*schema.Message], state *meterState) {
	defer writer.Close()
	defer reader.Close()
	for {
		chunk, err := reader.Recv()
		if errors.Is(err, io.EOF) {
			return
		}
		if err != nil {
			_ = writer.Send(nil, err)
			return
		}
		if chunk.ResponseMeta != nil && chunk.ResponseMeta.Usage != nil {
			state.mergeStreamUsage(*chunk.ResponseMeta.Usage)
		}
		if chunk.Content != "" || len(chunk.ToolCalls) > 0 {
			state.mu.Lock()
			state.emitted = true
			state.mu.Unlock()
		}
		if writer.Send(chunk, nil) {
			return
		}
	}
}
