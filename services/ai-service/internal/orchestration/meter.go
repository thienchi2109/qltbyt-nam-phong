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
	mu         sync.Mutex
	calls      []usage.CallUsage
	streamDone []<-chan struct{}
	streamErr  error
	emitted    bool
	start      func(context.Context) error
	observe    func(context.Context, usage.CallUsage) error
}

func (s *meterState) startCall(ctx context.Context) error {
	if s.start == nil {
		return nil
	}
	return s.start(ctx)
}

func (s *meterState) record(ctx context.Context, message *schema.Message, invoked bool) error {
	if !invoked {
		return nil
	}
	call := callUsage(message)
	s.mu.Lock()
	s.calls = append(s.calls, call)
	if message != nil && (message.Content != "" || len(message.ToolCalls) > 0) {
		s.emitted = true
	}
	s.mu.Unlock()
	return s.persist(ctx, call)
}

func (s *meterState) recordPending(message *schema.Message, invoked bool) int {
	if !invoked {
		return -1
	}
	call := callUsage(message)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls = append(s.calls, call)
	return len(s.calls) - 1
}

func (s *meterState) persist(ctx context.Context, call usage.CallUsage) error {
	if s.observe == nil {
		return nil
	}
	return s.observe(ctx, call)
}

func (s *meterState) persistAt(ctx context.Context, index int) error {
	s.mu.Lock()
	if index < 0 || index >= len(s.calls) {
		s.mu.Unlock()
		return nil
	}
	call := s.calls[index]
	s.mu.Unlock()
	return s.persist(ctx, call)
}

func (s *meterState) trackStream() chan struct{} {
	done := make(chan struct{})
	s.mu.Lock()
	s.streamDone = append(s.streamDone, done)
	s.mu.Unlock()
	return done
}

func (s *meterState) waitStreams(ctx context.Context) error {
	s.mu.Lock()
	streams := append([]<-chan struct{}(nil), s.streamDone...)
	s.mu.Unlock()
	for _, done := range streams {
		select {
		case <-done:
		case <-ctx.Done():
			select {
			case <-done:
			default:
				return ctx.Err()
			}
		}
	}
	return nil
}

func (s *meterState) addStreamError(err error) {
	if err == nil {
		return
	}
	s.mu.Lock()
	s.streamErr = errors.Join(s.streamErr, err)
	s.mu.Unlock()
}

func (s *meterState) streamError() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.streamErr
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

func callUsage(message *schema.Message) usage.CallUsage {
	call := usage.CallUsage{ProviderStarted: true}
	if message != nil && message.ResponseMeta != nil && message.ResponseMeta.Usage != nil {
		input := message.ResponseMeta.Usage.PromptTokens
		output := message.ResponseMeta.Usage.CompletionTokens
		call.InputTokens = &input
		call.OutputTokens = &output
	}
	return call
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
	if err := m.state.startCall(ctx); err != nil {
		return nil, err
	}
	message, err := m.inner.Generate(ctx, input, opts...)
	return message, errors.Join(err, m.state.record(ctx, message, true))
}

func (m *meteringModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := m.state.startCall(ctx); err != nil {
		return nil, err
	}
	reader, err := m.inner.Stream(ctx, input, opts...)
	if err != nil {
		return nil, errors.Join(err, m.state.record(ctx, nil, true))
	}
	index := m.state.recordPending(nil, true)
	done := m.state.trackStream()
	outgoing, writer := schema.Pipe[*schema.Message](8)
	go func() {
		defer close(done)
		forwardStream(reader, writer, m.state, ctx, index)
	}()
	return outgoing, nil
}

func forwardStream(reader *schema.StreamReader[*schema.Message], writer *schema.StreamWriter[*schema.Message], state *meterState, ctx context.Context, callIndex int) {
	var terminalErr error
	var closeReader sync.Once
	closeSource := func() { closeReader.Do(reader.Close) }
	stopClose := context.AfterFunc(ctx, closeSource)
	defer stopClose()
	defer func() {
		closeSource()
		if err := state.persistAt(ctx, callIndex); err != nil {
			terminalErr = errors.Join(terminalErr, err)
		}
		state.addStreamError(terminalErr)
		if terminalErr != nil {
			_ = writer.Send(nil, terminalErr)
		}
		writer.Close()
	}()
	for {
		chunk, err := reader.Recv()
		if errors.Is(err, io.EOF) {
			return
		}
		if err != nil {
			terminalErr = err
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
