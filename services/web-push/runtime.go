package webpush

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
)

// ParsePause treats an omitted value as paused and rejects ambiguous input.
func ParsePause(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "":
		return true, nil
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return true, errors.New("WEB_PUSH_PAUSED must be true or false")
	}
}

// ValidateHealthAddress restricts the private server to loopback port 8080.
func ValidateHealthAddress(address string) error {
	host, port, err := net.SplitHostPort(address)
	if err != nil || port != "8080" {
		return errors.New("health address must use loopback port 8080")
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("health address must use a loopback IP")
	}
	return nil
}

type HealthState struct {
	mu      sync.RWMutex
	ready   bool
	paused  bool
	metrics *Metrics
}

// NewHealthState starts fail-closed; the worker marks readiness after runtime checks.
func NewHealthState(paused bool, metrics *Metrics) *HealthState {
	if metrics == nil {
		metrics = NewMetrics()
	}
	return &HealthState{paused: paused, metrics: metrics}
}

func (s *HealthState) SetReady(ready bool) {
	s.mu.Lock()
	s.ready = ready
	s.mu.Unlock()
}

func (s *HealthState) SetPaused(paused bool) {
	s.mu.Lock()
	s.paused = paused
	s.mu.Unlock()
}

func (s *HealthState) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.health)
	mux.HandleFunc("/readyz", s.readyz)
	mux.Handle("/metrics", s.metrics.Handler())
	return mux
}

func (s *HealthState) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	writeHealth(w, http.StatusOK, "ok\n")
}

func (s *HealthState) readyz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	s.mu.RLock()
	ready, paused := s.ready, s.paused
	s.mu.RUnlock()
	if !ready {
		writeHealth(w, http.StatusServiceUnavailable, "not_ready\n")
		return
	}
	if paused {
		writeHealth(w, http.StatusOK, "paused\n")
		return
	}
	writeHealth(w, http.StatusOK, "ready\n")
}

func writeHealth(w http.ResponseWriter, status int, body string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = fmt.Fprint(w, body)
}
