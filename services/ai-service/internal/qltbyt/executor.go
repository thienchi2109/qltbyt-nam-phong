package qltbyt

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
)

const approvedViewReadinessQuery = "select c.relkind::text, pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE'), pg_catalog.has_table_privilege(current_user, c.oid, 'SELECT') from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'ai_readonly' and c.relname = $1"

// SQLExecutor uses an injected, dedicated pool. It never opens a connection from
// environment secrets or provisions the ai_query_tool role.
type SQLExecutor struct {
	DB *sql.DB
}

func (e *SQLExecutor) Close() error {
	if e == nil || e.DB == nil {
		return nil
	}
	return e.DB.Close()
}

// Ready verifies that the active connection is the dedicated read-only role.
func (e SQLExecutor) Ready(ctx context.Context) error {
	err := e.checkReady(ctx)
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	return publicQueryError(err)
}

func (e SQLExecutor) checkReady(ctx context.Context) error {
	if e.DB == nil {
		return sqlError("disabled", "query_database is disabled.")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()
	tx, err := e.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return err
	}
	defer tx.Rollback()
	var role, transactionReadOnly, defaultReadOnly string
	err = tx.QueryRowContext(ctx, "select current_user, current_setting('transaction_read_only'), current_setting('default_transaction_read_only')").Scan(&role, &transactionReadOnly, &defaultReadOnly)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return err
	}
	if role != "ai_query_tool" || transactionReadOnly != "on" || defaultReadOnly != "on" {
		return sqlError("disabled", "A dedicated read-only query connection is required.")
	}
	for view := range approvedViews {
		var relationKind string
		var schemaUsage, selectPrivilege bool
		err = tx.QueryRowContext(ctx, approvedViewReadinessQuery, view).Scan(&relationKind, &schemaUsage, &selectPrivilege)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return err
		}
		if relationKind != "v" || !schemaUsage || !selectPrivilege {
			return sqlError("disabled", "The approved read-only query catalog is unavailable.")
		}
	}
	return nil
}

func (e SQLExecutor) Execute(ctx context.Context, call QueryCall) (result QueryResult, err error) {
	parent := ctx
	defer func() {
		if parent.Err() != nil {
			err = parent.Err()
		} else if err != nil {
			err = publicQueryError(err)
		}
		if err != nil {
			result = QueryResult{}
		}
	}()
	if e.DB == nil {
		return result, sqlError("disabled", "query_database is disabled.")
	}
	if call.FacilityID <= 0 || call.UserID <= 0 || normalizeScopeRole(call.Role) == "" {
		return result, sqlError("scope_required", "Server-injected query scope is required.")
	}
	validated, err := validateSQL(call.Statement)
	if err != nil {
		return result, err
	}
	call.Timeout = QueryTimeout
	call.SearchPath = QuerySearchPath
	call.MaxRows = QueryMaxRows
	call.MaxPayloadBytes = QueryMaxPayload
	call.Role = normalizeScopeRole(call.Role)
	ctx, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()
	tx, err := e.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return result, err
	}
	defer tx.Rollback()
	var role, readOnly string
	if err = tx.QueryRowContext(ctx, "select current_user, current_setting('transaction_read_only')").Scan(&role, &readOnly); err != nil {
		return result, err
	}
	if role != "ai_query_tool" || readOnly != "on" {
		return result, sqlError("disabled", "A dedicated read-only query connection is required.")
	}
	for _, setting := range SessionSettings(call) {
		if _, err = tx.ExecContext(ctx, "select set_config($1, $2, true)", setting[0], setting[1]); err != nil {
			return result, err
		}
	}
	rows, err := tx.QueryContext(ctx, LimitedStatement(validated.Statement, call.MaxRows))
	if err != nil {
		return result, err
	}
	defer rows.Close()
	columns, err := rows.Columns()
	if err != nil {
		return result, err
	}
	payload := []byte{'['}
	for rows.Next() {
		if result.RowCount >= call.MaxRows {
			return QueryResult{}, sqlError("execution_error", "The query result exceeds the read-only limit.")
		}
		values := make([]any, len(columns))
		pointers := make([]any, len(columns))
		for i := range values {
			pointers[i] = &values[i]
		}
		if err = rows.Scan(pointers...); err != nil {
			return result, err
		}
		row := make(map[string]any, len(columns))
		for i, name := range columns {
			if value, ok := values[i].([]byte); ok {
				values[i] = string(value)
			}
			row[name] = values[i]
		}
		encoded, encodeErr := json.Marshal(row)
		if encodeErr != nil {
			return result, encodeErr
		}
		if result.RowCount > 0 {
			payload = append(payload, ',')
		}
		if len(payload)+len(encoded)+1 > call.MaxPayloadBytes {
			return QueryResult{}, sqlError("execution_error", "The query result exceeds the read-only limit.")
		}
		payload = append(payload, encoded...)
		result.RowCount++
	}
	if err = rows.Err(); err != nil {
		return result, err
	}
	if err = rows.Close(); err != nil {
		return result, err
	}
	if err = tx.Commit(); err != nil {
		return result, err
	}
	result.Rows = append(payload, ']')
	result.PayloadBytes = len(result.Rows)
	return result, nil
}
