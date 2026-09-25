package qltbyt

import (
	"encoding/json"
	"sync"

	"example.com/shared-ai-service/internal/protocol"
)

type budgetSlot struct {
	mu   sync.Mutex
	used int
}

func (a Assistant) budgetSlot(requestID string) *budgetSlot {
	if a.budgets == nil || requestID == "" {
		return nil
	}
	if value, ok := a.budgets.Load(requestID); ok {
		if slot, ok := value.(*budgetSlot); ok {
			return slot
		}
	}
	slot := &budgetSlot{}
	actual, _ := a.budgets.LoadOrStore(requestID, slot)
	loaded, ok := actual.(*budgetSlot)
	if !ok {
		return slot
	}
	return loaded
}

func (a Assistant) claimBudget(requestID string, used int) (*budgetSlot, error) {
	if a.budgets == nil || requestID == "" {
		return nil, nil
	}
	slot := &budgetSlot{used: used}
	if _, loaded := a.budgets.LoadOrStore(requestID, slot); loaded {
		return nil, protocol.NewError(409, protocol.CodeInvalidRequest, "The request is already reserved.", false)
	}
	return slot, nil
}

func (a Assistant) releaseBudget(requestID string, slot *budgetSlot) {
	if a.budgets != nil && slot != nil {
		a.budgets.CompareAndDelete(requestID, slot)
	}
}

func (a Assistant) acceptToolOutput(requestID, arguments, full string) error {
	compacted := modelFacingOutput(full)
	slot := a.budgetSlot(requestID)
	used := 0
	if slot != nil {
		slot.mu.Lock()
		defer slot.mu.Unlock()
		used = slot.used
	}
	if used+len(arguments)+len(full) > CompactedInputLimit {
		return protocol.NewError(400, protocol.CodeLimitExceeded, "Request exceeds compacted context limit.", false)
	}
	if slot != nil {
		slot.used += len(arguments) + len(compacted)
	}
	return nil
}

func (a Assistant) reserveExtraction(requestID, prompt string) bool {
	slot := a.budgetSlot(requestID)
	if slot == nil {
		return len(prompt) <= CompactedInputLimit
	}
	slot.mu.Lock()
	defer slot.mu.Unlock()
	if slot.used+len(prompt) > CompactedInputLimit {
		return false
	}
	slot.used += len(prompt)
	return true
}

func modelFacingOutput(full string) string {
	stripped := compactHistoryMessage(protocol.Message{Content: full}).Content
	if stripped != full {
		return stripped
	}
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal([]byte(full), &envelope); err != nil {
		return full
	}
	if _, ok := envelope["uiArtifact"]; !ok {
		return full
	}
	delete(envelope, "uiArtifact")
	encoded, err := json.Marshal(envelope)
	if err != nil {
		return full
	}
	return string(encoded)
}
