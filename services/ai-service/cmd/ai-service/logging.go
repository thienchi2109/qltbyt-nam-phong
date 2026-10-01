package main

import (
	"log/slog"

	"example.com/shared-ai-service/internal/ingress"
)

// runtimeLog emits only sanitized metadata to the process log writer.
type runtimeLog struct {
	*slog.Logger
}

func (l runtimeLog) Record(requestID, code string) {
	o := ingress.SanitizeObservation(ingress.Observation{RequestID: requestID, Outcome: code})
	l.Info("request_event", "request_id", o.RequestID, "outcome", o.Outcome)
}

func (l runtimeLog) Observe(observation ingress.Observation) {
	o := ingress.SanitizeObservation(observation)
	l.Info("request_result", "request_id", o.RequestID, "app_id", o.AppID,
		"capability_id", o.CapabilityID, "provider", o.Provider, "model", o.Model,
		"outcome", o.Outcome, "usage_classification", o.UsageClassification,
		"latency_ms", o.Latency.Milliseconds())
}
