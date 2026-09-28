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
	deniedDB := sql.OpenDB(readinessConnector{deniedView: "equipment_search"})
	t.Cleanup(func() { _ = deniedDB.Close() })
	handler.ConfigReady = func() bool {
		return QueryExecutorReady(context.Background(), &qltbyt.SQLExecutor{DB: deniedDB})
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("catalog permission failure readiness = %d %s, want 503", response.Code, response.Body.String())
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

type readinessConnector struct{ deniedView string }

type readinessDriver struct{ deniedView string }

type readinessConn struct{ deniedView string }

func (connector readinessConnector) Connect(context.Context) (driver.Conn, error) {
	return readinessConn{deniedView: connector.deniedView}, nil
}
func (connector readinessConnector) Driver() driver.Driver {
	return readinessDriver{deniedView: connector.deniedView}
}
func (driver readinessDriver) Open(string) (driver.Conn, error) {
	return readinessConn{deniedView: driver.deniedView}, nil
}
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
func (conn readinessConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if query == "select current_user, current_setting('transaction_read_only'), current_setting('default_transaction_read_only')" {
		return &readinessRows{columns: []string{"role", "read_only", "default_read_only"}, values: []driver.Value{"ai_query_tool", "on", "on"}, remaining: 1}, nil
	}
	if query == "select c.relkind::text, pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE'), pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT') from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'ai_readonly' and c.relname = $1" {
		if len(args) != 1 {
			return nil, errors.New("catalog metadata query is missing its view name")
		}
		view := args[0].Value.(string)
		if !readinessViewExists(view) {
			return &readinessRows{columns: []string{"relkind", "schema_usage", "select_privilege"}}, nil
		}
		return &readinessRows{
			columns:   []string{"relkind", "schema_usage", "select_privilege"},
			values:    []driver.Value{"v", true, conn.deniedView != view},
			remaining: 1,
		}, nil
	}
	return nil, errors.New("unexpected query")
}

type readinessTx struct{}

func (readinessTx) Commit() error   { return nil }
func (readinessTx) Rollback() error { return nil }

type readinessRows struct {
	columns   []string
	values    []driver.Value
	remaining int
}

func (rows *readinessRows) Columns() []string { return rows.columns }
func (*readinessRows) Close() error           { return nil }
func (rows *readinessRows) Next(dest []driver.Value) error {
	if rows.remaining == 0 {
		return io.EOF
	}
	rows.remaining--
	copy(dest, rows.values)
	return nil
}

// This is the test database fixture for the current approved SQL views.
func readinessViewExists(name string) bool {
	switch name {
	case "equipment_search", "maintenance_facts", "repair_facts", "usage_facts", "quota_facts":
		return true
	default:
		return false
	}
}
