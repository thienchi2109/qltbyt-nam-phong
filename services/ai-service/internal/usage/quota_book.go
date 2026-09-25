package usage

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

const (
	journalName        = "usage.journal"
	kindProviderIntent = "provider_intent"
	kindUsageObserved  = "usage_observed"
	kindFinalized      = "finalized"
	kindExpired        = "expired_uncertain"
)

// QuotaBook is the durable application quota lifecycle. It does not open a database.
// Memory remains the app-neutral lifecycle and does not use this type.
type QuotaBook struct {
	dir         string
	now         func() time.Time
	caller      QuotaCaller
	mu          sync.Mutex
	failAppends int
	slots       map[string]*quotaSlot
	byReq       map[string]string
	metric      classificationMetric
}

type quotaSlot struct {
	requestID    string
	expires      time.Time
	caller       QuotaCaller
	attemptOrder []string
	intents      map[string]struct{}
	usages       map[string]CallUsage
	lost         bool
	final        *Reconciliation
}

type classificationMetric struct {
	mu     sync.Mutex
	counts map[string]int64
}

// NewQuotaBook opens an append-only journal. caller finalizes recovered rows.
func NewQuotaBook(dir string, now func() time.Time, caller QuotaCaller) (*QuotaBook, error) {
	if now == nil {
		now = time.Now
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	book := &QuotaBook{
		dir:    dir,
		now:    now,
		caller: caller,
		slots:  map[string]*quotaSlot{},
		byReq:  map[string]string{},
	}
	if err := book.reload(); err != nil {
		return nil, err
	}
	return book, nil
}

// Classifications returns uncertainty counts. It has no token or identity labels.
func (b *QuotaBook) Classifications() map[string]int64 {
	b.metric.mu.Lock()
	defer b.metric.mu.Unlock()
	out := make(map[string]int64, len(b.metric.counts))
	for label, count := range b.metric.counts {
		out[label] = count
	}
	return out
}

// Observe appends usage_observed and syncs it before any quota finalize RPC.
// A done cleanup context fails the write instead of blocking in Sync.
func (b *QuotaBook) Observe(ctx context.Context, reservationID string, call CallUsage) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	slot, err := b.open(reservationID)
	if err != nil {
		return err
	}
	if slot.final != nil || !b.now().Before(slot.expires) {
		return nil
	}
	attempt := strconv.Itoa(len(slot.usages) + 1)
	if _, ok := slot.intents[attempt]; !ok {
		intent := journalLine{
			Kind: kindProviderIntent, ReservationID: reservationID, RequestID: slot.requestID,
			AttemptID: attempt, ExpiresAt: formatExpiry(slot.expires),
		}
		if err := b.appendLine(ctx, intent); err != nil {
			slot.lost = true
			return err
		}
		slot.intents[attempt] = struct{}{}
		slot.attemptOrder = append(slot.attemptOrder, attempt)
	}
	if err := b.appendLine(ctx, lineFromCall(reservationID, slot.requestID, attempt, call)); err != nil {
		slot.lost = true
		return err
	}
	slot.usages[attempt] = call
	return nil
}

// Finalize is idempotent once the finalized marker is durable.
func (b *QuotaBook) Finalize(ctx context.Context, reservationID string, observation Observation) (Reconciliation, error) {
	return b.finish(ctx, reservationID, observation, false, b.now())
}

// Recover replays a restarted journal. Expired rows are not sent to quota finalize.
func (b *QuotaBook) Recover(now time.Time) error {
	b.mu.Lock()
	if err := b.reload(); err != nil {
		b.mu.Unlock()
		return err
	}
	ids := make([]string, 0, len(b.slots))
	for id, slot := range b.slots {
		if slot.final == nil && len(slot.intents) > 0 {
			ids = append(ids, id)
		}
	}
	b.mu.Unlock()
	sort.Strings(ids)
	ctx, cancel := context.WithTimeout(context.Background(), protocol.CleanupBudget)
	defer cancel()
	for _, id := range ids {
		if _, err := b.finish(ctx, id, Observation{}, true, now); err != nil {
			return err
		}
	}
	return nil
}

func (b *QuotaBook) finish(ctx context.Context, reservationID string, observation Observation, recovery bool, asOf time.Time) (Reconciliation, error) {
	b.mu.Lock()
	slot, err := b.open(reservationID)
	if err != nil {
		b.mu.Unlock()
		return Reconciliation{}, err
	}
	if slot.final != nil {
		record := *slot.final
		b.mu.Unlock()
		return record, nil
	}
	if !asOf.Before(slot.expires) {
		b.mu.Unlock()
		return b.markExpired(ctx, reservationID)
	}
	decided, attempts := decideUsage(slot, observation, recovery)
	caller := slot.caller
	if caller == nil {
		caller = b.caller
	}
	requestID := slot.requestID
	b.mu.Unlock()
	if caller == nil {
		return Reconciliation{}, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The quota caller is missing.", false)
	}
	status, input, output := quotaRPC(decided)
	var rpcErr error
	for attempt := 1; attempt <= 2; attempt++ {
		if err := ctx.Err(); err != nil {
			return Reconciliation{}, err
		}
		rpcErr = caller.FinalizeQuota(ctx, reservationID, status, input, output)
		if rpcErr == nil {
			break
		}
	}
	if rpcErr != nil {
		return Reconciliation{}, rpcErr
	}
	record := reconcile(decided, attempts)
	record.ReservationID = reservationID
	return b.markFinal(ctx, reservationID, requestID, status, record)
}

func decideUsage(slot *quotaSlot, passed Observation, recovery bool) (Observation, int) {
	missing := false
	calls := make([]CallUsage, 0, len(slot.attemptOrder))
	for _, attempt := range slot.attemptOrder {
		call, ok := slot.usages[attempt]
		if !ok {
			missing = true
			continue
		}
		calls = append(calls, call)
	}
	if recovery {
		if missing || len(calls) == 0 {
			return Observation{ProviderStarted: true, Knowledge: KnowledgeUnknown}, len(slot.attemptOrder)
		}
		return Aggregate(calls), len(calls)
	}
	if slot.lost || (passed.ProviderStarted && len(calls) == 0) {
		attempts := len(slot.attemptOrder)
		if attempts == 0 {
			attempts = len(calls)
		}
		return Observation{ProviderStarted: true, Knowledge: KnowledgeUnknown}, attempts
	}
	if len(calls) == 0 {
		return Classify(CallUsage{}), 0
	}
	return Aggregate(calls), len(calls)
}

func (b *QuotaBook) markFinal(ctx context.Context, reservationID, requestID, rpcStatus string, record Reconciliation) (Reconciliation, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	slot, err := b.open(reservationID)
	if err != nil {
		return Reconciliation{}, err
	}
	if slot.final != nil {
		return *slot.final, nil
	}
	line := lineFromReconciliation(kindFinalized, requestID, rpcStatus, record)
	if err := b.appendLine(ctx, line); err != nil {
		return Reconciliation{}, err
	}
	stored := record
	slot.final = &stored
	b.metric.add(record.Uncertainty)
	return stored, nil
}

func (b *QuotaBook) markExpired(ctx context.Context, reservationID string) (Reconciliation, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	slot, err := b.open(reservationID)
	if err != nil {
		return Reconciliation{}, err
	}
	if slot.final != nil {
		return *slot.final, nil
	}
	record := Reconciliation{
		ReservationID: reservationID,
		Status:        StatusExpiredUncertain,
		Uncertainty:   UncertaintyExpired,
		Knowledge:     KnowledgeUnknown,
		Attempts:      len(slot.usages),
	}
	line := lineFromReconciliation(kindExpired, slot.requestID, "", record)
	if err := b.appendLine(ctx, line); err != nil {
		return Reconciliation{}, err
	}
	stored := record
	slot.final = &stored
	b.metric.add(UncertaintyExpired)
	return stored, nil
}

func (b *QuotaBook) reload() error {
	lines, err := readJournal(b.journalPath())
	if err != nil {
		return err
	}
	b.slots = map[string]*quotaSlot{}
	b.byReq = map[string]string{}
	for _, line := range lines {
		slot := b.ensure(line)
		switch line.Kind {
		case kindProviderIntent:
			if line.AttemptID == "" {
				continue
			}
			if _, ok := slot.intents[line.AttemptID]; !ok {
				slot.attemptOrder = append(slot.attemptOrder, line.AttemptID)
			}
			slot.intents[line.AttemptID] = struct{}{}
		case kindUsageObserved:
			if slot.usages == nil {
				slot.usages = map[string]CallUsage{}
			}
			slot.usages[line.AttemptID] = callFromLine(line)
		case kindFinalized:
			record := reconciliationFromLine(line)
			slot.final = &record
		case kindExpired:
			record := reconciliationFromLine(line)
			record.Status = StatusExpiredUncertain
			record.Uncertainty = UncertaintyExpired
			record.Measured = false
			record.Refund = false
			record.InputTokens = nil
			record.OutputTokens = nil
			record.Knowledge = KnowledgeUnknown
			slot.final = &record
		}
	}
	return nil
}

func (b *QuotaBook) ensure(line journalLine) *quotaSlot {
	slot := b.slots[line.ReservationID]
	if slot == nil {
		slot = &quotaSlot{intents: map[string]struct{}{}, usages: map[string]CallUsage{}}
		b.slots[line.ReservationID] = slot
	}
	if line.RequestID != "" {
		slot.requestID = line.RequestID
		b.byReq[line.RequestID] = line.ReservationID
	}
	if parsed := parseExpiry(line.ExpiresAt); !parsed.IsZero() {
		slot.expires = parsed
	}
	return slot
}

func (b *QuotaBook) open(reservationID string) (*quotaSlot, error) {
	slot := b.slots[reservationID]
	if slot == nil {
		return nil, protocol.NewError(404, protocol.CodeInvalidRequest, "The reservation is unknown.", false)
	}
	return slot, nil
}

func (b *QuotaBook) appendLine(ctx context.Context, line journalLine) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if b.failAppends > 0 {
		b.failAppends--
		return errors.New("usage journal write failed")
	}
	return appendJournal(ctx, b.journalPath(), line)
}

func (b *QuotaBook) journalPath() string {
	return filepath.Join(b.dir, journalName)
}

// FailNextAppends injects journal write failures for tests.
func (b *QuotaBook) FailNextAppends(n int) {
	b.mu.Lock()
	b.failAppends = n
	b.mu.Unlock()
}

func (m *classificationMetric) add(label string) {
	switch label {
	case UncertaintyMeasured, UncertaintyPartial, UncertaintyUnknown, UncertaintyNoProviderWork, UncertaintyExpired:
	default:
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.counts == nil {
		m.counts = map[string]int64{}
	}
	m.counts[label]++
}

func alreadyReserved() error {
	return protocol.NewError(409, protocol.CodeInvalidRequest, "The request is already reserved.", false)
}
