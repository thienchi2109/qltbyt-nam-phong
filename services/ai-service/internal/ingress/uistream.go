package ingress

import (
	"encoding/json"
	"strconv"

	"example.com/shared-ai-service/internal/protocol"
)

const uiStreamHeader = "x-vercel-ai-ui-message-stream"
const uiStreamVersion = "v1"

type uiChunk struct {
	Type         string          `json:"type"`
	ID           string          `json:"id,omitempty"`
	Delta        string          `json:"delta,omitempty"`
	MessageID    string          `json:"messageId,omitempty"`
	FinishReason string          `json:"finishReason,omitempty"`
	ErrorText    string          `json:"errorText,omitempty"`
	ToolCallID   string          `json:"toolCallId,omitempty"`
	ToolName     string          `json:"toolName,omitempty"`
	Input        json.RawMessage `json:"input,omitempty"`
	Output       json.RawMessage `json:"output,omitempty"`
	Data         json.RawMessage `json:"data,omitempty"`
}

func uiChunks(requestID string, events []protocol.Event) ([]uiChunk, bool) {
	chunks := make([]uiChunk, 0, len(events)*2)
	sawError := false
	textID := ""
	textOpen := false
	closeText := func() {
		if textOpen {
			chunks = append(chunks, uiChunk{Type: "text-end", ID: textID})
			textOpen = false
		}
	}
	for _, event := range events {
		switch event.Type {
		case protocol.EventStart:
			chunks = append(chunks, uiChunk{Type: "start", MessageID: requestID})
		case protocol.EventStartStep:
			closeText()
			chunks = append(chunks, uiChunk{Type: "start-step"})
		case protocol.EventText:
			if !textOpen {
				textID = "text-" + strconv.Itoa(event.Step)
				if event.Step == 0 {
					textID = "text-1"
				}
				chunks = append(chunks, uiChunk{Type: "text-start", ID: textID})
				textOpen = true
			}
			chunks = append(chunks, uiChunk{Type: "text-delta", ID: textID, Delta: event.Text})
		case protocol.EventToolCall:
			closeText()
			chunks = append(chunks, uiChunk{
				Type:       "tool-input-available",
				ToolCallID: firstNonEmpty(event.ToolCallID, event.ToolName),
				ToolName:   event.ToolName,
				Input:      jsonValue(event.Text),
			})
		case protocol.EventToolResult:
			chunks = append(chunks, uiChunk{
				Type:       "tool-output-available",
				ToolCallID: firstNonEmpty(event.ToolCallID, event.ToolName),
				Output:     jsonValue(event.Text),
			})
		case protocol.EventArtifact:
			chunks = append(chunks, uiChunk{Type: "data-artifact", Data: artifactData(event)})
		case protocol.EventError:
			closeText()
			sawError = true
			message := "The model request failed."
			if event.Error != nil && event.Error.Message != "" {
				message = event.Error.Message
			}
			chunks = append(chunks, uiChunk{Type: "error", ErrorText: message})
		case protocol.EventFinishStep:
			closeText()
			chunks = append(chunks, uiChunk{Type: "finish-step"})
		case protocol.EventFinish:
			closeText()
			reason := "stop"
			if sawError {
				reason = "error"
			}
			chunks = append(chunks, uiChunk{Type: "finish", FinishReason: reason})
		}
	}
	closeText()
	return chunks, sawError
}

func jsonValue(text string) json.RawMessage {
	trimmed := text
	if json.Valid([]byte(trimmed)) && trimmed != "" {
		return json.RawMessage(trimmed)
	}
	encoded, err := json.Marshal(text)
	if err != nil {
		return json.RawMessage(`""`)
	}
	return encoded
}

func artifactData(event protocol.Event) json.RawMessage {
	payload := map[string]json.RawMessage{"name": jsonValue(event.ToolName)}
	if len(event.Payload) > 0 {
		payload["payload"] = event.Payload
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return encoded
}
