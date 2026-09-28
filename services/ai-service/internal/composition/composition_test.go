package composition

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/ingress"
	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/qltbyt"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
)

func TestRegisterQLTBYTRequiresEveryRuntimeDependency(t *testing.T) {
	for _, dependencies := range []Dependencies{
		{Broker: &fakeBroker{}},
		{Query: &fakeQuery{}},
		{Broker: &fakeBroker{}, Query: &fakeQuery{}},
	} {
		reg := registry.New()
		if RegisterQLTBYT(reg, dependencies) {
			t.Fatal("incomplete dependency tuple was registered")
		}
		if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
			t.Fatal("incomplete dependency tuple became visible")
		}
	}
}

func TestRegisterQLTBYTReadinessMatrixRejectsNilBrokerQueryAndRegistry(t *testing.T) {
	cases := []struct {
		name         string
		reg          *registry.Registry
		dependencies Dependencies
	}{
		{name: "nil broker", reg: registry.New(), dependencies: Dependencies{Query: &fakeQuery{}, BrokerSecret: []byte("secret")}},
		{name: "nil query executor", reg: registry.New(), dependencies: Dependencies{Broker: &fakeBroker{}, BrokerSecret: []byte("secret")}},
		{name: "nil registry", dependencies: Dependencies{Broker: &fakeBroker{}, Query: &fakeQuery{}, BrokerSecret: []byte("secret")}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if RegisterQLTBYT(tc.reg, tc.dependencies) {
				t.Fatal("incomplete dependency tuple was registered")
			}
			if tc.reg != nil {
				if _, err := tc.reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
					t.Fatal("incomplete dependency tuple became visible")
				}
			}
		})
	}
}

func TestRegisterQLTBYTRejectsTypedNilDependencies(t *testing.T) {
	var nilBroker *fakeBroker
	var nilQuery *fakeQuery
	for _, tc := range []struct {
		name string
		deps Dependencies
	}{
		{name: "typed nil broker", deps: Dependencies{Broker: nilBroker, Query: &fakeQuery{}, BrokerSecret: []byte("secret")}},
		{name: "typed nil query executor", deps: Dependencies{Broker: &fakeBroker{}, Query: nilQuery, BrokerSecret: []byte("secret")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reg := registry.New()
			if RegisterQLTBYT(reg, tc.deps) {
				t.Fatal("typed-nil dependency was registered")
			}
			if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
				t.Fatal("typed-nil dependency became visible")
			}
		})
	}
}

func TestRegisterQLTBYTRegistersTheRealTupleOnlyWhenComplete(t *testing.T) {
	reg := registry.New()
	if !RegisterQLTBYT(reg, Dependencies{
		Broker:       &fakeBroker{},
		Query:        &fakeQuery{},
		BrokerSecret: []byte("secret"),
	}) {
		t.Fatal("complete dependency tuple was not registered")
	}
	if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err != nil {
		t.Fatal(err)
	}
}

func TestRegisterAssistantWithEndpointStaysUnreadyWithoutQueryExecutor(t *testing.T) {
	server := httptest.NewServer(nil)
	defer server.Close()
	reg := registry.New()
	if RegisterAssistantWithEndpoint(reg, server.URL, server.Client(), []byte("secret"), nil) {
		t.Fatal("broker-only endpoint was registered")
	}
	if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err == nil {
		t.Fatal("broker-only endpoint made the tuple visible")
	}
}

func TestQueryExecutorReadinessRejectsMissingDummyAndUnhealthyExecutors(t *testing.T) {
	var nilQuery *fakeQuery
	for _, tc := range []struct {
		name  string
		query qltbyt.QueryExecutor
		want  bool
	}{
		{name: "missing"},
		{name: "test-only query", query: &fakeQuery{}},
		{name: "test-only readiness query", query: &dummyReadyQuery{}},
		{name: "missing SQL pool", query: &qltbyt.SQLExecutor{}},
		{name: "typed nil", query: nilQuery},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := QueryExecutorReady(context.Background(), tc.query); got != tc.want {
				t.Fatalf("QueryExecutorReady() = %v, want %v", got, tc.want)
			}
		})
	}
	db := sql.OpenDB(readinessConnector{})
	t.Cleanup(func() { _ = db.Close() })
	executor := &qltbyt.SQLExecutor{DB: db}
	brokerEndpoint := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer brokerEndpoint.Close()
	reg := registry.New()
	if !RegisterAssistantWithEndpoint(reg, brokerEndpoint.URL, brokerEndpoint.Client(), []byte("secret"), executor) {
		t.Fatal("HTTP Broker + real SQL executor tuple was not registered")
	}
	if !QueryExecutorReady(context.Background(), executor) {
		t.Fatal("dedicated read-only SQL executor did not report ready")
	}
	if _, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version); err != nil {
		t.Fatalf("complete tuple registry lookup = %v", err)
	}
	started := time.Now().Add(-ingress.Quarantine - time.Second)
	handler := &ingress.Handler{
		Guard:    ingress.NewReplayGuard(started, []ingress.Key{{ID: "key", Secret: []byte("secret"), Issuer: "nextjs-bff", Audience: "ai-service-v1", AppID: qltbyt.AppID, CapabilityID: qltbyt.CapabilityID}}),
		Registry: reg,
		Runner: &orchestration.Runner{
			Open:  func(context.Context, protocol.Request) (orchestration.ModelSession, error) { return nil, nil },
			Usage: usage.NewMemory(time.Now),
		},
		Admission: ingress.NewAdmission(1),
	}
	handler.ConfigReady = func() bool { return QueryExecutorReady(context.Background(), &dummyReadyQuery{}) }
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("test-only QueryExecutor readiness = %d, want 503", response.Code)
	}
	handler.ConfigReady = func() bool {
		_, err := reg.Lookup(qltbyt.AppID, qltbyt.CapabilityID, qltbyt.Version)
		return err == nil && QueryExecutorReady(context.Background(), executor)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("complete Broker + SQL executor + registry readiness = %d %s, want 200", response.Code, response.Body.String())
	}
}

type fakeBroker struct{}

func (*fakeBroker) Call(context.Context, qltbyt.Credential, string, json.RawMessage) (json.RawMessage, error) {
	return json.RawMessage(`{}`), nil
}

type fakeQuery struct{}

func (*fakeQuery) Execute(context.Context, qltbyt.QueryCall) (qltbyt.QueryResult, error) {
	return qltbyt.QueryResult{Rows: json.RawMessage(`[]`)}, nil
}

type dummyReadyQuery struct{ fakeQuery }

func (*dummyReadyQuery) Ready(context.Context) error { return nil }

type readinessConnector struct{}

type readinessDriver struct{}

type readinessConn struct{}

func (readinessConnector) Connect(context.Context) (driver.Conn, error) { return readinessConn{}, nil }
func (readinessConnector) Driver() driver.Driver                        { return readinessDriver{} }
func (readinessDriver) Open(string) (driver.Conn, error)                { return readinessConn{}, nil }
func (readinessConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("unexpected prepare")
}
func (readinessConn) Close() error              { return nil }
func (readinessConn) Begin() (driver.Tx, error) { return nil, errors.New("read-only options required") }
func (readinessConn) BeginTx(_ context.Context, options driver.TxOptions) (driver.Tx, error) {
	if !options.ReadOnly {
		return nil, errors.New("read-only transaction required")
	}
	return readinessTx{}, nil
}
func (readinessConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	if query != "select current_user, current_setting('transaction_read_only'), current_setting('default_transaction_read_only')" {
		return nil, errors.New("unexpected query")
	}
	return &readinessRows{}, nil
}

type readinessTx struct{}

func (readinessTx) Commit() error   { return nil }
func (readinessTx) Rollback() error { return nil }

type readinessRows struct{ read bool }

func (*readinessRows) Columns() []string { return []string{"role", "read_only", "default_read_only"} }
func (*readinessRows) Close() error      { return nil }
func (rows *readinessRows) Next(dest []driver.Value) error {
	if rows.read {
		return io.EOF
	}
	rows.read = true
	copy(dest, []driver.Value{"ai_query_tool", "on", "on"})
	return nil
}
