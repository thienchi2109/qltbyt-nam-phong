// Package usage is the app-neutral reservation and observation contract.
// It does not call an application quota database.
package usage

import (
	"context"
	"sync"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

const (
	KnowledgeKnownZero          = "known-zero"
	KnowledgeKnownPositive      = "known-positive"
	KnowledgePartial            = "partial"
	KnowledgeUnknown            = "unknown"
	KnowledgeProviderNotStarted = "provider-not-started"

	UncertaintyMeasured       = "measured"
	UncertaintyPartial        = "partial"
	UncertaintyUnknown        = "unknown"
	UncertaintyNoProviderWork = "known-no-provider-work"
	UncertaintyExpired        = "expired-uncertain"
	StatusCompleted           = "completed"
	StatusExpiredUncertain    = "expired-uncertain"
)

// CallUsage is one provider invocation. Nil token pointers mean that dimension
// was not observed. A non-nil zero is measured zero for that dimension.
type CallUsage struct {
	ProviderStarted bool
	InputTokens     *int
	OutputTokens    *int
}

// Observation is the aggregate of every provider call in one reservation.
type Observation struct {
	ProviderStarted bool
	InputTokens     *int
	OutputTokens    *int
	Knowledge       string
}

// ReserveRequest identifies one run. It deliberately has no tenant field.
type ReserveRequest struct {
	RequestID         string
	AppID             string
	CapabilityID      string
	CapabilityVersion string
	TTL               time.Duration
}

// Reservation is the held accounting slot for one run.
type Reservation struct {
	ID        string
	RequestID string
	ExpiresAt time.Time
}

// Reconciliation is the idempotent final record for a reservation.
type Reconciliation struct {
	ReservationID string
	Status        string
	Attempts      int
	InputTokens   *int
	OutputTokens  *int
	Knowledge     string
	Uncertainty   string
	Measured      bool
	Refund        bool
}

// Lifecycle collects observations and finalizes them once per reservation.
type Lifecycle interface {
	Reserve(ctx context.Context, request ReserveRequest) (Reservation, error)
	Observe(ctx context.Context, reservationID string, call CallUsage) error
	Finalize(ctx context.Context, reservationID string, observation Observation) (Reconciliation, error)
}

// Classify maps one provider call onto the app-neutral knowledge labels.
func Classify(call CallUsage) Observation {
	if !call.ProviderStarted {
		return Observation{Knowledge: KnowledgeProviderNotStarted}
	}
	observation := Observation{ProviderStarted: true}
	switch {
	case call.InputTokens == nil && call.OutputTokens == nil:
		observation.Knowledge = KnowledgeUnknown
	case call.InputTokens == nil || call.OutputTokens == nil:
		observation.Knowledge = KnowledgePartial
		observation.InputTokens = call.InputTokens
		observation.OutputTokens = call.OutputTokens
	default:
		observation.InputTokens = call.InputTokens
		observation.OutputTokens = call.OutputTokens
		if *call.InputTokens == 0 && *call.OutputTokens == 0 {
			observation.Knowledge = KnowledgeKnownZero
		} else {
			observation.Knowledge = KnowledgeKnownPositive
		}
	}
	return observation
}

// Aggregate sums fully observed calls and refuses to present a missing call as zero.
func Aggregate(calls []CallUsage) Observation {
	started := false
	missing := false
	inputSum := 0
	outputSum := 0
	haveInput := false
	haveOutput := false
	for _, call := range calls {
		if !call.ProviderStarted {
			continue
		}
		started = true
		classified := Classify(call)
		switch classified.Knowledge {
		case KnowledgeUnknown:
			missing = true
		case KnowledgePartial:
			missing = true
			if call.InputTokens != nil {
				inputSum += *call.InputTokens
				haveInput = true
			}
			if call.OutputTokens != nil {
				outputSum += *call.OutputTokens
				haveOutput = true
			}
		default:
			inputSum += *call.InputTokens
			outputSum += *call.OutputTokens
			haveInput = true
			haveOutput = true
		}
	}
	if !started {
		return Classify(CallUsage{})
	}
	if missing {
		observation := Observation{ProviderStarted: true, Knowledge: KnowledgePartial}
		if haveInput {
			value := inputSum
			observation.InputTokens = &value
		}
		if haveOutput {
			value := outputSum
			observation.OutputTokens = &value
		}
		if !haveInput && !haveOutput {
			observation.Knowledge = KnowledgeUnknown
		}
		return observation
	}
	return Classify(CallUsage{ProviderStarted: true, InputTokens: &inputSum, OutputTokens: &outputSum})
}

func reconcile(observation Observation, attempts int) Reconciliation {
	record := Reconciliation{
		Attempts:     attempts,
		InputTokens:  observation.InputTokens,
		OutputTokens: observation.OutputTokens,
		Knowledge:    observation.Knowledge,
	}
	switch observation.Knowledge {
	case KnowledgeKnownZero, KnowledgeKnownPositive:
		record.Status = StatusCompleted
		record.Uncertainty = UncertaintyMeasured
		record.Measured = true
	case KnowledgePartial:
		record.Status = StatusCompleted
		record.Uncertainty = UncertaintyPartial
	case KnowledgeProviderNotStarted:
		record.Status = StatusCompleted
		record.Uncertainty = UncertaintyNoProviderWork
		record.Refund = true
	default:
		record.Status = StatusCompleted
		record.Uncertainty = UncertaintyUnknown
		record.Knowledge = KnowledgeUnknown
	}
	return record
}

type entry struct {
	request      ReserveRequest
	expiresAt    time.Time
	observations []CallUsage
	final        *Reconciliation
}

// Memory is a process-local lifecycle used by the core and its tests.
type Memory struct {
	mu      sync.Mutex
	now     func() time.Time
	nextID  int
	entries map[string]*entry
	byReq   map[string]string
}

// NewMemory returns an empty lifecycle. now defaults to time.Now.
func NewMemory(now func() time.Time) *Memory {
	if now == nil {
		now = time.Now
	}
	return &Memory{
		now:     now,
		entries: make(map[string]*entry),
		byReq:   make(map[string]string),
	}
}

// Reserve opens a slot. The same request ID cannot start another provider run.
func (m *Memory) Reserve(_ context.Context, request ReserveRequest) (Reservation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if request.RequestID == "" {
		return Reservation{}, protocol.NewError(400, protocol.CodeInvalidRequest, "The request is missing a routing identifier.", false)
	}
	ttl := request.TTL
	if ttl < protocol.ReservationTTL {
		ttl = protocol.ReservationTTL
	}
	if _, ok := m.byReq[request.RequestID]; ok {
		return Reservation{}, protocol.NewError(409, protocol.CodeInvalidRequest, "The request is already reserved.", false)
	}
	m.nextID++
	id := request.RequestID + ":1"
	expiresAt := m.now().Add(ttl)
	m.entries[id] = &entry{request: request, expiresAt: expiresAt}
	m.byReq[request.RequestID] = id
	return Reservation{ID: id, RequestID: request.RequestID, ExpiresAt: expiresAt}, nil
}

// Observe appends one call when the reservation is still open and unexpired.
func (m *Memory) Observe(_ context.Context, reservationID string, call CallUsage) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	item, err := m.open(reservationID)
	if err != nil {
		return err
	}
	if item.final != nil || !m.now().Before(item.expiresAt) {
		return nil
	}
	item.observations = append(item.observations, call)
	return nil
}

// Finalize records the aggregate once. After expiry the record stays uncertain
// and is not a measured zero, even when local observations exist.
func (m *Memory) Finalize(_ context.Context, reservationID string, observation Observation) (Reconciliation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	item, err := m.open(reservationID)
	if err != nil {
		return Reconciliation{}, err
	}
	if item.final != nil {
		return *item.final, nil
	}
	attempts := len(item.observations)
	if attempts == 0 {
		attempts = 1
	}
	record := reconcile(observation, attempts)
	record.ReservationID = reservationID
	if !m.now().Before(item.expiresAt) {
		record.Status = StatusExpiredUncertain
		record.Uncertainty = UncertaintyExpired
		record.Measured = false
		record.Refund = false
		if record.Knowledge == KnowledgeKnownZero {
			record.Knowledge = KnowledgeUnknown
		}
	}
	item.final = &record
	return record, nil
}

// Observations returns the calls stored before expiry for tests.
func (m *Memory) Observations(reservationID string) []CallUsage {
	m.mu.Lock()
	defer m.mu.Unlock()
	item := m.entries[reservationID]
	if item == nil {
		return nil
	}
	out := make([]CallUsage, len(item.observations))
	copy(out, item.observations)
	return out
}

func (m *Memory) open(reservationID string) (*entry, error) {
	item := m.entries[reservationID]
	if item == nil {
		return nil, protocol.NewError(404, protocol.CodeInvalidRequest, "The reservation is unknown.", false)
	}
	return item, nil
}
