package orchestration

import (
	"context"
	"sync"
	"time"
)

type cleanupScope struct {
	parent context.Context
	budget time.Duration
	stop   func() bool

	mu     sync.Mutex
	ctx    context.Context
	cancel context.CancelFunc
}

func newCleanupScope(parent context.Context, budget time.Duration) *cleanupScope {
	scope := &cleanupScope{parent: parent, budget: budget}
	scope.stop = context.AfterFunc(parent, func() { scope.start() })
	if parent.Err() != nil {
		scope.start()
	}
	return scope
}

func (s *cleanupScope) start() context.Context {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ctx == nil {
		s.ctx, s.cancel = context.WithTimeout(context.WithoutCancel(s.parent), s.budget)
	}
	return s.ctx
}

func (s *cleanupScope) operation(parent context.Context) (context.Context, context.CancelFunc) {
	s.mu.Lock()
	ctx := s.ctx
	s.mu.Unlock()
	if ctx != nil {
		return ctx, func() {}
	}
	if s.parent.Err() != nil || parent.Err() != nil {
		return s.start(), func() {}
	}
	return context.WithTimeout(context.WithoutCancel(parent), s.budget)
}

func (s *cleanupScope) Close() {
	if s.stop != nil && !s.stop() && s.parent.Err() != nil {
		s.start()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancel != nil {
		s.cancel()
	}
}
