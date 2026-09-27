package ingress

import (
	"strings"
	"sync"
	"time"
)

// Observation is the allowlisted runtime metadata emitted by the service.
// It intentionally has no field for prompts, SQL, rows, credentials, or raw
// upstream errors.
type Observation struct {
	RequestID           string
	AppID               string
	CapabilityID        string
	Provider            string
	Model               string
	Latency             time.Duration
	Outcome             string
	UsageClassification string
}

// ObservationSink receives redacted runtime metadata.
type ObservationSink interface {
	Observe(Observation)
}

// Metrics stores bounded low-cardinality counters. Request IDs are retained in
// logs but are deliberately not metric labels.
type Metrics struct {
	mu       sync.Mutex
	counts   map[string]uint64
	latency  time.Duration
	observed uint64
}

// NewMetrics returns an empty runtime metrics collector.
func NewMetrics() *Metrics {
	return &Metrics{counts: make(map[string]uint64)}
}

// Observe records only allowlisted outcome and usage labels.
func (m *Metrics) Observe(observation Observation) {
	if m == nil {
		return
	}
	observation = SanitizeObservation(observation)
	outcome := label(observation.Outcome)
	usage := label(observation.UsageClassification)
	if outcome == "" {
		outcome = "unknown"
	}
	if usage == "" {
		usage = "unknown"
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.counts == nil {
		m.counts = make(map[string]uint64)
	}
	m.counts["outcome:"+outcome]++
	m.counts["usage:"+usage]++
	if provider := label(observation.Provider); provider != "" && provider != "redacted" {
		m.counts["provider:"+provider]++
	}
	if model := label(observation.Model); model != "" && model != "redacted" {
		m.counts["model:"+model]++
	}
	m.observed++
	if observation.Latency > 0 {
		m.latency += observation.Latency
	}
}

// Snapshot returns safe counters for tests and a future private metrics route.
func (m *Metrics) Snapshot() (map[string]uint64, time.Duration, uint64) {
	if m == nil {
		return nil, 0, 0
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	counts := make(map[string]uint64, len(m.counts))
	for key, value := range m.counts {
		counts[key] = value
	}
	return counts, m.latency, m.observed
}

// SanitizeObservation removes the free-form field and bounds all labels before
// they can reach a log or metrics sink.
func SanitizeObservation(observation Observation) Observation {
	observation.RequestID = label(observation.RequestID)
	observation.AppID = label(observation.AppID)
	observation.CapabilityID = label(observation.CapabilityID)
	observation.Provider = label(observation.Provider)
	observation.Model = label(observation.Model)
	observation.Outcome = label(observation.Outcome)
	observation.UsageClassification = label(observation.UsageClassification)
	if observation.Latency < 0 {
		observation.Latency = 0
	}
	return observation
}

func label(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 128 {
		return "redacted"
	}
	lower := strings.ToLower(value)
	for _, needle := range []string{"secret", "token", "password", "api_key", "apikey", "authorization", "bearer ", "prompt", "select ", "sql", "sk-"} {
		if strings.Contains(lower, needle) {
			return "redacted"
		}
	}
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || strings.ContainsRune("._:/-", r) {
			continue
		}
		return "redacted"
	}
	return value
}
