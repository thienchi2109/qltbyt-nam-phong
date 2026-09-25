package qltbyt

import (
	"context"
	"database/sql"
	"encoding/json"
)

// SQLExecutor uses an injected, dedicated pool. It never opens a connection from
// environment secrets or provisions the ai_query_tool role.
type SQLExecutor struct {
	DB *sql.DB
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
