// Package testmodel provides an in-process Eino model for core tests.
package testmodel

import (
	"context"
	"sync"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

// Scripted is a ToolCallingChatModel with scripted generate and stream behavior.
type Scripted struct {
	mu           sync.Mutex
	GenerateFunc func(context.Context, []*schema.Message) (*schema.Message, error)
	StreamFunc   func(context.Context, []*schema.Message) (*schema.StreamReader[*schema.Message], error)
	Calls        int
	Inputs       [][]*schema.Message
}

func (m *Scripted) WithTools([]*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	return m, nil
}

func (m *Scripted) Generate(ctx context.Context, input []*schema.Message, _ ...model.Option) (*schema.Message, error) {
	m.mu.Lock()
	m.Calls++
	m.Inputs = append(m.Inputs, append([]*schema.Message(nil), input...))
	generate := m.GenerateFunc
	m.mu.Unlock()
	if generate == nil {
		return schema.AssistantMessage("ok", nil), nil
	}
	return generate(ctx, input)
}

func (m *Scripted) Stream(ctx context.Context, input []*schema.Message, _ ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	m.mu.Lock()
	m.Calls++
	stream := m.StreamFunc
	m.mu.Unlock()
	if stream != nil {
		return stream(ctx, input)
	}
	message, err := m.Generate(ctx, input)
	if err != nil {
		return nil, err
	}
	return schema.StreamReaderFromArray([]*schema.Message{message}), nil
}

func (m *Scripted) CallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.Calls
}

// UsageMessage returns an assistant message with explicit token counts.
func UsageMessage(content, finish string, prompt, completion int) *schema.Message {
	usage := schema.TokenUsage{PromptTokens: prompt, CompletionTokens: completion, TotalTokens: prompt + completion}
	return &schema.Message{
		Role:    schema.Assistant,
		Content: content,
		ResponseMeta: &schema.ResponseMeta{
			FinishReason: finish,
			Usage:        &usage,
		},
	}
}
