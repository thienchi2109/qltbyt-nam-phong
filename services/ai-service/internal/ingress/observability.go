package ingress

import (
	"strings"
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
