package phase0proof

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

type proofState struct {
	mu           sync.Mutex
	generateCall int
	streamCall   int
	toolCall     int
	usage        []schema.TokenUsage
	providerStop chan struct{}
	toolStop     chan struct{}
	providerOnce sync.Once
	toolOnce     sync.Once
}

func newProofState() *proofState {
	return &proofState{
		providerStop: make(chan struct{}),
		toolStop:     make(chan struct{}),
	}
}

func (s *proofState) addUsage(usage schema.TokenUsage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.usage = append(s.usage, usage)
}

func (s *proofState) signalProviderStop() {
	s.providerOnce.Do(func() { close(s.providerStop) })
}

func (s *proofState) signalToolStop() {
	s.toolOnce.Do(func() { close(s.toolStop) })
}

type scriptedModel struct {
	state        *proofState
	structured   bool
	streamCancel bool
}

var _ model.ToolCallingChatModel = (*scriptedModel)(nil)

func (m *scriptedModel) WithTools(_ []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	return m, nil
}

func (m *scriptedModel) Generate(ctx context.Context, input []*schema.Message, _ ...model.Option) (*schema.Message, error) {
	if err := ctx.Err(); err != nil {
		m.state.signalProviderStop()
		return nil, err
	}

	m.state.mu.Lock()
	m.state.generateCall++
	m.state.mu.Unlock()

	usage := schema.TokenUsage{PromptTokens: 10, CompletionTokens: 3, TotalTokens: 13}
	if m.structured {
		usage = schema.TokenUsage{PromptTokens: 5, CompletionTokens: 2, TotalTokens: 7}
	}
	m.state.addUsage(usage)

	message := &schema.Message{
		Role: schema.Assistant,
		ResponseMeta: &schema.ResponseMeta{
			FinishReason: "stop",
			Usage:        &usage,
		},
	}
	if m.structured {
		message.Content = `{"equipment_id":42,"summary":"needs inspection"}`
		return message, nil
	}

	if len(input) > 0 && input[len(input)-1].Role == schema.Tool {
		message.Content = "tool result accepted"
		return message, nil
	}

	message.ResponseMeta.FinishReason = "tool_calls"
	message.ToolCalls = []schema.ToolCall{{
		ID:   "call-phase0",
		Type: "function",
		Function: schema.FunctionCall{
			Name:      "lookup_equipment",
			Arguments: `{"value":"phase0"}`,
		},
	}}
	return message, nil
}

func (m *scriptedModel) Stream(ctx context.Context, _ []*schema.Message, _ ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	m.state.mu.Lock()
	m.state.streamCall++
	m.state.mu.Unlock()

	if m.streamCancel {
		reader, writer := schema.Pipe[*schema.Message](1)
		go func() {
			defer writer.Close()
			select {
			case <-ctx.Done():
				m.state.signalProviderStop()
			case <-time.After(5 * time.Second):
				_ = writer.Send(schema.AssistantMessage("late", nil), nil)
			}
		}()
		return reader, nil
	}

	first := schema.AssistantMessage("hello ", nil)
	first.ResponseMeta = &schema.ResponseMeta{Usage: &schema.TokenUsage{PromptTokens: 4, CompletionTokens: 1, TotalTokens: 5}}
	last := schema.AssistantMessage("world", nil)
	last.ResponseMeta = &schema.ResponseMeta{Usage: &schema.TokenUsage{PromptTokens: 4, CompletionTokens: 2, TotalTokens: 6}}
	return schema.StreamReaderFromArray([]*schema.Message{first, last}), nil
}

type lookupInput struct {
	Value string `json:"value" description:"value to look up"`
}

type repairDraft struct {
	EquipmentID int    `json:"equipment_id"`
	Summary     string `json:"summary"`
}

func TestEinoStreamToolLoopStructuredExtractionAndUsage(t *testing.T) {
	ctx := context.Background()
	state := newProofState()
	baseModel := &scriptedModel{state: state}

	toolImpl, err := utils.InferTool(
		"lookup_equipment",
		"Look up one equipment record.",
		func(_ context.Context, input lookupInput) (string, error) {
			state.mu.Lock()
			state.toolCall++
			state.mu.Unlock()
			return "equipment:" + input.Value, nil
		},
	)
	if err != nil {
		t.Fatal(err)
	}

	agent, err := react.NewAgent(ctx, &react.AgentConfig{
		ToolCallingModel: baseModel,
		ToolsConfig: compose.ToolsNodeConfig{
			Tools: []tool.BaseTool{toolImpl},
		},
		MaxStep: 4,
	})
	if err != nil {
		t.Fatal(err)
	}
	result, err := agent.Generate(ctx, []*schema.Message{schema.UserMessage("inspect equipment")})
	if err != nil {
		t.Fatal(err)
	}
	if result.Content != "tool result accepted" {
		t.Fatalf("tool loop result = %q", result.Content)
	}

	streamReader, err := baseModel.Stream(ctx, []*schema.Message{schema.UserMessage("stream")})
	if err != nil {
		t.Fatal(err)
	}
	var streamed strings.Builder
	for {
		chunk, recvErr := streamReader.Recv()
		if errors.Is(recvErr, io.EOF) {
			break
		}
		if recvErr != nil {
			t.Fatal(recvErr)
		}
		streamed.WriteString(chunk.Content)
	}
	streamReader.Close()
	if streamed.String() != "hello world" {
		t.Fatalf("stream content = %q", streamed.String())
	}

	extractionModel := &scriptedModel{state: state, structured: true}
	extracted, err := extractionModel.Generate(ctx, []*schema.Message{schema.UserMessage("extract")})
	if err != nil {
		t.Fatal(err)
	}
	var draft repairDraft
	if err := json.Unmarshal([]byte(extracted.Content), &draft); err != nil {
		t.Fatal(err)
	}
	if draft.EquipmentID != 42 || draft.Summary != "needs inspection" {
		t.Fatalf("structured extraction = %+v", draft)
	}

	state.mu.Lock()
	defer state.mu.Unlock()
	if state.generateCall != 3 {
		t.Fatalf("generate calls = %d, want primary tool loop (2) plus secondary extraction (1)", state.generateCall)
	}
	if state.toolCall != 1 {
		t.Fatalf("tool calls = %d, want 1", state.toolCall)
	}
	var promptTokens, completionTokens int
	for _, usage := range state.usage {
		promptTokens += usage.PromptTokens
		completionTokens += usage.CompletionTokens
	}
	if promptTokens != 25 || completionTokens != 8 {
		t.Fatalf("aggregated usage = (%d,%d), want (25,8)", promptTokens, completionTokens)
	}
}

func TestEinoStreamingPrimaryAndSecondaryUsageAggregate(t *testing.T) {
	ctx := context.Background()
	primary := &scriptedModel{state: newProofState()}
	stream, err := primary.Stream(ctx, []*schema.Message{schema.UserMessage("primary stream")})
	if err != nil {
		t.Fatal(err)
	}
	var primaryUsage schema.TokenUsage
	for {
		message, recvErr := stream.Recv()
		if errors.Is(recvErr, io.EOF) {
			break
		}
		if recvErr != nil {
			t.Fatal(recvErr)
		}
		if message.ResponseMeta != nil && message.ResponseMeta.Usage != nil {
			primaryUsage.PromptTokens += message.ResponseMeta.Usage.PromptTokens
			primaryUsage.CompletionTokens += message.ResponseMeta.Usage.CompletionTokens
			primaryUsage.TotalTokens += message.ResponseMeta.Usage.TotalTokens
		}
	}
	stream.Close()

	secondary := &scriptedModel{state: newProofState(), structured: true}
	secondaryMessage, err := secondary.Generate(ctx, []*schema.Message{schema.UserMessage("secondary extraction")})
	if err != nil {
		t.Fatal(err)
	}
	if secondaryMessage.ResponseMeta == nil || secondaryMessage.ResponseMeta.Usage == nil {
		t.Fatal("secondary extraction did not report usage")
	}
	secondaryUsage := secondaryMessage.ResponseMeta.Usage
	if primaryUsage.PromptTokens+secondaryUsage.PromptTokens != 13 || primaryUsage.CompletionTokens+secondaryUsage.CompletionTokens != 5 || primaryUsage.TotalTokens+secondaryUsage.TotalTokens != 18 {
		t.Fatalf("primary plus secondary usage = (%d,%d,%d)",
			primaryUsage.PromptTokens+secondaryUsage.PromptTokens,
			primaryUsage.CompletionTokens+secondaryUsage.CompletionTokens,
			primaryUsage.TotalTokens+secondaryUsage.TotalTokens,
		)
	}
}
