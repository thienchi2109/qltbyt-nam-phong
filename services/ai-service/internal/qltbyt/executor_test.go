package qltbyt

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"io"
	"strings"
	"testing"
)

// This driver exercises database/sql transaction wiring without a database.
type queryDriver struct {
	role, readOnly        string
	settings              map[string]string
	statement             string
	count                 int
	value                 driver.Value
	settingErr            bool
	committed, rolledBack bool
}

func (d *queryDriver) Connect(context.Context) (driver.Conn, error) { return d, nil }
func (d *queryDriver) Driver() driver.Driver                        { return d }
func (d *queryDriver) Open(string) (driver.Conn, error)             { return d, nil }
func (d *queryDriver) Close() error                                 { return nil }
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
func (d *queryDriver) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	if query == "select current_user, current_setting('transaction_read_only')" {
		return &executorRows{columns: []string{"role", "read_only"}, values: []driver.Value{d.role, d.readOnly}, remaining: 1}, nil
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
}

func (r *executorRows) Columns() []string { return r.columns }
func (r *executorRows) Close() error      { return nil }
func (r *executorRows) Next(dest []driver.Value) error {
	if r.remaining == 0 {
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
