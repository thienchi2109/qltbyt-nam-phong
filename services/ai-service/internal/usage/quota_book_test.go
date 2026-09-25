package usage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

type recordedFinalize struct {
	id     string
	status string
	in     int64
	out    int64
}

type spyCaller struct {
	mu            sync.Mutex
	blocked       bool
	kills         int
	reserves      int
	reserveID     string
	finalizes     []recordedFinalize
	finalizeFails int
	hang          bool
}

func (s *spyCaller) KillSwitch(context.Context) (bool, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.kills++
	return s.blocked, "spy", nil
}

func (s *spyCaller) ReserveQuota(context.Context, *int64) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reserves++
	if s.reserveID == "" {
		return "", errors.New("missing reservation")
	}
	return s.reserveID, nil
}

func (s *spyCaller) FinalizeQuota(ctx context.Context, reservationID, status string, inputTokens, outputTokens int64) error {
	if s.hang {
		<-ctx.Done()
		return ctx.Err()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.finalizes = append(s.finalizes, recordedFinalize{id: reservationID, status: status, in: inputTokens, out: outputTokens})
	if s.finalizeFails > 0 {
		s.finalizeFails--
		return errors.New("quota rpc failed")
	}
	return nil
}

func (s *spyCaller) finalizeCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.finalizes)
}

func newTestBook(t *testing.T, caller QuotaCaller) (*QuotaBook, *spyCaller) {
	t.Helper()
	spy, _ := caller.(*spyCaller)
	if spy == nil {
		spy = &spyCaller{reserveID: "res-1"}
		caller = spy
	}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	return book, spy
}

func TestQuotaBookNilCallerFailsClosed(t *testing.T) {
	book, spy := newTestBook(t, &spyCaller{reserveID: "res-1"})
	if _, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-1"}); err == nil || spy.reserves != 0 || spy.kills != 0 {
		t.Fatalf("nil caller err=%v reserves=%d", err, spy.reserves)
	}
}

func TestQuotaMappingAndIdempotentFinalize(t *testing.T) {
	clock := time.Unix(1_700_000_000, 0).UTC()
	dir := t.TempDir()
	spy := &spyCaller{reserveID: "res-map"}
	book, err := NewQuotaBook(dir, func() time.Time { return clock }, spy)
	if err != nil {
		t.Fatal(err)
	}
	zero := 0
	positiveIn, positiveOut := 12, 8
	partialIn := 5
	cases := []struct {
		name    string
		call    *CallUsage
		status  string
		in      int64
		out     int64
		marker  string
		refund  bool
		measure bool
	}{
		{name: "known zero", call: &CallUsage{ProviderStarted: true, InputTokens: &zero, OutputTokens: &zero}, status: rpcSuccess, marker: UncertaintyMeasured, measure: true},
		{name: "known positive", call: &CallUsage{ProviderStarted: true, InputTokens: &positiveIn, OutputTokens: &positiveOut}, status: rpcSuccess, in: 12, out: 8, marker: UncertaintyMeasured, measure: true},
		{name: "partial", call: &CallUsage{ProviderStarted: true, InputTokens: &partialIn}, status: rpcErrorWithUsage, in: 5, marker: UncertaintyPartial},
		{name: "unknown", call: &CallUsage{ProviderStarted: true}, status: rpcErrorWithUsage, marker: UncertaintyUnknown},
		{name: "provider not started", status: rpcErrorNoUsage, marker: UncertaintyNoProviderWork, refund: true},
	}
	var stored []Reconciliation
	for i, test := range cases {
		spy.reserveID = "res-" + test.name
		reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-" + test.name, Caller: spy, TTL: protocol.ReservationTTL})
		if err != nil {
			t.Fatal(err)
		}
		if test.call != nil {
			if err := book.Observe(context.Background(), reservation.ID, *test.call); err != nil {
				t.Fatal(err)
			}
		}
		record, err := book.Finalize(context.Background(), reservation.ID, Observation{})
		if err != nil {
			t.Fatal(err)
		}
		got := spy.finalizes[i]
		if got.status != test.status || got.in != test.in || got.out != test.out || record.Uncertainty != test.marker || record.Refund != test.refund || record.Measured != test.measure {
			t.Fatalf("%s rpc=%+v record=%+v", test.name, got, record)
		}
		if test.name == "partial" && record.OutputTokens != nil {
			t.Fatalf("partial stored a measured output zero: %+v", record)
		}
		if test.name == "known zero" && (record.InputTokens == nil || *record.InputTokens != 0 || record.Knowledge != KnowledgeKnownZero) {
			t.Fatalf("known zero record = %+v", record)
		}
		if test.name == "unknown" && (record.InputTokens != nil || record.Knowledge != KnowledgeUnknown) {
			t.Fatalf("unknown record = %+v", record)
		}
		stored = append(stored, record)
		again, err := book.Finalize(context.Background(), reservation.ID, Observation{Knowledge: KnowledgeUnknown})
		if err != nil || again != record || spy.finalizeCount() != i+1 {
			t.Fatalf("%s repeated finalize rpc=%d record=%+v", test.name, spy.finalizeCount(), again)
		}
	}
	if stored[0].Knowledge == stored[3].Knowledge || stored[0].Uncertainty == stored[3].Uncertainty || stored[0].Measured == stored[3].Measured {
		t.Fatal("known zero compared equal to unknown")
	}
	if book.Classifications()[UncertaintyMeasured] != 2 {
		t.Fatalf("metrics = %+v", book.Classifications())
	}
	info, err := os.Stat(filepath.Join(dir, journalName))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("journal mode = %o", info.Mode().Perm())
	}
	_ = clock
}

func TestFinalizeRetriesRPCAtMostTwice(t *testing.T) {
	spy := &spyCaller{reserveID: "res-retry", finalizeFails: 1}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-retry", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	input := 3
	if err := book.Observe(context.Background(), reservation.ID, CallUsage{ProviderStarted: true, InputTokens: &input, OutputTokens: &input}); err != nil {
		t.Fatal(err)
	}
	if _, err := book.Finalize(context.Background(), reservation.ID, Observation{}); err != nil || spy.finalizeCount() != 2 {
		t.Fatalf("retry count=%d err=%v", spy.finalizeCount(), err)
	}
	spy.finalizeFails = 5
	reservation, err = book.Reserve(context.Background(), ReserveRequest{RequestID: "req-fail", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	before := spy.finalizeCount()
	if _, err := book.Finalize(context.Background(), reservation.ID, Observation{}); err == nil || spy.finalizeCount()-before != 2 {
		t.Fatalf("bounded retries = %d err=%v", spy.finalizeCount()-before, err)
	}
}

func TestHungFinalizeIsCutAndFastFinalizeFits(t *testing.T) {
	spy := &spyCaller{reserveID: "res-fast"}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-fast", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	if _, err := book.Finalize(context.Background(), reservation.ID, Classify(CallUsage{})); err != nil {
		t.Fatal(err)
	}
	if time.Since(started) >= protocol.CleanupBudget {
		t.Fatal("fast finalize did not fit in the cleanup budget")
	}
	spy.hang = true
	spy.reserveID = "res-hang"
	reservation, err = book.Reserve(context.Background(), ReserveRequest{RequestID: "req-hang", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Millisecond)
	defer cancel()
	started = time.Now()
	_, err = book.Finalize(ctx, reservation.ID, Classify(CallUsage{}))
	if !errors.Is(err, context.DeadlineExceeded) || time.Since(started) > time.Second {
		t.Fatalf("hung finalize err=%v elapsed=%s", err, time.Since(started))
	}
}

func TestJournalIntentFailureRefundsWithoutProvider(t *testing.T) {
	spy := &spyCaller{reserveID: "res-disk"}
	book, err := NewQuotaBook(t.TempDir(), func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy)
	if err != nil {
		t.Fatal(err)
	}
	book.failAppends = 1
	_, err = book.Reserve(context.Background(), ReserveRequest{RequestID: "req-disk", Caller: spy})
	if err == nil || spy.reserves != 1 || spy.finalizeCount() != 1 || spy.finalizes[0].status != rpcErrorNoUsage || spy.finalizes[0].in != 0 || spy.finalizes[0].out != 0 {
		t.Fatalf("err=%v reserves=%d finalizes=%+v", err, spy.reserves, spy.finalizes)
	}
}

func TestTornJournalDoesNotFinalize(t *testing.T) {
	dir := t.TempDir()
	payload := []byte("{\"kind\":\"provider_intent\",\"reservation_id\":\"torn\",\"attempt_id\":\"1\",\"request_id\":\"req\"}\n{\"kind\":\"usage_observed\"")
	if err := os.WriteFile(filepath.Join(dir, journalName), payload, 0o600); err != nil {
		t.Fatal(err)
	}
	spy := &spyCaller{reserveID: "res-torn"}
	if _, err := NewQuotaBook(dir, func() time.Time { return time.Unix(1_700_000_000, 0).UTC() }, spy); !errors.Is(err, errTornJournal) || spy.finalizeCount() != 0 {
		t.Fatalf("torn err=%v finalizes=%d", err, spy.finalizeCount())
	}
}

func TestRecoveryFinalizesOnceBeforeExpiryAndSkipsAfter(t *testing.T) {
	clock := time.Unix(1_700_000_000, 0).UTC()
	dir := t.TempDir()
	spy := &spyCaller{reserveID: "res-replay"}
	now := clock
	book, err := NewQuotaBook(dir, func() time.Time { return now }, spy)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-replay", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	firstIn, firstOut := 12, 8
	secondIn, secondOut := 4, 3
	if err := book.Observe(context.Background(), reservation.ID, CallUsage{ProviderStarted: true, InputTokens: &firstIn, OutputTokens: &firstOut}); err != nil {
		t.Fatal(err)
	}
	if err := book.Observe(context.Background(), reservation.ID, CallUsage{ProviderStarted: true, InputTokens: &secondIn, OutputTokens: &secondOut}); err != nil {
		t.Fatal(err)
	}
	restarted, err := NewQuotaBook(dir, func() time.Time { return now }, spy)
	if err != nil {
		t.Fatal(err)
	}
	if err := restarted.Recover(now); err != nil {
		t.Fatal(err)
	}
	if spy.finalizeCount() != 1 || spy.finalizes[0].status != rpcSuccess || spy.finalizes[0].in != 16 || spy.finalizes[0].out != 11 {
		t.Fatalf("replay = %+v", spy.finalizes)
	}
	replayed, err := restarted.Finalize(context.Background(), reservation.ID, Observation{})
	if err != nil || replayed.Attempts != 2 || spy.finalizeCount() != 1 {
		t.Fatalf("replayed attempts = %+v count=%d err=%v", replayed, spy.finalizeCount(), err)
	}
	if err := restarted.Recover(now); err != nil || spy.finalizeCount() != 1 {
		t.Fatalf("second replay count=%d err=%v", spy.finalizeCount(), err)
	}
	if restarted.Classifications()[UncertaintyMeasured] != 1 {
		t.Fatalf("metrics = %+v", restarted.Classifications())
	}

	expiredDir := t.TempDir()
	expiredSpy := &spyCaller{reserveID: "res-expired"}
	expiredBook, err := NewQuotaBook(expiredDir, func() time.Time { return now }, expiredSpy)
	if err != nil {
		t.Fatal(err)
	}
	expiredReservation, err := expiredBook.Reserve(context.Background(), ReserveRequest{RequestID: "req-expired", Caller: expiredSpy})
	if err != nil {
		t.Fatal(err)
	}
	if err := expiredBook.Observe(context.Background(), expiredReservation.ID, CallUsage{ProviderStarted: true, InputTokens: &firstIn, OutputTokens: &firstOut}); err != nil {
		t.Fatal(err)
	}
	restarted, err = NewQuotaBook(expiredDir, func() time.Time { return now }, expiredSpy)
	if err != nil {
		t.Fatal(err)
	}
	if err := restarted.Recover(expiredReservation.ExpiresAt); err != nil {
		t.Fatal(err)
	}
	if expiredSpy.finalizeCount() != 0 {
		t.Fatalf("expired replay called finalize: %+v", expiredSpy.finalizes)
	}
	if restarted.Classifications()[UncertaintyExpired] != 1 {
		t.Fatalf("expired metrics = %+v", restarted.Classifications())
	}
	record, err := restarted.Finalize(context.Background(), expiredReservation.ID, Observation{})
	if err != nil || record.Measured || record.Refund || record.Uncertainty != UncertaintyExpired || record.InputTokens != nil {
		t.Fatalf("expired record = %+v err=%v", record, err)
	}
}

func TestRecoveryOfIntentWithoutObservationIsUnknown(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	dir := t.TempDir()
	spy := &spyCaller{reserveID: "res-unknown"}
	book, err := NewQuotaBook(dir, func() time.Time { return now }, spy)
	if err != nil {
		t.Fatal(err)
	}
	reservation, err := book.Reserve(context.Background(), ReserveRequest{RequestID: "req-unknown", Caller: spy})
	if err != nil {
		t.Fatal(err)
	}
	restarted, err := NewQuotaBook(dir, func() time.Time { return now }, spy)
	if err != nil {
		t.Fatal(err)
	}
	if err := restarted.Recover(now); err != nil {
		t.Fatal(err)
	}
	if spy.finalizeCount() != 1 || spy.finalizes[0].status != rpcErrorWithUsage || spy.finalizes[0].in != 0 || spy.finalizes[0].out != 0 {
		t.Fatalf("unknown replay = %+v", spy.finalizes)
	}
	record, err := restarted.Finalize(context.Background(), reservation.ID, Observation{})
	if err != nil || record.Refund || record.Measured || record.Uncertainty != UncertaintyUnknown || record.Knowledge == KnowledgeKnownZero {
		t.Fatalf("record = %+v err=%v", record, err)
	}
	if spy.finalizeCount() != 1 {
		t.Fatalf("replay finalized again: %d", spy.finalizeCount())
	}
}
