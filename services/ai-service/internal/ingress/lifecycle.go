package ingress

import (
	"context"
	"errors"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

var ErrInvalidDrainGrace = errors.New("drain grace must be between 60 and 90 seconds")

// Lifecycle coordinates readiness, admission stop, stream drain, and bounded
// cleanup. It contains no deployment or rollback side effects.
type Lifecycle struct {
	Admission *Admission
	Grace     time.Duration
	Cleanup   time.Duration
	CleanupFn func(context.Context) error
}

// NewLifecycle validates the selected process grace and cleanup margin.
func NewLifecycle(admission *Admission, grace, cleanup time.Duration) (*Lifecycle, error) {
	if grace < protocol.DrainGraceMin || grace > protocol.DrainGraceMax {
		return nil, ErrInvalidDrainGrace
	}
	if cleanup < 0 {
		return nil, errors.New("cleanup budget cannot be negative")
	}
	return &Lifecycle{Admission: admission, Grace: grace, Cleanup: cleanup}, nil
}

// Ready reports whether this process can accept new work.
func (l *Lifecycle) Ready() bool {
	return l != nil && l.Admission != nil && l.Admission.Ready()
}

// StopAdmission flips readiness and rejects new work without extending any
// active request deadline.
func (l *Lifecycle) StopAdmission() {
	if l != nil && l.Admission != nil {
		l.Admission.Stop()
	}
}

// StopTimeout is the orchestrator timeout required to cover drain and cleanup.
func (l *Lifecycle) StopTimeout() time.Duration {
	if l == nil {
		return 0
	}
	return l.Grace + l.Cleanup
}

// Drain stops admission, waits up to Grace, then runs bounded cleanup. Active
// request contexts are canceled when the selected drain grace expires.
func (l *Lifecycle) Drain(parent context.Context) error {
	if l == nil || l.Admission == nil {
		return nil
	}
	if parent == nil {
		parent = context.Background()
	}
	l.StopAdmission()
	drainCtx, cancel := context.WithTimeout(parent, l.Grace)
	drainErr := l.Admission.Drain(drainCtx)
	cancel()
	cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), l.Cleanup)
	var cleanupErr error
	if l.CleanupFn != nil {
		cleanupErr = l.CleanupFn(cleanupCtx)
	}
	waitErr := l.Admission.Wait(cleanupCtx)
	cleanupCancel()
	return errors.Join(drainErr, waitErr, cleanupErr)
}

// DrainWithGrace uses a per-stop grace without mutating a lifecycle shared by
// concurrent probes or shutdown callers.
func (l *Lifecycle) DrainWithGrace(parent context.Context, grace time.Duration) error {
	if l == nil {
		return nil
	}
	if grace < protocol.DrainGraceMin || grace > protocol.DrainGraceMax {
		return ErrInvalidDrainGrace
	}
	copy := *l
	copy.Grace = grace
	return copy.Drain(parent)
}
