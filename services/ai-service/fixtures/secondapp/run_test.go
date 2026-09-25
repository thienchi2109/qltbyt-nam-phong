package secondapp

import (
	"context"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

type session struct {
	chat model.ToolCallingChatModel
}

func (s session) KeyIndex() int          { return 0 }
func (s session) AttemptLimit() int      { return 1 }
func (s session) RotateOnQuota(int) bool { return false }
func (s session) ChatModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}
func (s session) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func TestSecondAppRunsSharedCore(t *testing.T) {
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		last := input[len(input)-1]
		if last.Role == schema.Tool {
			return testmodel.UsageMessage("tool result accepted", "stop", 3, 2), nil
		}
		if strings.Contains(last.Content, `"status"`) {
			return testmodel.UsageMessage(`{"status":"ready"}`, "stop", 1, 1), nil
		}
		message := testmodel.UsageMessage("", "tool_calls", 4, 1)
		message.ToolCalls = []schema.ToolCall{{
			ID: "call-1", Type: "function",
			Function: schema.FunctionCall{Name: ToolName, Arguments: `{"value":"item"}`},
		}}
		return message, nil
	}}
	reg := registry.New()
	if err := reg.Register(Capability{}); err != nil {
		t.Fatal(err)
	}
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(func() time.Time { return time.Unix(1_700_000_000, 0) }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			return session{chat: modelStub}, nil
		},
	}
	result, err := runner.Run(context.Background(), protocol.Request{
		ProtocolVersion:   protocol.ProtocolVersion,
		AppID:             AppID,
		CapabilityID:      CapabilityID,
		CapabilityVersion: Version,
		RequestID:         "second-app-1",
		Messages:          []protocol.Message{{Role: protocol.RoleUser, Content: "lookup"}},
		RequestedTools:    []string{ToolName},
		Context:           map[string]any{"selected_facility_name": "untrusted display"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Reconciliation.InputTokens == nil || *result.Reconciliation.InputTokens != 8 || *result.Reconciliation.OutputTokens != 4 {
		t.Fatalf("usage = %+v", result.Reconciliation)
	}
	sawArtifact := false
	sawFinish := false
	for _, event := range result.Events {
		if event.Type == protocol.EventFinish {
			sawFinish = true
		}
		if event.Type == protocol.EventArtifact {
			if sawFinish {
				t.Fatal("artifact arrived after finish")
			}
			sawArtifact = true
			if !strings.Contains(string(event.Payload), "ready") {
				t.Fatalf("artifact = %s", event.Payload)
			}
		}
	}
	if !sawArtifact {
		t.Fatal("missing artifact")
	}
}
