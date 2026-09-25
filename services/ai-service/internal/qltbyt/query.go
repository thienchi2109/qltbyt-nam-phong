package qltbyt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

type auditBody struct {
	SQLShape       string `json:"p_sql_shape"`
	ToolPath       string `json:"p_tool_path"`
	Status         string `json:"p_status"`
	LatencyMS      int64  `json:"p_latency_ms"`
	Effective      int64  `json:"p_effective_facility_id"`
	FacilitySource string `json:"p_facility_source"`
	ErrorClass     string `json:"p_error_class,omitempty"`
	RowCount       *int   `json:"p_row_count,omitempty"`
	PayloadBytes   *int   `json:"p_payload_bytes,omitempty"`
	Requested      *int64 `json:"p_requested_facility_id,omitempty"`
	Session        *int64 `json:"p_session_facility_id,omitempty"`
	RawRole        string `json:"p_raw_role,omitempty"`
}

func (a Assistant) queryEnabled() bool {
	return a.Query != nil && a.Broker != nil
}

func (a Assistant) executeQuery(ctx context.Context, cred Credential, scope Scope, facilityID int64, sql, requestID string) (json.RawMessage, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if !a.queryEnabled() {
		return nil, sqlError("disabled", "query_database is disabled.")
	}
	if err := authorizeQueryFacility(scope, facilityID); err != nil {
		return nil, err
	}
	started := time.Now()
	validated, err := validateSQL(sql)
	if err != nil {
		a.auditFailure(ctx, cred, scope, requestID, sanitizedShape(sql), errorClass(err), started)
		return nil, err
	}
	callCtx, cancel := context.WithTimeout(ctx, QueryTimeout)
	defer cancel()
	result, execErr := a.Query.Execute(callCtx, QueryCall{
		Statement:       validated.Statement,
		SearchPath:      QuerySearchPath,
		Timeout:         QueryTimeout,
		MaxRows:         QueryMaxRows,
		MaxPayloadBytes: QueryMaxPayload,
		FacilityID:      scope.EffectiveFacilityID,
		UserID:          cred.UserID,
		Role:            scope.NormalizedRole,
	})
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if execErr != nil {
		a.auditFailure(ctx, cred, scope, requestID, sanitizedShape(validated.SQLShape), errorClass(execErr), started)
		return nil, publicQueryError(execErr)
	}
	if result.RowCount > QueryMaxRows || result.PayloadBytes > QueryMaxPayload || len(result.Rows) > QueryMaxPayload {
		limitErr := sqlError("execution_error", "The query result exceeds the read-only limit.")
		a.auditFailure(ctx, cred, scope, requestID, sanitizedShape(validated.SQLShape), "execution_error", started)
		return nil, limitErr
	}
	if result.PayloadBytes == 0 {
		result.PayloadBytes = len(result.Rows)
	}
	if err := a.writeAudit(ctx, cred, scope, requestID, auditBody{
		SQLShape:       sanitizedShape(validated.SQLShape),
		ToolPath:       QueryToolName,
		Status:         "success",
		LatencyMS:      latencyMS(started),
		Effective:      scope.EffectiveFacilityID,
		FacilitySource: scope.FacilitySource,
		RowCount:       intPtr(result.RowCount),
		PayloadBytes:   intPtr(result.PayloadBytes),
		Requested:      scope.RequestedFacilityID,
		Session:        scope.SessionFacilityID,
		RawRole:        scope.RawRole,
	}); err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, err
	}
	return result.Rows, nil
}

func authorizeQueryFacility(scope Scope, facilityID int64) error {
	if scope.Guidance != "" || scope.EffectiveFacilityID <= 0 || facilityID != scope.EffectiveFacilityID {
		return protocol.NewError(403, protocol.CodeUnauthorized, "The facility scope is not authorized.", false)
	}
	if scope.FacilitySource != facilitySourceSelected && scope.FacilitySource != facilitySourceSession {
		return protocol.NewError(403, protocol.CodeUnauthorized, "The facility scope is not authorized.", false)
	}
	return nil
}

func (a Assistant) auditFailure(ctx context.Context, cred Credential, scope Scope, requestID, shape, class string, started time.Time) {
	if ctx.Err() != nil {
		return
	}
	_ = a.writeAudit(ctx, cred, scope, requestID, auditBody{
		SQLShape:       shape,
		ToolPath:       QueryToolName,
		Status:         "failure",
		LatencyMS:      latencyMS(started),
		Effective:      scope.EffectiveFacilityID,
		FacilitySource: scope.FacilitySource,
		ErrorClass:     class,
		Requested:      scope.RequestedFacilityID,
		Session:        scope.SessionFacilityID,
		RawRole:        scope.RawRole,
	})
}

func (a Assistant) writeAudit(ctx context.Context, cred Credential, scope Scope, requestID string, body auditBody) error {
	if body.SQLShape == "" || len([]rune(body.SQLShape)) > QueryShapeMax {
		a.record(requestID, "audit_error")
		return sqlError("audit_error", "Assistant SQL audit logging failed.")
	}
	if body.ToolPath != QueryToolName || (body.Status != "success" && body.Status != "failure") || body.LatencyMS < 0 {
		a.record(requestID, "audit_error")
		return sqlError("audit_error", "Assistant SQL audit logging failed.")
	}
	if body.FacilitySource != facilitySourceSelected && body.FacilitySource != facilitySourceSession {
		a.record(requestID, "audit_error")
		return sqlError("audit_error", "Assistant SQL audit logging failed.")
	}
	if body.Status == "failure" && body.ErrorClass == "" {
		a.record(requestID, "audit_error")
		return sqlError("audit_error", "Assistant SQL audit logging failed.")
	}
	payload, err := json.Marshal(body)
	if err != nil {
		a.record(requestID, "audit_error")
		return sqlError("audit_error", "Assistant SQL audit logging failed.")
	}
	_, err = a.gate().Call(ctx, cred, RPCAudit, payload)
	if err != nil {
		a.record(requestID, "audit_error")
		return sqlError("audit_error", "Assistant SQL audit logging failed.")
	}
	return nil
}

func (a Assistant) gate() gate {
	return gate{inner: a.Broker, secret: a.Secret, now: a.Now, cleanup: a.Cleanup}
}

func (a Assistant) record(requestID, class string) {
	if a.Log != nil && class != "" {
		a.Log.Record(requestID, class)
	}
}

// SessionSettings are the transaction settings the read-only executor must apply.
// They mirror the current assistant SQL executor. Creating the database role
// remains a separate SQL change.
func SessionSettings(call QueryCall) [][2]string {
	timeout := call.Timeout
	if timeout <= 0 {
		timeout = QueryTimeout
	}
	return [][2]string{
		{"statement_timeout", fmt.Sprintf("%dms", timeout.Milliseconds())},
		{"search_path", call.SearchPath},
		{"app.current_facility_id", strconv.FormatInt(call.FacilityID, 10)},
		{"app.current_user_id", strconv.FormatInt(call.UserID, 10)},
		{"app.current_role", call.Role},
	}
}

// LimitedStatement wraps one validated statement with the read-only row cap.
func LimitedStatement(statement string, maxRows int) string {
	if maxRows <= 0 {
		maxRows = QueryMaxRows
	}
	return fmt.Sprintf("select * from (%s) as assistant_sql_result limit %d", statement, maxRows+1)
}

func publicQueryError(err error) error {
	var sqlErr *SQLError
	if errors.As(err, &sqlErr) {
		return sqlErr
	}
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) {
		clone := *serviceErr
		clone.Cause = nil
		clone.Details = nil
		return &clone
	}
	return sqlError("execution_error", "Assistant SQL query failed.")
}

func errorClass(err error) string {
	if sqlErr, ok := err.(*SQLError); ok && sqlErr.Code != "" {
		return sqlErr.Code
	}
	return "execution_error"
}

func latencyMS(started time.Time) int64 {
	value := time.Since(started).Milliseconds()
	if value < 0 {
		return 0
	}
	return value
}

func intPtr(value int) *int {
	return &value
}
