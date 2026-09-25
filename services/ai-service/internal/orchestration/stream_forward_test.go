package orchestration

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/schema"
)

type streamQuotaCaller struct {
	in, out int64
}

func (*streamQuotaCaller) KillSwitch(context.Context) (bool, string, error) {
	return false, "test", nil
}
func (*streamQuotaCaller) ReserveQuota(context.Context, *int64) (string, error) {
	return "stream-reservation", nil
}
func (c *streamQuotaCaller) FinalizeQuota(_ context.Context, _, _ string, input, output int64) error {
	c.in, c.out = input, output
	return nil
}

func TestForwardStreamDeliversErrorToOpenReader(t *testing.T) {
	sourceReader, sourceWriter := schema.Pipe[*schema.Message](1)
	outReader, outWriter := schema.Pipe[*schema.Message](1)
	go func() {
		_ = sourceWriter.Send(nil, errors.New("stream broke sk-secret"))
		sourceWriter.Close()
	}()
	forwardStream(sourceReader, outWriter, &meterState{}, context.Background(), -1)
	_, err := outReader.Recv()
	if err == nil || !strings.Contains(err.Error(), "stream broke") {
		t.Fatalf("open reader lost the error: %v", err)
	}
	if _, err := outReader.Recv(); !errors.Is(err, io.EOF) {
		t.Fatalf("writer close after error = %v", err)
	}
}

func TestForwardStreamDropsErrorWhenReaderIsClosed(t *testing.T) {
	sourceReader, sourceWriter := schema.Pipe[*schema.Message](2)
	outReader, outWriter := schema.Pipe[*schema.Message](1)
	outReader.Close()
	var observed usage.CallUsage
	state := &meterState{observe: func(_ context.Context, call usage.CallUsage) error {
		observed = call
		return nil
	}}
	index := state.recordPending(nil, true)
	_ = sourceWriter.Send(&schema.Message{ResponseMeta: &schema.ResponseMeta{Usage: &schema.TokenUsage{PromptTokens: 10, CompletionTokens: 2}}}, nil)
	_ = sourceWriter.Send(nil, errors.New("sk-secret dropped"))
	sourceWriter.Close()
	forwardStream(sourceReader, outWriter, state, context.Background(), index)
	if observed.InputTokens == nil || *observed.InputTokens != 10 || observed.OutputTokens == nil || *observed.OutputTokens != 2 {
		t.Fatalf("closed output reader skipped measured usage: %+v", observed)
	}
	if _, err := outReader.Recv(); !errors.Is(err, io.EOF) {
		t.Fatalf("closed reader should see writer close as EOF, got %v", err)
	}
}

func TestForwardStreamPersistsUsageBeforeDeliveringProviderError(t *testing.T) {
	ctx := context.Background()
	caller := &streamQuotaCaller{}
	book, err := usage.NewQuotaBook(t.TempDir(), time.Now, caller)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(ctx, usage.ReserveRequest{RequestID: "req-stream-error", Caller: caller})
	if err != nil {
		t.Fatal(err)
	}
	if err := book.StartCall(ctx, reservation.ID); err != nil {
		t.Fatal(err)
	}

	observeStarted := make(chan struct{})
	releaseObserve := make(chan struct{})
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(releaseObserve) }) }
	state := &meterState{observe: func(ctx context.Context, call usage.CallUsage) error {
		close(observeStarted)
		<-releaseObserve
		return book.Observe(ctx, reservation.ID, call)
	}}
	index := state.recordPending(nil, true)
	sourceReader, sourceWriter := schema.Pipe[*schema.Message](2)
	outReader, outWriter := schema.Pipe[*schema.Message](2)
	if sourceWriter.Send(&schema.Message{ResponseMeta: &schema.ResponseMeta{Usage: &schema.TokenUsage{PromptTokens: 10, CompletionTokens: 2}}}, nil) ||
		sourceWriter.Send(nil, errors.New("provider stream failed")) {
		t.Fatal("source stream closed before the scripted error")
	}
	sourceWriter.Close()
	done := make(chan struct{})
	go func() {
		forwardStream(sourceReader, outWriter, state, ctx, index)
		close(done)
	}()
	defer func() {
		release()
		outReader.Close()
		<-done
	}()
	if _, err := outReader.Recv(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-observeStarted:
	case <-time.After(time.Second):
		t.Fatal("usage observation did not start")
	}
	terminal := make(chan error, 1)
	go func() {
		_, err := outReader.Recv()
		terminal <- err
	}()
	select {
	case err := <-terminal:
		t.Fatalf("terminal stream result arrived before observation completed: %v", err)
	case <-time.After(20 * time.Millisecond):
	}

	release()
	if err := <-terminal; err == nil || !strings.Contains(err.Error(), "provider stream failed") {
		t.Fatalf("terminal stream error = %v", err)
	}
	<-done
	calls, _ := state.snapshot()
	if _, err := book.Finalize(ctx, reservation.ID, usage.Aggregate(calls)); err != nil {
		t.Fatal(err)
	}
	if caller.in != 10 || caller.out != 2 {
		t.Fatalf("finalized quota tokens = %d/%d, want 10/2", caller.in, caller.out)
	}
}
