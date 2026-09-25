package orchestration

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/testmodel"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/schema"
)

type blockingCleanupMemory struct {
	*usage.Memory
	observeDeadline  chan time.Time
	finalizeDeadline chan time.Time
}

func (m *blockingCleanupMemory) Observe(ctx context.Context, _ string, _ usage.CallUsage) error {
	deadline, _ := ctx.Deadline()
	m.observeDeadline <- deadline
	<-ctx.Done()
	return ctx.Err()
}

func (m *blockingCleanupMemory) Finalize(ctx context.Context, _ string, _ usage.Observation) (usage.Reconciliation, error) {
	deadline, _ := ctx.Deadline()
	m.finalizeDeadline <- deadline
	<-ctx.Done()
	return usage.Reconciliation{}, ctx.Err()
}

func TestToolLoopFinalizesMeasuredUsage(t *testing.T) {
	startedCalls, providerCalls := 0, 0
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		providerCalls++
		if startedCalls != providerCalls {
			t.Fatalf("provider call %d started without durable intent %d", providerCalls, providerCalls)
		}
		if len(input) > 0 && input[len(input)-1].Role == schema.Tool {
			return testmodel.UsageMessage("tool result accepted", "stop", 3, 2), nil
		}
		message := testmodel.UsageMessage("", "tool_calls", 4, 1)
		message.ToolCalls = []schema.ToolCall{{
			ID: "call-1", Type: "function",
			Function: schema.FunctionCall{Name: "lookup_item", Arguments: `{"value":"a"}`},
		}}
		return message, nil
	}}
	session := &staticSession{chat: modelStub}
	runner, book, opens := newRunner(t, echoCapability{tool: "lookup_item"}, session)
	runner.Usage = &startTrackingMemory{Memory: book, started: &startedCalls}
	request := testRequest()
	request.RequestedTools = []string{"lookup_item"}
	result, err := runner.Run(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if result.Reconciliation.Knowledge != usage.KnowledgeKnownPositive || !result.Reconciliation.Measured || result.Reconciliation.Refund {
		t.Fatalf("reconciliation = %+v", result.Reconciliation)
	}
	if result.Reconciliation.InputTokens == nil || *result.Reconciliation.InputTokens != 7 || *result.Reconciliation.OutputTokens != 3 || result.Reconciliation.Attempts != 2 {
		t.Fatalf("tokens = %+v %+v attempts=%d", result.Reconciliation.InputTokens, result.Reconciliation.OutputTokens, result.Reconciliation.Attempts)
	}
	if startedCalls != 2 || providerCalls != 2 {
		t.Fatalf("started calls=%d provider calls=%d", startedCalls, providerCalls)
	}
	if !hasEventSequence(result.Events, protocol.EventStart, protocol.EventToolCall, protocol.EventToolResult, protocol.EventText, protocol.EventFinish, protocol.EventDone) {
		t.Fatalf("events = %#v", eventTypes(result.Events))
	}
	if *opens != 1 {
		t.Fatalf("opens = %d", *opens)
	}
	if !strings.Contains(modelStub.Inputs[0][0].Content, "Be brief.") {
		t.Fatal("prompt fragment was not prepended")
	}
}

type startTrackingMemory struct {
	*usage.Memory
	started *int
}

func (m *startTrackingMemory) StartCall(ctx context.Context, reservationID string) error {
	if err := m.Memory.StartCall(ctx, reservationID); err != nil {
		return err
	}
	*m.started++
	return nil
}

func TestClarificationDoesNotReserveOrOpenProvider(t *testing.T) {
	session := &staticSession{chat: &testmodel.Scripted{}}
	runner, book, opens := newRunner(t, echoCapability{clarify: true}, session)
	result, err := runner.Run(context.Background(), testRequest())
	if err != nil {
		t.Fatal(err)
	}
	if result.Reserved || *opens != 0 || book.Observations("req-1:1") != nil {
		t.Fatalf("clarification reserved work: %+v opens=%d", result, *opens)
	}
	if !hasEventSequence(result.Events, protocol.EventStart, protocol.EventText, protocol.EventFinish, protocol.EventDone) {
		t.Fatalf("events = %#v", eventTypes(result.Events))
	}
}

func TestUnknownCapabilityDoesNotOpenProvider(t *testing.T) {
	session := &staticSession{chat: &testmodel.Scripted{}}
	runner, _, opens := newRunner(t, echoCapability{}, session)
	request := testRequest()
	request.CapabilityVersion = "v9"
	_, err := runner.Run(context.Background(), request)
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeCapabilityUnavailable || serviceErr.Retryable || *opens != 0 {
		t.Fatalf("err = %#v opens=%d", err, *opens)
	}
}

func TestQuotaRetryStopsAfterOutputAndKeepsUnknownDistinct(t *testing.T) {
	var calls, startedCalls int
	modelStub := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		calls++
		if startedCalls != calls {
			t.Fatalf("retry call %d started without intent", calls)
		}
		if calls == 1 {
			return nil, errors.New("status 429 quota exceeded")
		}
		return testmodel.UsageMessage("recovered", "stop", 2, 2), nil
	}}
	session := &staticSession{chat: modelStub, limit: 2}
	runner, book, _ := newRunner(t, echoCapability{}, session)
	runner.Usage = &startTrackingMemory{Memory: book, started: &startedCalls}
	result, err := runner.Run(context.Background(), testRequest())
	if err != nil {
		t.Fatal(err)
	}
	if calls != 2 || session.rotations != 1 {
		t.Fatalf("calls=%d rotations=%d", calls, session.rotations)
	}
	if result.Reconciliation.Knowledge != usage.KnowledgePartial || result.Reconciliation.Measured || result.Reconciliation.Refund || result.Reconciliation.Attempts != 2 {
		t.Fatalf("reconciliation = %+v", result.Reconciliation)
	}
}

func TestCancellationAfterProviderStartDoesNotRefund(t *testing.T) {
	started := make(chan struct{})
	modelStub := &testmodel.Scripted{GenerateFunc: func(ctx context.Context, _ []*schema.Message) (*schema.Message, error) {
		close(started)
		<-ctx.Done()
		return nil, ctx.Err()
	}}
	session := &staticSession{chat: modelStub}
	runner, _, _ := newRunner(t, echoCapability{}, session)
	ctx, cancel := context.WithCancel(context.Background())
	type runResult struct {
		result Result
		err    error
	}
	done := make(chan runResult, 1)
	go func() {
		result, err := runner.Run(ctx, testRequest())
		done <- runResult{result: result, err: err}
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("model did not start")
	}
	cancel()
	select {
	case run := <-done:
		var serviceErr *protocol.Error
		if !errors.As(run.err, &serviceErr) || !errors.Is(run.err, context.Canceled) || serviceErr.Code != protocol.CodeCancelled {
			t.Fatalf("err = %#v", run.err)
		}
		if run.result.Reconciliation.Refund || run.result.Reconciliation.Measured || run.result.Reconciliation.Knowledge != usage.KnowledgeUnknown {
			t.Fatalf("cancelled reconciliation = %+v", run.result.Reconciliation)
		}
	case <-time.After(time.Second):
		t.Fatal("run did not return")
	}
}

func TestCancellationSharesOneCleanupDeadlineAcrossObserveAndFinalize(t *testing.T) {
	const budget = 100 * time.Millisecond
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	modelStub := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		cancel()
		return testmodel.UsageMessage("done", "stop", 10, 2), nil
	}}
	runner, memory, _ := newRunner(t, echoCapability{}, &staticSession{chat: modelStub})
	book := &blockingCleanupMemory{
		Memory:           memory,
		observeDeadline:  make(chan time.Time, 1),
		finalizeDeadline: make(chan time.Time, 1),
	}
	runner.Usage = book
	runner.Cleanup = budget
	started := time.Now()
	done := make(chan struct{})
	go func() {
		_, _ = runner.Run(ctx, testRequest())
		close(done)
	}()
	observeDeadline := <-book.observeDeadline
	finalizeDeadline := <-book.finalizeDeadline
	<-done
	if finalizeDeadline.After(observeDeadline.Add(10 * time.Millisecond)) {
		t.Fatalf("finalize deadline %s exceeds observe deadline %s", finalizeDeadline, observeDeadline)
	}
	if elapsed := time.Since(started); elapsed > budget+50*time.Millisecond {
		t.Fatalf("canceled run took %s with a shared cleanup budget of %s", elapsed, budget)
	}
}

func TestProviderFailureHidesSecrets(t *testing.T) {
	modelStub := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		return nil, errors.New("api key sk-secret leaked in prompt hello")
	}}
	session := &staticSession{chat: modelStub}
	runner, _, _ := newRunner(t, echoCapability{}, session)
	result, err := runner.Run(context.Background(), testRequest())
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) {
		t.Fatal(err)
	}
	if strings.Contains(serviceErr.Message, "sk-secret") || strings.Contains(serviceErr.Message, "hello") {
		t.Fatalf("unsanitized message %q", serviceErr.Message)
	}
	if !result.Reserved || result.Reconciliation.Refund {
		t.Fatalf("result = %+v", result.Reconciliation)
	}
}

func TestStreamAggregatesLastUsageSnapshot(t *testing.T) {
	modelStub := &testmodel.Scripted{StreamFunc: func(context.Context, []*schema.Message) (*schema.StreamReader[*schema.Message], error) {
		first := testmodel.UsageMessage("hello ", "", 4, 1)
		last := testmodel.UsageMessage("world", "stop", 4, 2)
		return schema.StreamReaderFromArray([]*schema.Message{first, last}), nil
	}}
	session := &staticSession{chat: modelStub}
	runner, _, _ := newRunner(t, echoCapability{}, session)
	result, err := runner.Stream(context.Background(), testRequest())
	if err != nil {
		t.Fatal(err)
	}
	joined := eventText(result.Events)
	if joined != "hello world" {
		t.Fatalf("stream text = %q", joined)
	}
	if result.Reconciliation.InputTokens == nil || *result.Reconciliation.InputTokens != 4 || *result.Reconciliation.OutputTokens != 2 {
		t.Fatalf("stream usage = %+v", result.Reconciliation)
	}
}

func TestDuplicateRequestDoesNotSpendAgain(t *testing.T) {
	var calls int
	modelStub := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		calls++
		return testmodel.UsageMessage("ok", "stop", 1, 1), nil
	}}
	session := &staticSession{chat: modelStub}
	runner, _, opens := newRunner(t, echoCapability{}, session)
	request := testRequest()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	first, err := runner.Run(ctx, request)
	if !errors.Is(err, context.Canceled) || !first.Reconciliation.Refund || calls != 0 {
		t.Fatalf("first err=%v reconciliation=%+v calls=%d", err, first.Reconciliation, calls)
	}
	_, err = runner.Run(context.Background(), request)
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Status != 409 || serviceErr.Retryable || calls != 0 || *opens != 1 {
		t.Fatalf("duplicate err=%v calls=%d opens=%d", err, calls, *opens)
	}
}

func TestMessageLimitRejectsBeforeProvider(t *testing.T) {
	session := &staticSession{chat: &testmodel.Scripted{}}
	runner, _, opens := newRunner(t, echoCapability{}, session)
	request := testRequest()
	request.Messages = make([]protocol.Message, protocol.DefaultMaxMessages+1)
	for i := range request.Messages {
		request.Messages[i] = protocol.Message{Role: protocol.RoleUser, Content: "x"}
	}
	_, err := runner.Run(context.Background(), request)
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeLimitExceeded || *opens != 0 {
		t.Fatalf("err=%v opens=%d", err, *opens)
	}
}

func TestCancellationStopsToolBeforeAnotherModelCall(t *testing.T) {
	var generates int
	toolStarted := make(chan struct{})
	modelStub := &testmodel.Scripted{GenerateFunc: func(_ context.Context, input []*schema.Message) (*schema.Message, error) {
		generates++
		if len(input) > 0 && input[len(input)-1].Role == schema.Tool {
			return testmodel.UsageMessage("should not continue", "stop", 1, 1), nil
		}
		message := testmodel.UsageMessage("", "tool_calls", 2, 1)
		message.ToolCalls = []schema.ToolCall{{
			ID: "call-1", Type: "function",
			Function: schema.FunctionCall{Name: "lookup_item", Arguments: `{"value":"a"}`},
		}}
		return message, nil
	}}
	session := &staticSession{chat: modelStub}
	runner, _, _ := newRunner(t, blockingCapability{started: toolStarted}, session)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	request := testRequest()
	request.RequestedTools = []string{"lookup_item"}
	done := make(chan error, 1)
	go func() {
		_, err := runner.Run(ctx, request)
		done <- err
	}()
	select {
	case <-toolStarted:
	case <-time.After(time.Second):
		t.Fatal("tool did not start")
	}
	cancel()
	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("err = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("tool cancellation did not return")
	}
	if generates != 1 {
		t.Fatalf("model calls after cancellation = %d", generates)
	}
}

func TestToolStepLimitStopsFurtherToolWork(t *testing.T) {
	var runs int
	modelStub := &testmodel.Scripted{GenerateFunc: func(context.Context, []*schema.Message) (*schema.Message, error) {
		message := testmodel.UsageMessage("", "tool_calls", 1, 1)
		message.ToolCalls = []schema.ToolCall{{
			ID: "call-1", Type: "function",
			Function: schema.FunctionCall{Name: "lookup_item", Arguments: `{"value":"a"}`},
		}}
		return message, nil
	}}
	session := &staticSession{chat: modelStub}
	runner, _, _ := newRunner(t, countingCapability{runs: &runs}, session)
	runner.Limits.MaxToolSteps = 1
	request := testRequest()
	request.RequestedTools = []string{"lookup_item"}
	_, err := runner.Run(context.Background(), request)
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Code != protocol.CodeToolLimit {
		t.Fatalf("err = %v", err)
	}
	if runs != 1 {
		t.Fatalf("tool executions = %d", runs)
	}
}
