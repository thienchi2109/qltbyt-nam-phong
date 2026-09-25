package qltbyt

import (
	"bytes"
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"example.com/shared-ai-service/internal/protocol"
)

// Broker is the injected BFF RPC path. Implementations must not be a live
// database client and must not receive a browser cookie.
type Broker interface {
	Call(ctx context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error)
}

// QueryExecutor is the injected read-only ai_query_tool role.
type QueryExecutor interface {
	Execute(ctx context.Context, call QueryCall) (QueryResult, error)
}

type QueryCall struct {
	Statement       string
	SearchPath      string
	Timeout         time.Duration
	MaxRows         int
	MaxPayloadBytes int
	FacilityID      int64
	UserID          int64
	Role            string
}

type QueryResult struct {
	Rows         json.RawMessage
	RowCount     int
	PayloadBytes int
}

// RedactedLog receives a request id and error class, never prompt, SQL, or rows.
type RedactedLog interface {
	Record(requestID, errorClass string)
}

type gate struct {
	inner   Broker
	secret  []byte
	now     func() time.Time
	cleanup time.Duration
}

func (g gate) clock() time.Time {
	if g.now != nil {
		return g.now()
	}
	return time.Now()
}

func (g gate) Call(ctx context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := g.authorize(cred, rpc, false); err != nil {
		return nil, err
	}
	if g.inner == nil {
		return nil, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The data broker is unavailable.", false)
	}
	return g.inner.Call(ctx, cred, rpc, payload)
}

// Cleanup uses a detached context of at most five seconds. It keeps the
// original user and facility and cannot call a new RPC.
func (g gate) Cleanup(parent context.Context, cred Credential, rpc string, payload json.RawMessage) (json.RawMessage, error) {
	if err := g.authorize(cred, rpc, true); err != nil {
		return nil, err
	}
	if rpc == RPCQuotaFinalize && !finalizePayloadAllowed(payload) {
		return nil, protocol.NewError(403, protocol.CodeUnauthorized, "Cleanup cannot call quota finalize.", false)
	}
	if err := rejectWidenedPayload(cred, payload); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parent), g.cleanupBudget())
	defer cancel()
	if g.inner == nil {
		return nil, protocol.NewError(503, protocol.CodeCapabilityUnavailable, "The data broker is unavailable.", false)
	}
	return g.inner.Call(ctx, cred, rpc, payload)
}

func (g gate) authorize(cred Credential, rpc string, cleanup bool) error {
	if len(g.secret) == 0 {
		return errCredential
	}
	if err := validateCredential(cred, g.clock()); err != nil {
		return err
	}
	if !knownRPC(rpc) {
		return protocol.NewError(403, protocol.CodeUnauthorized, "The RPC is not allowlisted.", false)
	}
	if cleanup {
		if rpc == RPCAudit || rpc == RPCQuotaFinalize {
			return nil
		}
		return protocol.NewError(403, protocol.CodeUnauthorized, "Cleanup cannot call a new RPC.", false)
	}
	if !chatRPCAllowed(rpc) {
		return protocol.NewError(403, protocol.CodeUnauthorized, "The chat path cannot call that RPC.", false)
	}
	return nil
}

func (g gate) cleanupBudget() time.Duration {
	if g.cleanup <= 0 || g.cleanup > CleanupMax {
		return CleanupMax
	}
	return g.cleanup
}

func finalizePayloadAllowed(payload json.RawMessage) bool {
	if len(bytes.TrimSpace(payload)) == 0 {
		return false
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(payload, &fields); err != nil || len(fields) == 0 {
		return false
	}
	raw, ok := fields["p_reservation_id"]
	if !ok {
		return false
	}
	var id string
	if err := json.Unmarshal(raw, &id); err != nil {
		return false
	}
	return strings.TrimSpace(id) != ""
}

func rejectWidenedPayload(cred Credential, payload json.RawMessage) error {
	if len(payload) == 0 {
		return nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(payload, &fields); err != nil {
		return protocol.NewError(400, protocol.CodeInvalidRequest, "The cleanup payload is not valid.", false)
	}
	if value, ok := fields["p_user_id"]; ok && !numberMatches(value, cred.UserID) {
		return protocol.NewError(403, protocol.CodeUnauthorized, "Cleanup cannot use a new user.", false)
	}
	if cred.SessionFacilityID != nil {
		if value, ok := fields["p_session_facility_id"]; ok && !numberMatches(value, *cred.SessionFacilityID) {
			return protocol.NewError(403, protocol.CodeUnauthorized, "Cleanup cannot use a new facility.", false)
		}
	}
	effective := effectiveFacility(cred)
	if value, ok := fields["p_effective_facility_id"]; ok && effective > 0 && !numberMatches(value, effective) {
		return protocol.NewError(403, protocol.CodeUnauthorized, "Cleanup cannot use a new facility.", false)
	}
	return nil
}

func effectiveFacility(cred Credential) int64 {
	scope := resolveScope(cred, false)
	return scope.EffectiveFacilityID
}

func numberMatches(raw json.RawMessage, want int64) bool {
	var value int64
	if err := json.Unmarshal(raw, &value); err == nil {
		return value == want
	}
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return false
	}
	parsed, err := strconv.ParseInt(strings.TrimSpace(text), 10, 64)
	return err == nil && parsed == want
}
