package qltbyt

import (
	"context"
	"strings"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
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
	assistant.storeBudget(requestID, 100)
	first := `{"modelSummary":{"summaryText":"equipmentLookup: 1 result(s)."},"uiArtifact":{"rawPayload":{"secret":"KEEP"}}}`
	if err := assistant.acceptToolOutput(requestID, first); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(first, "uiArtifact") || strings.Contains(modelFacingOutput(first), "uiArtifact") {
		t.Fatal("accepted output lost or kept uiArtifact for the model")
	}
	slot := assistant.budgetSlot(requestID)
	slot.mu.Lock()
	used := slot.used
	slot.mu.Unlock()
	if used != 100+len(modelFacingOutput(first)) {
		t.Fatalf("used = %d, want compacted growth only", used)
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
	err := assistant.acceptToolOutput(requestID, full)
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

func asProtocol(err error, target **protocol.Error) bool {
	serviceErr, ok := err.(*protocol.Error)
	if ok {
		*target = serviceErr
	}
	return ok
}
