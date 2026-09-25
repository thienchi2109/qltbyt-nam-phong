package qltbyt

import (
	"encoding/json"

	"example.com/shared-ai-service/internal/protocol"
)

// compactHistoryMessage strips uiArtifact from a prior envelope.
// The active tool result still includes uiArtifact for the current turn.
func compactHistoryMessage(message protocol.Message) protocol.Message {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal([]byte(message.Content), &envelope); err != nil {
		return message
	}
	if _, ok := envelope["modelSummary"]; !ok {
		return message
	}
	if _, ok := envelope["uiArtifact"]; !ok {
		return message
	}
	delete(envelope, "uiArtifact")
	encoded, err := json.Marshal(envelope)
	if err != nil {
		return message
	}
	message.Content = string(encoded)
	return message
}
