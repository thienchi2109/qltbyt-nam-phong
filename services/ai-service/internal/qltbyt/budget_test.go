package qltbyt

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"example.com/shared-ai-service/internal/orchestration"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
)

func TestClarificationSkipsCompactionBudget(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	request := testRequest(t, cred, "sửa chữa", []string{"equipmentLookup", "repairSummary"})
	request.Messages = []protocol.Message{
		{Role: protocol.RoleTool, Content: strings.Repeat("H", CompactedInputLimit+1)},
		{Role: protocol.RoleUser, Content: "sửa chữa"},
	}
	prepared, err := assistant.Prepare(context.Background(), request)
	if err != nil || prepared.Clarification != RepairClarification {
		t.Fatalf("prepared=%+v err=%v", prepared, err)
	}
	if _, ok := assistant.budgets.Load(request.RequestID); ok {
		t.Fatal("clarification initialized the context budget")
	}
}

func TestHistoryArtifactIsStrippedBeforeTheBudgetGate(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	request := testRequest(t, cred, "xin chào", nil)
	request.Messages = []protocol.Message{
		{Role: protocol.RoleTool, Content: `{"modelSummary":{"summaryText":"kept"},"uiArtifact":{"rawPayload":{"blob":"` + strings.Repeat("H", CompactedInputLimit) + `"}}}`},
		{Role: protocol.RoleUser, Content: "xin chào"},
	}
	prepared, err := assistant.Prepare(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	for _, message := range prepared.Messages {
		if message.Role == protocol.RoleSystem {
			continue
		}
		if strings.Contains(message.Content, "uiArtifact") || strings.Contains(message.Content, strings.Repeat("H", 20)) {
			t.Fatalf("history kept the artifact: %s", message.Content)
		}
	}
}

func TestLaterToolStepRejectsFullOutputWithoutStrippingArtifact(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	cred := testCredential("technician", facilityPtr(2), nil)
	scope := resolveScope(cred, true)
	requestID := "req-budget"
	assistant.budgetSlot(requestID).used = 100
	arguments := `{"equipmentID":"eq-1"}`
	first := `{"modelSummary":{"summaryText":"equipmentLookup: 1 result(s)."},"uiArtifact":{"rawPayload":{"secret":"KEEP"}}}`
	if err := assistant.acceptToolOutput(requestID, arguments, first); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(first, "uiArtifact") || strings.Contains(modelFacingOutput(first), "uiArtifact") {
		t.Fatal("accepted output lost or kept uiArtifact for the model")
	}
	slot := assistant.budgetSlot(requestID)
	slot.mu.Lock()
	used := slot.used
	slot.mu.Unlock()
	if used != 100+len(arguments)+len(modelFacingOutput(first)) {
		t.Fatalf("used = %d, want arguments and compacted output charged", used)
	}
	blob := strings.Repeat("Z", 300)
	full := `{"modelSummary":{"summaryText":"short"},"uiArtifact":{"rawPayload":"` + blob + `"}}`
	compact := modelFacingOutput(full)
	slot.mu.Lock()
	slot.used = CompactedInputLimit - len(compact)
	slot.mu.Unlock()
	if len(compact) >= len(full) || slot.used+len(full) <= CompactedInputLimit {
		t.Fatal("fixture does not reject only the full output")
	}
	err := assistant.acceptToolOutput(requestID, "", full)
	var serviceErr *protocol.Error
	if err == nil || !strings.Contains(err.Error(), "Request exceeds compacted context limit.") {
		t.Fatalf("err = %v", err)
	}
	if !asProtocol(err, &serviceErr) || strings.Contains(compact, "uiArtifact") || !strings.Contains(full, "uiArtifact") {
		t.Fatalf("artifact was removed to pass the check: %v", err)
	}
	tools := assistant.bindTools(cred, scope, requestID, []string{"equipmentLookup"})
	if tools[0].ModelOutput == nil || strings.Contains(tools[0].ModelOutput(full), "uiArtifact") {
		t.Fatal("tool did not compact the provider output")
	}
}

func TestToolBudgetChargesArgumentsAndCompactedOutput(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	requestID := "req-argument-budget"
	full := "ok"
	assistant.budgetSlot(requestID).used = CompactedInputLimit - len(full)
	arguments := "A"
	if err := assistant.acceptToolOutput(requestID, arguments, full); err == nil {
		t.Fatal("tool arguments alone exceeded the remaining shared budget")
	}
	if assistant.budgetSlot(requestID).used != CompactedInputLimit-len(full) {
		t.Fatal("rejected tool output changed the running budget")
	}
}

func TestPreparedBudgetRejectsDuplicateAndReleasesItsOwnSlot(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "xin chào", nil)
	prepared, err := assistant.Prepare(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	slot := assistant.budgetSlot(request.RequestID)
	slot.mu.Lock()
	slot.used = 123
	slot.mu.Unlock()
	duplicate := request
	duplicate.Messages = userMessages("a smaller prompt")
	if _, err := assistant.Prepare(context.Background(), duplicate); err == nil {
		t.Fatal("overlapping duplicate request reused the active budget slot")
	}
	slot.mu.Lock()
	used := slot.used
	slot.mu.Unlock()
	if used != 123 {
		t.Fatalf("duplicate changed active budget from 123 to %d", used)
	}
	prepared.Cleanup()
	if _, ok := assistant.budgets.Load(request.RequestID); ok {
		t.Fatal("completed execution retained its budget slot")
	}
	if next, err := assistant.Prepare(context.Background(), duplicate); err != nil {
		t.Fatal(err)
	} else {
		next.Cleanup()
	}
}

func TestRunnerReleasesBudgetWhenProviderOpenFails(t *testing.T) {
	assistant := testAssistant(&spyBroker{}, &spyQuery{})
	reg := registry.New()
	if err := Register(reg, assistant); err != nil {
		t.Fatal(err)
	}
	runner := &orchestration.Runner{
		Registry: reg,
		Usage:    usage.NewMemory(func() time.Time { return fixedNow }),
		Open: func(context.Context, protocol.Request) (orchestration.ModelSession, error) {
			return nil, errors.New("provider open failed")
		},
	}
	request := testRequest(t, testCredential("technician", facilityPtr(2), nil), "xin chào", nil)
	if _, err := runner.Run(context.Background(), request); err == nil {
		t.Fatal("provider open failure was lost")
	}
	if _, ok := assistant.budgets.Load(request.RequestID); ok {
		t.Fatal("provider error retained its budget slot")
	}
}

func asProtocol(err error, target **protocol.Error) bool {
	serviceErr, ok := err.(*protocol.Error)
	if ok {
		*target = serviceErr
	}
	return ok
}
