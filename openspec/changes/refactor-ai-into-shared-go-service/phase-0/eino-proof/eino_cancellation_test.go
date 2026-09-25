package phase0proof

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

func TestEinoCancellationStopsProviderStream(t *testing.T) {
	state := newProofState()
	modelStub := &scriptedModel{state: state, streamCancel: true}
	ctx, cancel := context.WithCancel(context.Background())
	reader, err := modelStub.Stream(ctx, []*schema.Message{schema.UserMessage("cancel")})
	if err != nil {
		t.Fatal(err)
	}
	cancel()
	defer reader.Close()

	select {
	case <-state.providerStop:
	case <-time.After(time.Second):
		t.Fatal("provider stream did not observe cancellation")
	}
	state.mu.Lock()
	providerStarted := state.streamCall > 0
	state.mu.Unlock()
	finalized := finalizeObservedUsage(providerStarted, nil, nil)
	if finalized.status != "error_with_usage" || finalized.uncertainty != "unknown" || finalized.refund {
		t.Fatalf("cancelled usage finalization = %+v", finalized)
	}
}

func TestEinoCancellationStopsToolLoop(t *testing.T) {
	state := newProofState()
	modelStub := &scriptedModel{state: state}
	toolImpl, err := utils.InferTool(
		"lookup_equipment",
		"Wait for cancellation.",
		func(ctx context.Context, _ lookupInput) (string, error) {
			select {
			case <-ctx.Done():
				state.signalToolStop()
				return "", ctx.Err()
			case <-time.After(5 * time.Second):
				return "unexpected completion", nil
			}
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	agent, err := react.NewAgent(context.Background(), &react.AgentConfig{
		ToolCallingModel: modelStub,
		ToolsConfig:      compose.ToolsNodeConfig{Tools: []tool.BaseTool{toolImpl}},
		MaxStep:          4,
	})
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	resultCh := make(chan error, 1)
	go func() {
		_, runErr := agent.Generate(ctx, []*schema.Message{schema.UserMessage("cancel tool")})
		resultCh <- runErr
	}()

	deadline := time.After(time.Second)
	for {
		state.mu.Lock()
		calls := state.generateCall
		state.mu.Unlock()
		if calls > 0 {
			break
		}
		select {
		case <-deadline:
			t.Fatal("model did not start")
		default:
			time.Sleep(time.Millisecond)
		}
	}
	cancel()

	select {
	case runErr := <-resultCh:
		if !errors.Is(runErr, context.Canceled) {
			t.Fatalf("agent error = %v, want context.Canceled", runErr)
		}
	case <-time.After(time.Second):
		t.Fatal("agent did not return after cancellation")
	}
	select {
	case <-state.toolStop:
	case <-time.After(time.Second):
		t.Fatal("tool did not observe cancellation")
	}
}
