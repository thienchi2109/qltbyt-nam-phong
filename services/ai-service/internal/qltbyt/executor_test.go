package qltbyt

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// This driver exercises database/sql transaction wiring without a database.
type queryDriver struct {
	role, readOnly, defaultReadOnly string
	settings                        map[string]string
	statement                       string
	count                           int
	value                           driver.Value
	settingErr, connectErr          bool
	catalog                         readinessCatalog
	catalogMetaProbes               []string
	committed, rolledBack           bool
}

type readinessCatalog struct {
	schemaExists        bool
	schemaUsage         bool
	viewKinds           map[string]string
	viewSelect          map[string]bool
	metadataError       error
	metadataNextError   error
	metadataCloseError  error
	metadataStarted     chan struct{}
	blockMetadataResult bool
}

func (d *queryDriver) Connect(context.Context) (driver.Conn, error) {
	if d.connectErr {
		return nil, errors.New("synthetic connection secret")
	}
	return d, nil
}
func (d *queryDriver) Driver() driver.Driver            { return d }
func (d *queryDriver) Open(string) (driver.Conn, error) { return d, nil }
func (d *queryDriver) Close() error                     { return nil }
func (d *queryDriver) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("unexpected prepare")
}
func (d *queryDriver) Begin() (driver.Tx, error) { return nil, errors.New("missing read-only options") }
func (d *queryDriver) BeginTx(_ context.Context, options driver.TxOptions) (driver.Tx, error) {
	if !options.ReadOnly {
		return nil, errors.New("transaction is not read-only")
	}
	return d, nil
}
func (d *queryDriver) Commit() error   { d.committed = true; return nil }
func (d *queryDriver) Rollback() error { d.rolledBack = true; return nil }
func (d *queryDriver) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	if d.settingErr {
		return nil, errors.New("synthetic driver secret")
	}
	if query != "select set_config($1, $2, true)" || len(args) != 2 {
		return nil, errors.New("unparameterized settings")
	}
	d.settings[args[0].Value.(string)] = args[1].Value.(string)
	return driver.RowsAffected(1), nil
}
func (d *queryDriver) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	if query == "select current_user, current_setting('transaction_read_only')" {
		return &executorRows{columns: []string{"role", "read_only"}, values: []driver.Value{d.role, d.readOnly}, remaining: 1}, nil
	}
	if query == "select current_user, current_setting('transaction_read_only'), current_setting('default_transaction_read_only')" {
		return &executorRows{columns: []string{"role", "read_only", "default_read_only"}, values: []driver.Value{d.role, d.readOnly, d.defaultReadOnly}, remaining: 1}, nil
	}
	if query == approvedViewReadinessQuery {
		if len(args) != 1 {
			return nil, errors.New("catalog metadata query is missing its view name")
		}
		if d.catalog.metadataError != nil {
			return nil, d.catalog.metadataError
		}
		if d.catalog.metadataStarted != nil {
			select {
			case d.catalog.metadataStarted <- struct{}{}:
			default:
			}
		}
		if d.catalog.blockMetadataResult {
			<-ctx.Done()
			return nil, ctx.Err()
		}
		view := args[0].Value.(string)
		d.catalogMetaProbes = append(d.catalogMetaProbes, view)
		if !d.catalog.schemaExists {
			return &executorRows{columns: []string{"relkind", "schema_usage", "select_privilege"}}, nil
		}
		kind, ok := d.catalog.viewKinds[view]
		if !ok {
			return &executorRows{columns: []string{"relkind", "schema_usage", "select_privilege"}}, nil
		}
		if d.catalog.metadataNextError != nil {
			return &executorRows{columns: []string{"relkind", "schema_usage", "select_privilege"}, nextErr: d.catalog.metadataNextError}, nil
		}
		return &executorRows{
			columns:   []string{"relkind", "schema_usage", "select_privilege"},
			values:    []driver.Value{kind, d.catalog.schemaUsage, d.catalog.viewSelect[view]},
			remaining: 1,
			closeErr:  d.catalog.metadataCloseError,
		}, nil
	}
	if len(d.settings) != 5 {
		return nil, errors.New("query ran before settings")
	}
	d.statement = query
	return &executorRows{columns: []string{"equipment_id"}, values: []driver.Value{d.value}, remaining: d.count}, nil
}

type executorRows struct {
	columns   []string
	values    []driver.Value
	remaining int
	nextErr   error
	closeErr  error
}

func (r *executorRows) Columns() []string { return r.columns }
func (r *executorRows) Close() error      { return r.closeErr }
func (r *executorRows) Next(dest []driver.Value) error {
	if r.remaining == 0 {
		if r.nextErr != nil {
			return r.nextErr
		}
		return io.EOF
	}
	r.remaining--
	copy(dest, r.values)
	return nil
}

func testSQLExecutor(t *testing.T, d *queryDriver) SQLExecutor {
	t.Helper()
	d.settings = make(map[string]string)
	db := sql.OpenDB(d)
	t.Cleanup(func() { _ = db.Close() })
	return SQLExecutor{DB: db}
}

func executorCall() QueryCall {
	return QueryCall{Statement: "select equipment_id from ai_readonly.equipment_search", FacilityID: 2, UserID: 42, Role: "admin"}
}

func TestSQLExecutorAppliesReadOnlyScopeAndLimit(t *testing.T) {
	d := &queryDriver{role: "ai_query_tool", readOnly: "on", count: 1, value: int64(7)}
	e := testSQLExecutor(t, d)
	result, err := e.Execute(context.Background(), executorCall())
	if err != nil {
		t.Fatal(err)
	}
	if string(result.Rows) != `[{"equipment_id":7}]` || result.RowCount != 1 || result.PayloadBytes != len(result.Rows) {
		t.Fatalf("result = %+v", result)
	}
	want := map[string]string{"statement_timeout": "5000ms", "search_path": QuerySearchPath, "app.current_facility_id": "2", "app.current_user_id": "42", "app.current_role": "global"}
	for key, value := range want {
		if d.settings[key] != value {
			t.Fatalf("%s = %q", key, d.settings[key])
		}
	}
	if d.statement != "select * from (select equipment_id from ai_readonly.equipment_search) as assistant_sql_result limit 101" || !d.committed {
		t.Fatalf("statement=%s committed=%v", d.statement, d.committed)
	}
}

func TestSQLExecutorFailsClosed(t *testing.T) {
	for _, tc := range []struct {
		name, role, readOnly string
		settingErr           bool
	}{
		{"wrong role", "postgres", "on", false},
		{"write transaction", "ai_query_tool", "off", false},
		{"setting failure", "ai_query_tool", "on", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := &queryDriver{role: tc.role, readOnly: tc.readOnly, settingErr: tc.settingErr}
			e := testSQLExecutor(t, d)
			result, err := e.Execute(context.Background(), executorCall())
			if err == nil || len(result.Rows) != 0 || d.statement != "" || !d.rolledBack || strings.Contains(err.Error(), "secret") {
				t.Fatalf("result=%+v err=%v driver=%+v", result, err, d)
			}
		})
	}
}

func TestSQLExecutorBoundsRowsAndPayload(t *testing.T) {
	for _, tc := range []struct {
		name  string
		count int
		value driver.Value
	}{
		{"rows", 101, int64(1)},
		{"payload", 1, strings.Repeat("x", QueryMaxPayload)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			d := &queryDriver{role: "ai_query_tool", readOnly: "on", count: tc.count, value: tc.value}
			e := testSQLExecutor(t, d)
			result, err := e.Execute(context.Background(), executorCall())
			if err == nil || len(result.Rows) != 0 || !d.rolledBack {
				t.Fatalf("result=%+v err=%v", result, err)
			}
		})
	}
}

func TestPoolerConnectionDisablesPreparedStatements(t *testing.T) {
	config, err := poolerConnectionConfig("postgresql://ai_query_tool.projectref:secret@pooler.example:6543/postgres?sslmode=require")
	if err != nil {
		t.Fatalf("pooler connection config = %v", err)
	}
	if config.DefaultQueryExecMode != pgx.QueryExecModeSimpleProtocol {
		t.Fatalf("pooler query mode = %v, want simple protocol", config.DefaultQueryExecMode)
	}
	if config.Host != "pooler.example" || config.Port != 6543 || config.User != "ai_query_tool.projectref" || config.Password != "secret" || config.Database != "postgres" {
		t.Fatal("parsed pooler authority was overridden")
	}
}

func TestPoolerStartupDiagnosticKeepsOnlySafeCause(t *testing.T) {
	err := poolerUnavailable("readiness", &pgconn.PgError{Code: "28P01", Message: "password=diagnostic-secret endpoint=pooler.example user=ai_query_tool"})
	if err.Error() != "external pooler query executor is unavailable" {
		t.Fatalf("public error = %q", err)
	}
	diagnostic, ok := err.(interface{ PoolerDiagnostic() string })
	if !ok {
		t.Fatal("pooler failure did not expose a server diagnostic")
	}
	if got, want := diagnostic.PoolerDiagnostic(), "stage=readiness cause=postgres_sqlstate_28P01"; got != want {
		t.Fatalf("diagnostic = %q, want %q", got, want)
	}
	for _, sensitive := range []string{"diagnostic-secret", "pooler.example", "ai_query_tool"} {
		if strings.Contains(diagnostic.PoolerDiagnostic(), sensitive) {
			t.Fatalf("diagnostic exposed driver details: %s", diagnostic.PoolerDiagnostic())
		}
	}
}

func TestPoolerConnectionConfigIgnoresStartupEnvironment(t *testing.T) {
	for name, value := range map[string]string{
		"PGHOST":               "127.0.0.1",
		"PGPORT":               "5432",
		"PGUSER":               "postgres",
		"PGPASSWORD":           "environment-secret",
		"PGDATABASE":           "other",
		"PGSSLMODE":            "disable",
		"PGOPTIONS":            "-c default_transaction_read_only=off -c search_path=public",
		"PGAPPNAME":            "environment-app",
		"PGTZ":                 "UTC",
		"PGTARGETSESSIONATTRS": "read-write",
	} {
		t.Setenv(name, value)
	}
	service := filepath.Join(t.TempDir(), "pg_service.conf")
	if err := os.WriteFile(service, []byte("[untrusted]\nhost=127.0.0.1\nport=5432\nuser=postgres\ndbname=other\nsslmode=disable\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PGSERVICEFILE", service)
	t.Setenv("PGSERVICE", "untrusted")

	config, err := poolerConnectionConfig("postgresql://ai_query_tool.projectref:url-secret@pooler.example:6543/postgres?sslmode=require")
	if err != nil {
		t.Fatalf("pooler connection config rejected the validated URL: %v", err)
	}
	if config.Host != "pooler.example" || config.Port != 6543 || config.User != "ai_query_tool.projectref" || config.Password != "url-secret" || config.Database != "postgres" {
		t.Fatal("pooler URL authority was overridden by the process environment")
	}
	if config.TLSConfig == nil {
		t.Fatal("pooler URL TLS requirement was not preserved")
	}
	if len(config.RuntimeParams) != 0 || config.ValidateConnect != nil || len(config.Fallbacks) != 0 {
		t.Fatal("process startup settings, validation callbacks, or TLS fallbacks were retained")
	}
}

func TestValidatePoolerURLRejectsConnectionParameterOverrides(t *testing.T) {
	for _, parameter := range []string{
		"host=override.example",
		"port=5432",
		"user=postgres",
		"dbname=other",
		"password=override-secret",
		"application_name=unexpected",
	} {
		t.Run(parameter, func(t *testing.T) {
			databaseURL := "postgresql://ai_query_tool:authority-secret@pooler.example:6543/postgres?sslmode=require&" + parameter
			_, err := poolerConnectionConfig(databaseURL)
			if err == nil {
				t.Fatal("pooler URL accepted a query-string override")
			}
			for _, sensitive := range []string{"authority-secret", "override-secret", "pooler.example", "ai_query_tool"} {
				if strings.Contains(err.Error(), sensitive) {
					t.Fatalf("validation error exposed connection details: %v", err)
				}
			}
		})
	}
}
