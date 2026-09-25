package phase0proof

import (
	"sync"
	"testing"
	"time"
)

type providerKeyPool struct {
	mu        sync.Mutex
	keys      []string
	exhausted map[int]time.Time
	next      int
	resetAt   time.Time
}

func (p *providerKeyPool) acquire(now time.Time) (int, string, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.resetAt.IsZero() && !now.Before(p.resetAt) {
		p.exhausted = make(map[int]time.Time)
		p.resetAt = time.Time{}
	}
	for offset := range p.keys {
		index := (p.next + offset) % len(p.keys)
		if _, exhausted := p.exhausted[index]; exhausted {
			continue
		}
		p.next = (index + 1) % len(p.keys)
		return index, p.keys[index], true
	}
	return 0, "", false
}

func (p *providerKeyPool) markExhausted(now time.Time, index int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.exhausted[index] = now
	if p.resetAt.IsZero() {
		p.resetAt = now.Add(time.Hour)
	}
}

func TestGoogleKeyPoolRotationAndHourlyReset(t *testing.T) {
	p := &providerKeyPool{keys: []string{"key-a", "key-b"}, exhausted: make(map[int]time.Time)}
	now := time.Unix(1_700_000_000, 0)
	index, key, ok := p.acquire(now)
	if !ok || index != 0 || key != "key-a" {
		t.Fatalf("first key = (%d, %q, %v)", index, key, ok)
	}
	p.markExhausted(now, index)
	index, key, ok = p.acquire(now)
	if !ok || index != 1 || key != "key-b" {
		t.Fatalf("rotated key = (%d, %q, %v)", index, key, ok)
	}
	p.markExhausted(now, index)
	if _, _, ok := p.acquire(now); ok {
		t.Fatal("exhausted pool returned a key before reset")
	}
	index, key, ok = p.acquire(now.Add(time.Hour))
	if !ok || index != 0 || key != "key-a" {
		t.Fatalf("reset key = (%d, %q, %v)", index, key, ok)
	}
}
