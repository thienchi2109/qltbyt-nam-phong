package ingress

import (
	"context"
	"sync"
)

// Admission bounds concurrent requests before any provider work begins.
type Admission struct {
	slots  chan struct{}
	reject bool

	mu      sync.Mutex
	stopped bool
	nextID  uint64
	active  map[uint64]admissionLease
	idle    chan struct{}
}

type admissionLease struct {
	cancel context.CancelFunc
}

// NewAdmission creates a bounded request gate. Non-positive limits are invalid
// and produce a closed gate that rejects every request.
func NewAdmission(maxConcurrent int) *Admission {
	a := &Admission{active: make(map[uint64]admissionLease)}
	a.idle = make(chan struct{})
	close(a.idle)
	if maxConcurrent <= 0 {
		a.reject = true
		return a
	}
	a.slots = make(chan struct{}, maxConcurrent)
	return a
}

func (a *Admission) ready() bool {
	return a.Ready()
}

// Acquire reserves one bounded request slot and returns a context canceled
// when the admission gate is drained. The release function is idempotent.
func (a *Admission) Acquire(parent context.Context) (context.Context, func(), bool) {
	if a == nil {
		return nil, func() {}, false
	}
	if parent == nil {
		parent = context.Background()
	}
	a.mu.Lock()
	if a.reject || a.stopped || a.slots == nil {
		a.mu.Unlock()
		return nil, func() {}, false
	}
	select {
	case a.slots <- struct{}{}:
	default:
		a.mu.Unlock()
		return nil, func() {}, false
	}
	ctx, cancel := context.WithCancel(parent)
	a.nextID++
	id := a.nextID
	if len(a.active) == 0 {
		a.idle = make(chan struct{})
	}
	a.active[id] = admissionLease{cancel: cancel}
	a.mu.Unlock()

	var once sync.Once
	release := func() {
		once.Do(func() { a.releaseID(id) })
	}
	return ctx, release, true
}

func (a *Admission) releaseID(id uint64) {
	a.mu.Lock()
	if _, ok := a.active[id]; !ok {
		a.mu.Unlock()
		return
	}
	delete(a.active, id)
	if len(a.active) == 0 {
		close(a.idle)
	}
	a.mu.Unlock()
	<-a.slots
}

// Stop makes readiness false and prevents new work. Active requests are left
// alone until Drain reaches its configured deadline.
func (a *Admission) Stop() {
	if a == nil {
		return
	}
	a.mu.Lock()
	a.stopped = true
	a.mu.Unlock()
}

// Ready reports whether new requests may be admitted.
func (a *Admission) Ready() bool {
	if a == nil {
		return false
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return !a.reject && !a.stopped && a.slots != nil
}

// Active reports the number of requests currently holding an admission slot.
func (a *Admission) Active() int {
	if a == nil {
		return 0
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	return len(a.active)
}

// Drain stops admission, waits for active work, and cancels work that remains
// after ctx expires. The request runner owns its bounded cleanup afterwards.
func (a *Admission) Drain(ctx context.Context) error {
	if a == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	a.Stop()
	a.mu.Lock()
	idle := a.idle
	a.mu.Unlock()
	select {
	case <-idle:
		return nil
	case <-ctx.Done():
		a.cancelActive()
		return ctx.Err()
	}
}

// Wait blocks until all active leases have released or ctx expires.
func (a *Admission) Wait(ctx context.Context) error {
	if a == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	a.mu.Lock()
	idle := a.idle
	a.mu.Unlock()
	select {
	case <-idle:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (a *Admission) cancelActive() {
	a.mu.Lock()
	cancels := make([]context.CancelFunc, 0, len(a.active))
	for _, lease := range a.active {
		cancels = append(cancels, lease.cancel)
	}
	a.mu.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
}
