package webpush

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

// Metrics keeps only bounded counters; request data never becomes a label.
type Metrics struct {
	mu             sync.RWMutex
	accepted       uint64
	failed         uint64
	retried        uint64
	cancelled      uint64
	expired        uint64
	latencyCount   uint64
	latencySeconds float64
}

type metricSnapshot struct {
	accepted       uint64
	failed         uint64
	retried        uint64
	cancelled      uint64
	expired        uint64
	latencyCount   uint64
	latencySeconds float64
}

func NewMetrics() *Metrics { return &Metrics{} }

// Record maps internal outcomes to the fixed public metric vocabulary.
func (m *Metrics) Record(outcome string, latency time.Duration) {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	switch outcome {
	case "accepted":
		m.accepted++
	case "transient", "retry", "retried", "not_sent_lease_expired":
		m.retried++
	case "cancelled", "canceled":
		m.cancelled++
	case "expired", "not_sent_expired":
		m.expired++
	default:
		m.failed++
	}
	if latency >= 0 {
		m.latencyCount++
		m.latencySeconds += latency.Seconds()
	}
}

func (m *Metrics) snapshot() metricSnapshot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return metricSnapshot{
		accepted:       m.accepted,
		failed:         m.failed,
		retried:        m.retried,
		cancelled:      m.cancelled,
		expired:        m.expired,
		latencyCount:   m.latencyCount,
		latencySeconds: m.latencySeconds,
	}
}

func (m *Metrics) Handler() http.Handler { return http.HandlerFunc(m.ServeHTTP) }

func (m *Metrics) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	s := m.snapshot()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	_, _ = fmt.Fprintf(w, "# TYPE web_push_deliveries_accepted_total counter\nweb_push_deliveries_accepted_total %d\n", s.accepted)
	_, _ = fmt.Fprintf(w, "# TYPE web_push_deliveries_failed_total counter\nweb_push_deliveries_failed_total %d\n", s.failed)
	_, _ = fmt.Fprintf(w, "# TYPE web_push_deliveries_retried_total counter\nweb_push_deliveries_retried_total %d\n", s.retried)
	_, _ = fmt.Fprintf(w, "# TYPE web_push_deliveries_cancelled_total counter\nweb_push_deliveries_cancelled_total %d\n", s.cancelled)
	_, _ = fmt.Fprintf(w, "# TYPE web_push_deliveries_expired_total counter\nweb_push_deliveries_expired_total %d\n", s.expired)
	_, _ = fmt.Fprintf(w, "# TYPE web_push_send_latency_seconds summary\nweb_push_send_latency_seconds_count %d\nweb_push_send_latency_seconds_sum %.6f\n", s.latencyCount, s.latencySeconds)
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}
