package qltbyt

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
)

type queryFunc func(context.Context, QueryCall) (QueryResult, error)

func (f queryFunc) Execute(ctx context.Context, call QueryCall) (QueryResult, error) {
	return f(ctx, call)
}

func TestCancellationDuringQueryReturnsOnlyContext(t *testing.T) {
	for _, execErr := range []error{errors.New("private driver detail"), fmt.Errorf("private detail: %w", context.Canceled), nil} {
		ctx, cancel := context.WithCancel(context.Background())
		broker := &spyBroker{}
		executor := queryFunc(func(context.Context, QueryCall) (QueryResult, error) {
			cancel()
			return QueryResult{Rows: []byte(`[{"private":true}]`)}, execErr
		})
		assistant := testAssistant(broker, executor)
		scope := resolvedScope(t, "technician", 2)
		rows, err := assistant.executeQuery(ctx, testCredential("technician", facilityPtr(2), nil), scope, 2, "select equipment_id from equipment_search", "cancel")
		cancel()
		if err != context.Canceled || len(rows) != 0 || len(broker.snapshot()) != 0 {
			t.Fatalf("rows=%s err=%v audit=%v", rows, err, broker.snapshot())
		}
	}
}

func TestWrappedExecutorTimeoutIsAuditedWithoutDriverText(t *testing.T) {
	broker := &spyBroker{}
	executor := &spyQuery{err: fmt.Errorf("private SQL: %w", context.DeadlineExceeded)}
	assistant := testAssistant(broker, executor)
	scope := resolvedScope(t, "technician", 2)
	_, err := assistant.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), scope, 2, "select equipment_id from equipment_search", "timeout")
	if err == nil || err.Error() != "Assistant SQL query failed." || len(broker.snapshot()) != 1 {
		t.Fatalf("err=%v audit=%v", err, broker.snapshot())
	}
}

func TestExecutorTimeoutIsAuditedAndSanitized(t *testing.T) {
	broker := &spyBroker{}
	executor := &spyQuery{err: context.DeadlineExceeded}
	assistant := testAssistant(broker, executor)
	scope := resolvedScope(t, "technician", 2)
	_, err := assistant.executeQuery(context.Background(), testCredential("technician", facilityPtr(2), nil), scope, scope.EffectiveFacilityID, "select equipment_id from ai_readonly.equipment_search", "req-timeout")
	if err == nil || err.Error() != "Assistant SQL query failed." {
		t.Fatalf("err = %v", err)
	}
	if len(broker.snapshot()) != 1 || !strings.Contains(string(broker.snapshot()[0].Payload), `"p_status":"failure"`) {
		t.Fatalf("timeout audit = %+v", broker.snapshot())
	}
}

func TestCancelledExecutorReturnsContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	assistant := testAssistant(&spyBroker{}, &spyQuery{err: errors.New("driver secret")})
	scope := resolvedScope(t, "technician", 2)
	_, err := assistant.executeQuery(ctx, testCredential("technician", facilityPtr(2), nil), scope, scope.EffectiveFacilityID, "select equipment_id from ai_readonly.equipment_search", "req-cancel")
	if !errors.Is(err, context.Canceled) || strings.Contains(err.Error(), "driver secret") {
		t.Fatalf("err = %v", err)
	}
}
