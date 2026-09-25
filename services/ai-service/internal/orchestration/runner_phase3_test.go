package orchestration

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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

type durableJournalCapability struct {
	caller usage.QuotaCaller
}

func (durableJournalCapability) Descriptor() capability.Descriptor {
	return capability.Descriptor{AppID: "second-app", CapabilityID: "echo", Version: "v1"}
}
func (durableJournalCapability) Authorize(context.Context, protocol.Request) error { return nil }
func (c durableJournalCapability) Prepare(_ context.Context, request protocol.Request) (capability.Prepared, error) {
	return capability.Prepared{
		Messages:    request.Messages,
		QuotaCaller: c.caller,
		Tools: []capability.Tool{{
			Name: "lookup_item",
			Run:  func(context.Context, string) (string, error) { return "found", nil },
		}},
	}, nil
}
func (durableJournalCapability) AfterPrimary(context.Context, protocol.Request, capability.PrimaryOutput) (capability.FollowUp, error) {
	return capability.FollowUp{}, nil
}

type durableJournalCaller struct{}

func (durableJournalCaller) KillSwitch(context.Context) (bool, string, error) { return false, "", nil }
func (durableJournalCaller) ReserveQuota(context.Context, *int64) (string, error) {
	return "res-durable", nil
}
func (durableJournalCaller) FinalizeQuota(context.Context, string, string, int64, int64) error {
	return nil
}

func TestRunnerPersistsFirstCallUsageBeforeNextToolLoopCall(t *testing.T) {
	dir := t.TempDir()
	const journalPath = "usage.journal"
	calls := 0
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		calls++
		if calls == 2 {
			journal, err := os.ReadFile(filepath.Join(dir, journalPath))
			if err != nil {
				return nil, err
			}
			if !strings.Contains(string(journal), `"kind":"usage_observed"`) ||
				!strings.Contains(string(journal), `"input_tokens":4`) ||
				!strings.Contains(string(journal), `"output_tokens":1`) {
				return nil, errors.New("first call usage was not durable before the next provider call")
			}
			return testmodel.UsageMessage("done", "stop", 3, 2), nil
		}
		if len(input) > 0 && input[len(input)-1].Role == schema.Tool {
			return nil, errors.New("tool loop returned to the provider without issuing its second call")
		}
		message := testmodel.UsageMessage("", "tool_calls", 4, 1)
		message.ToolCalls = []schema.ToolCall{{ID: "call-1", Type: "function", Function: schema.FunctionCall{Name: "lookup_item", Arguments: `{}`}}}
		return message, nil
	}}
	session := &staticSession{chat: modelStub}
	runner, _, _ := newRunner(t, durableJournalCapability{caller: durableJournalCaller{}}, session)
	book, err := usage.NewQuotaBook(dir, func() time.Time { return time.Unix(1_700_000_000, 0) }, nil)
	if err != nil {
		t.Fatal(err)
	}
	runner.Usage = book
	request := testRequest()
	request.RequestedTools = []string{"lookup_item"}
	if _, err := runner.Run(context.Background(), request); err != nil {
		t.Fatal(err)
	}
	if calls != 2 {
		t.Fatalf("provider calls = %d, want 2", calls)
	}
}

func TestRunnerStreamCancellationPersistsReceivedUsageBeforeFinalize(t *testing.T) {
	started := make(chan struct{})
	modelStub := &testmodel.Scripted{StreamFunc: func(ctx context.Context, _ []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
		reader, writer := schema.Pipe[*schema.Message](0)
		go func() {
			writer.Send(&schema.Message{Content: "partial", ResponseMeta: &schema.ResponseMeta{Usage: &schema.TokenUsage{PromptTokens: 10, CompletionTokens: 2}}}, nil)
			close(started)
			<-ctx.Done()
			_ = writer.Send(nil, ctx.Err())
			writer.Close()
		}()
		return reader, nil
	}}
	caller := durableJournalCaller{}
	runner, _, _ := newRunner(t, durableJournalCapability{caller: caller}, &staticSession{chat: modelStub})
	book, err := usage.NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0) }, nil)
	if err != nil {
		t.Fatal(err)
	}
	runner.Usage = book
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan Result, 1)
	go func() {
		result, _ := runner.Stream(ctx, testRequest())
		done <- result
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("provider stream did not deliver its measured chunk")
	}
	cancel()
	result := <-done
	if !result.Reconciliation.Measured || result.Reconciliation.InputTokens == nil || *result.Reconciliation.InputTokens != 10 || result.Reconciliation.OutputTokens == nil || *result.Reconciliation.OutputTokens != 2 {
		t.Fatalf("canceled stream reconciliation = %+v", result.Reconciliation)
	}
}
