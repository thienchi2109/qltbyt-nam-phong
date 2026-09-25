package usage

import (
	"context"
	"errors"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

type blockingCaller struct {
	mu       sync.Mutex
	reserves int
	started  chan struct{}
	release  chan struct{}
	once     sync.Once
}

func (c *blockingCaller) KillSwitch(context.Context) (bool, string, error) {
	return false, "spy", nil
}

func (c *blockingCaller) ReserveQuota(ctx context.Context, _ *int64) (string, error) {
	c.mu.Lock()
	c.reserves++
	c.mu.Unlock()
	c.once.Do(func() { close(c.started) })
	select {
	case <-c.release:
		return "res-overlap", nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

func (c *blockingCaller) FinalizeQuota(context.Context, string, string, int64, int64) error {
	return nil
}

func (c *blockingCaller) reserveCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.reserves
}

func TestOverlappingReserveDoesNotCallQuotaTwice(t *testing.T) {
	caller := &blockingCaller{started: make(chan struct{}), release: make(chan struct{})}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, caller)
	if err != nil {
		t.Fatal(err)
	}
	first := make(chan error, 1)
	go func() {
		_, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-overlap", Caller: caller})
		first <- err
	}()
	select {
	case <-caller.started:
	case <-time.After(time.Second):
		t.Fatal("first reserve did not reach the quota RPC")
	}
	_, err = book.Reserve(context.Background(), ReserveRequest{RequestID: "req-overlap", Caller: caller})
	var serviceErr *protocol.Error
	if !errors.As(err, &serviceErr) || serviceErr.Status != 409 || serviceErr.Message != "The request is already reserved." || caller.reserveCount() != 1 {
		t.Fatalf("overlap err=%v reserves=%d", err, caller.reserveCount())
	}
	close(caller.release)
	if err := <-first; err != nil {
		t.Fatal(err)
	}
	_, err = book.Reserve(context.Background(), ReserveRequest{RequestID: "req-overlap", Caller: caller})
	if !errors.As(err, &serviceErr) || serviceErr.Status != 409 || caller.reserveCount() != 1 {
		t.Fatalf("published claim err=%v reserves=%d", err, caller.reserveCount())
	}
}

func TestIntentRefundFailureIsReturnedAndClaimReleased(t *testing.T) {
	spy := &spyCaller{reserveID: "res-refund", finalizeFails: 1}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	book.FailNextAppends(1)
	_, err = book.Reserve(context.Background(), ReserveRequest{RequestID: "req-refund", Caller: spy})
	if err == nil || !strings.Contains(err.Error(), "usage journal write failed") || !strings.Contains(err.Error(), "quota rpc failed") {
		t.Fatalf("err = %v", err)
	}
	spy.finalizeFails = 0
	if _, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-refund", Caller: spy}); err != nil || spy.reserves != 2 {
		t.Fatalf("claim was not released: err=%v reserves=%d", err, spy.reserves)
	}
}

func TestObserveStopsWhenCleanupContextIsDone(t *testing.T) {
	spy := &spyCaller{reserveID: "res-sync"}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-sync", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	input := 1
	if err := book.Observe(ctx, reservation.ID, CallUsage{ProviderStarted: true, InputTokens: &input, OutputTokens: &input}); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
	prev := journalSync
	started := make(chan struct{})
	release := make(chan struct{})
	journalSync = func(file *os.File) error {
		close(started)
		<-release
		return prev(file)
	}
	defer func() { journalSync = prev }()
	ctx, cancel = context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	errCh := make(chan error, 1)
	go func() {
		errCh <- book.Observe(ctx, reservation.ID, CallUsage{ProviderStarted: true, InputTokens: &input, OutputTokens: &input})
	}()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("journal sync did not start")
	}
	select {
	case err := <-errCh:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("stuck sync err = %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("observe waited for the stuck sync")
	}
	close(release)
}
