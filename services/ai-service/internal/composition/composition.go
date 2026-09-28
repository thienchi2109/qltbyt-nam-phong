// Package composition owns app-specific runtime wiring outside the neutral
// service entrypoint. Neutral packages remain unaware of app identifiers.
package composition

import (
	"context"
	"net/http"
	"strings"

	"example.com/shared-ai-service/internal/qltbyt"
	"example.com/shared-ai-service/internal/registry"
)

type QueryExecutor = qltbyt.QueryExecutor

// ValidatePoolerURL enforces the app-owned external transaction-pooler contract.
func ValidatePoolerURL(raw string) error {
	return qltbyt.ValidatePoolerURL(raw)
}

// OpenPoolerQueryExecutor opens and verifies the dedicated read-only role.
func OpenPoolerQueryExecutor(ctx context.Context, databaseURL string, maxOpen int) (QueryExecutor, error) {
	executor, err := qltbyt.OpenPoolerSQLExecutor(ctx, databaseURL, maxOpen)
	if err != nil {
		return nil, err
	}
	return executor, nil
}

// PoolerDiagnostic returns a redacted startup/readiness cause for server logs.
func PoolerDiagnostic(err error) string {
	return qltbyt.PoolerDiagnostic(err)
}

// QueryExecutorReady accepts only the production SQL executor after its role probe succeeds.
func QueryExecutorReady(ctx context.Context, executor QueryExecutor) bool {
	query, ok := executor.(*qltbyt.SQLExecutor)
	return ok && query != nil && query.Ready(ctx) == nil
}

// CloseQueryExecutor releases the pool opened by OpenPoolerQueryExecutor.
func CloseQueryExecutor(executor QueryExecutor) error {
	query, ok := executor.(*qltbyt.SQLExecutor)
	if ok && query != nil {
		return query.Close()
	}
	return nil
}

// Dependencies is the complete runtime tuple required before registering the
// assistant capability. The pooler QueryExecutor is opened by 7.5D wiring.
type Dependencies struct {
	Broker       qltbyt.Broker
	Query        qltbyt.QueryExecutor
	BrokerSecret []byte
}

// RegisterAssistantWithEndpoint composes the operation-aware HTTP broker and
// capability in one fail-closed step. A nil QueryExecutor leaves the tuple
// absent.
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
