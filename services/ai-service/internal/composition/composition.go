// Package composition owns app-specific runtime wiring outside the neutral
// service entrypoint. Neutral packages remain unaware of app identifiers.
package composition

import (
	"net/http"
	"strings"

	"example.com/shared-ai-service/internal/qltbyt"
	"example.com/shared-ai-service/internal/registry"
)

// Dependencies is the complete runtime tuple required before registering the
// assistant capability. Query composition is supplied by 7.5D.
type Dependencies struct {
	Broker       qltbyt.Broker
	Query        qltbyt.QueryExecutor
	BrokerSecret []byte
}

// RegisterAssistantWithEndpoint composes the operation-aware HTTP broker and
// capability in one fail-closed step. A nil QueryExecutor intentionally leaves
// the tuple absent until 7.5D supplies it.
func RegisterAssistantWithEndpoint(reg *registry.Registry, endpoint string, client *http.Client, brokerSecret []byte, query qltbyt.QueryExecutor) bool {
	if strings.TrimSpace(endpoint) == "" {
		return false
	}
	broker, err := NewBroker(endpoint, client)
	if err != nil {
		return false
	}
	return RegisterQLTBYT(reg, Dependencies{Broker: broker, Query: query, BrokerSecret: brokerSecret})
}

// RegisterQLTBYT registers qltbyt/assistant-chat/v1 only when every dependency
// needed by the capability is present. It returns false without mutating the
// registry for an incomplete tuple.
func RegisterQLTBYT(reg *registry.Registry, dependencies Dependencies) bool {
	if reg == nil || len(dependencies.BrokerSecret) == 0 {
		return false
	}
	err := qltbyt.Register(reg, qltbyt.Assistant{
		Broker: dependencies.Broker,
		Query:  dependencies.Query,
		Secret: append([]byte(nil), dependencies.BrokerSecret...),
	})
	return err == nil
}

// NewBroker builds the operation-aware BFF transport for the composition
// boundary. Invalid endpoint configuration is returned before registration.
func NewBroker(endpoint string, client *http.Client) (qltbyt.Broker, error) {
	return qltbyt.NewHTTPBroker(endpoint, client)
}
