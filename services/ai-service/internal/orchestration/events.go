package orchestration

import (
	"context"
	"errors"
	"strings"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
)

func buildEvents(requestID, text string, tools []capability.ToolResult, artifacts []protocol.Artifact, serviceErr *protocol.Error) []protocol.Event {
	events := []protocol.Event{{Type: protocol.EventStart, RequestID: requestID}}
	step := 0
	for _, result := range tools {
		step++
		events = append(events,
			protocol.Event{Type: protocol.EventStartStep, RequestID: requestID, Step: step},
			protocol.Event{Type: protocol.EventToolCall, RequestID: requestID, Step: step, ToolName: result.Name, ToolCallID: result.CallID, Text: result.Arguments},
			protocol.Event{Type: protocol.EventToolResult, RequestID: requestID, Step: step, ToolName: result.Name, ToolCallID: result.CallID, Text: result.Output},
			protocol.Event{Type: protocol.EventFinishStep, RequestID: requestID, Step: step},
		)
	}
	if text != "" {
		step++
		events = append(events,
			protocol.Event{Type: protocol.EventStartStep, RequestID: requestID, Step: step},
			protocol.Event{Type: protocol.EventText, RequestID: requestID, Step: step, Text: text},
			protocol.Event{Type: protocol.EventFinishStep, RequestID: requestID, Step: step},
		)
	}
	for _, artifact := range artifacts {
		events = append(events, protocol.Event{
			Type:      protocol.EventArtifact,
			RequestID: requestID,
			ToolName:  artifact.Name,
			Payload:   artifact.Payload,
		})
	}
	if serviceErr != nil {
		events = append(events, protocol.Event{Type: protocol.EventError, RequestID: requestID, Error: serviceErr})
	}
	events = append(events,
		protocol.Event{Type: protocol.EventFinish, RequestID: requestID},
		protocol.Event{Type: protocol.EventDone, RequestID: requestID},
	)
	return events
}

func clarificationEvents(requestID, text string) []protocol.Event {
	return []protocol.Event{
		{Type: protocol.EventStart, RequestID: requestID},
		{Type: protocol.EventText, RequestID: requestID, Text: text},
		{Type: protocol.EventFinish, RequestID: requestID},
		{Type: protocol.EventDone, RequestID: requestID},
	}
}

func publicError(requestID string, err error) *protocol.Error {
	if err == nil {
		return nil
	}
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) {
		return serviceErr.WithRequest(requestID)
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return protocol.NewError(499, protocol.CodeCancelled, "The request was cancelled.", false).WithRequest(requestID).WithCause(err)
	}
	if errors.Is(err, errToolInput) || errors.Is(err, errToolOutput) || errors.Is(err, errToolSteps) {
		return protocol.NewError(400, protocol.CodeToolLimit, "The request exceeded a tool limit.", false).WithRequest(requestID).WithCause(err)
	}
	if isQuotaError(err) {
		return protocol.NewError(503, protocol.CodeProviderQuota, "The model provider is temporarily unavailable.", true).WithRequest(requestID).WithCause(err)
	}
	return protocol.NewError(502, protocol.CodeProviderFailure, "The model request failed.", false).WithRequest(requestID).WithCause(err)
}

func isQuotaError(err error) bool {
	if err == nil {
		return false
	}
	text := strings.ToLower(err.Error())
	return strings.Contains(text, "429") ||
		strings.Contains(text, "quota") ||
		strings.Contains(text, "resource exhausted") ||
		strings.Contains(text, "too many requests")
}
