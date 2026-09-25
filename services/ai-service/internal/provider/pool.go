package provider

import (
	"sync"
	"time"
)

const exhaustionReset = time.Hour

// keyPool keeps one active Google key until a quota error, then walks forward
// over keys that are not exhausted. Exhaustion clears one hour after the first mark.
type keyPool struct {
	mu               sync.Mutex
	keys             []string
	exhausted        map[int]time.Time
	active           int
	firstExhaustedAt time.Time
}

func newKeyPool(keys []string) *keyPool {
	copied := make([]string, len(keys))
	copy(copied, keys)
	return &keyPool{keys: copied, exhausted: make(map[int]time.Time)}
}

func (p *keyPool) size() int { return len(p.keys) }

func (p *keyPool) current(now time.Time) (int, string, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.reset(now)
	if len(p.keys) == 0 {
		return 0, "", false
	}
	for offset := 0; offset < len(p.keys); offset++ {
		index := (p.active + offset) % len(p.keys)
		if _, exhausted := p.exhausted[index]; exhausted {
			continue
		}
		p.active = index
		return index, p.keys[index], true
	}
	return p.active, "", false
}

func (p *keyPool) rotate(now time.Time, failedIndex int) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.reset(now)
	if len(p.keys) <= 1 || failedIndex < 0 || failedIndex >= len(p.keys) {
		return false
	}
	p.exhausted[failedIndex] = now
	if p.firstExhaustedAt.IsZero() {
		p.firstExhaustedAt = now
	}
	for offset := 1; offset < len(p.keys); offset++ {
		index := (failedIndex + offset) % len(p.keys)
		if _, exhausted := p.exhausted[index]; exhausted {
			continue
		}
		p.active = index
		return true
	}
	return false
}

func (p *keyPool) reset(now time.Time) {
	if p.firstExhaustedAt.IsZero() || now.Before(p.firstExhaustedAt.Add(exhaustionReset)) {
		return
	}
	p.exhausted = make(map[int]time.Time)
	p.firstExhaustedAt = time.Time{}
}
