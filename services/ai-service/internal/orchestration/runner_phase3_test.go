package orchestration

import (
	"context"
	"errors"
	"strings"
	"testing"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/schema"
)

type compactCapability struct{}

func (compactCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1"}
}
func (compactCapability) Authorize(context.Context, protocol.Request) error { return nil }
func (compactCapability) Prepare(context.Context, protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{
		Messages: []protocol.Message{{Role: protocol.RoleUser, Content: "lookup"}},
		Tools: []capability.Tool{{
			Name: "lookup_item",
			Run: func(context.Context, string) (string, error) {
				return `{"uiArtifact":{"rawPayload":"SECRET"},"modelSummary":{"summaryText":"compact"}}`, nil
			},
			ModelOutput: func(full string) string {
				if strings.Contains(full, "SECRET") {
					return "compact"
				}
				return full
			},
		}},
		RestrictTools: true,
	}, nil
}
func (compactCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}

func TestModelOutputKeepsUIArtifactInTheTrace(t *testing.T) {
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		last := input[len(input)-1]
		if last.Role == schema.Tool {
			if strings.Contains(last.Content, "SECRET") || !strings.Contains(last.Content, "compact") {
				t.Fatalf("provider saw %q", last.Content)
			}
			return testmodel.UsageMessage("done", "stop", 1, 1), nil
		}
		message := testmodel.UsageMessage("", "tool_calls", 1, 1)
		message.ToolCalls = []schema.ToolCall{{ID: "call-1", Type: "function", Function: schema.FunctionCall{Name: "lookup_item", Arguments: `{}`}}}
		return message, nil
	}}
	runner, _, _ := newRunner(t, compactCapability{}, &staticSession{chat: modelStub})
	request := testRequest()
	request.RequestedTools = []string{"lookup_item"}
	result, err := runner.Run(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	sawSecret := false
	for _, event := range result.Events {
		if event.Type == protocol.EventToolResult && strings.Contains(event.Text, "SECRET") && strings.Contains(event.Text, "uiArtifact") {
			sawSecret = true
		}
	}
	if !sawSecret {
		t.Fatal("trace dropped uiArtifact")
	}
}

type mappingCapability struct{}

func (mappingCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1"}
}
func (mappingCapability) Authorize(context.Context, protocol.Request) error { return nil }
func (mappingCapability) Prepare(_ context.Context, request protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{Messages: request.Messages}, nil
}
func (mappingCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{
		Extraction: []protocol.Message{{Role: protocol.RoleUser, Content: "extract-please"}},
		MapExtraction: func(text string) ([]protocol.Artifact, error) {
			if text != "good" {
				return nil, errors.New("invalid extraction")
			}
			return []protocol.Artifact{{Name: "repairRequestDraft", Payload: []byte(`{"draftOnly":true}`)}}, nil
		},
	}, nil
}

func TestInvalidExtractionKeepsUsageWithoutArtifact(t *testing.T) {
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		if strings.Contains(input[len(input)-1].Content, "extract-please") {
			return testmodel.UsageMessage("bad", "stop", 1, 1), nil
		}
		return testmodel.UsageMessage("hello", "stop", 2, 1), nil
	}}
	runner, _, _ := newRunner(t, mappingCapability{}, &staticSession{chat: modelStub})
	result, err := runner.Run(context.Background(), testRequest())
	if err != nil {
		t.Fatal(err)
	}
	if result.Reconciliation.Attempts != 2 || result.Reconciliation.InputTokens == nil || *result.Reconciliation.InputTokens != 3 || *result.Reconciliation.OutputTokens != 2 {
		t.Fatalf("reconciliation = %+v", result.Reconciliation)
	}
	for _, event := range result.Events {
		if event.Type == protocol.EventArtifact {
			t.Fatal("invalid extraction emitted an artifact")
		}
	}
	if result.Reconciliation.Knowledge != usage.KnowledgeKnownPositive {
		t.Fatalf("knowledge = %s", result.Reconciliation.Knowledge)
	}
}
