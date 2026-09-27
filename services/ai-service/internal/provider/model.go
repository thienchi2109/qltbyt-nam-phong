package provider

import (
	"context"
	"errors"
	"io"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// NormalizedEvent is the adapter-level view of an Eino message chunk.
// Orchestration continues to consume Eino messages directly.
type NormalizedEvent struct {
	Type      string
	Text      string
	ToolCalls []schema.ToolCall
	Usage     *schema.TokenUsage
	Error     *ProviderError
}

const (
	EventText     = "text"
	EventToolCall = "tool-call"
	EventUsage    = "usage"
	EventError    = "error"
)

// NormalizeEvent maps Eino's provider-neutral message shape to the adapter
// event vocabulary without exposing an upstream SDK payload.
func NormalizeEvent(message *schema.Message, err error) NormalizedEvent {
	event := NormalizedEvent{}
	if message != nil {
		event.Text = message.Content
		event.ToolCalls = append([]schema.ToolCall(nil), message.ToolCalls...)
		if message.ResponseMeta != nil && message.ResponseMeta.Usage != nil {
			usage := *message.ResponseMeta.Usage
			event.Usage = &usage
		}
	}
	if err != nil {
		event.Type = EventError
		var providerErr *ProviderError
		if errors.As(err, &providerErr) {
			event.Error = providerErr
		}
	} else if len(event.ToolCalls) > 0 {
		event.Type = EventToolCall
	} else if event.Text != "" {
		event.Type = EventText
	} else if event.Usage != nil {
		event.Type = EventUsage
	}
	return event
}

type adapterModel struct {
	inner model.ToolCallingChatModel
	pair  ProviderModelPair
}

func newAdapterModel(inner model.ToolCallingChatModel, pair ProviderModelPair) model.ToolCallingChatModel {
	if inner == nil {
		return nil
	}
	return &adapterModel{inner: inner, pair: pair}
}

func (m *adapterModel) WithTools(tools []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	inner, err := m.inner.WithTools(tools)
	if err != nil {
		return nil, wrapProviderError(m.pair, err)
	}
	return &adapterModel{inner: inner, pair: m.pair}, nil
}

func (m *adapterModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	message, err := m.inner.Generate(ctx, input, opts...)
	return message, wrapProviderError(m.pair, err)
}

func (m *adapterModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	reader, err := m.inner.Stream(ctx, input, opts...)
	if err != nil {
		return nil, wrapProviderError(m.pair, err)
	}
	outgoing, writer := schema.Pipe[*schema.Message](8)
	go func() {
		defer reader.Close()
		defer writer.Close()
		for {
			message, recvErr := reader.Recv()
			if message != nil {
				if writer.Send(message, nil) {
					return
				}
			}
			if errors.Is(recvErr, io.EOF) {
				return
			}
			if recvErr != nil {
				_ = writer.Send(nil, wrapProviderError(m.pair, recvErr))
				return
			}
		}
	}()
	return outgoing, nil
}
