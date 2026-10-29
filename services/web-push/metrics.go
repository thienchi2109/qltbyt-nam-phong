package webpush

import (
	"fmt"
	"io"
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
	retryable      uint64
	backendOwned   uint64
	cancelled      uint64
	expired        uint64
	latencyCount   uint64
	latencySeconds float64
}

type metricSnapshot struct {
	accepted       uint64
	failed         uint64
	retried        uint64
	retryable      uint64
	backendOwned   uint64
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
	case "retried":
		m.retried++
	case "transient", "retry", "retryable":
		m.retryable++
	case "not_sent_lease_expired", "backend_owned":
		m.backendOwned++
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
		retryable:      m.retryable,
		backendOwned:   m.backendOwned,
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
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	m.write(w, "", true)
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (m *Metrics) write(w io.Writer, labels string, types bool) {
	s := m.snapshot()
	for _, metric := range []struct {
		name  string
		value uint64
	}{
		{"accepted", s.accepted}, {"failed", s.failed}, {"retried", s.retried},
		{"retryable", s.retryable}, {"backend_owned", s.backendOwned},
		{"cancelled", s.cancelled}, {"expired", s.expired},
	} {
		name := "web_push_deliveries_" + metric.name + "_total"
		if types {
			_, _ = fmt.Fprintf(w, "# TYPE %s counter\n", name)
		}
		_, _ = fmt.Fprintf(w, "%s%s %d\n", name, labels, metric.value)
	}
	if types {
		_, _ = fmt.Fprint(w, "# TYPE web_push_send_latency_seconds summary\n")
	}
	_, _ = fmt.Fprintf(w, "web_push_send_latency_seconds_count%s %d\nweb_push_send_latency_seconds_sum%s %.6f\n", labels, s.latencyCount, labels, s.latencySeconds)
}
