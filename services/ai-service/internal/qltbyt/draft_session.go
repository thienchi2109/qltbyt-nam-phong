package qltbyt

import (
	"strings"

	"example.com/shared-ai-service/internal/protocol"
)

func repairDraftSession(messages []protocol.Message) (bool, int) {
	start := -1
	for index, message := range messages {
		if message.Role == protocol.RoleUser {
			switch draftIntent(message.Content) {
			case "cancel":
				start = -1
			case "start":
				start = index
			}
			continue
		}
		if start >= 0 && draftOutputPresent(message) {
			start = -1
		}
	}
	if start < 0 {
		return false, 0
	}
	return true, start
}

func draftOutputPresent(message protocol.Message) bool {
	if message.Role == protocol.RoleUser {
		return false
	}
	return strings.Contains(message.Content, `"kind":"repairRequestDraft"`) ||
		strings.Contains(message.Content, `"kind": "repairRequestDraft"`)
}
