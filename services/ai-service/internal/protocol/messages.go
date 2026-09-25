package protocol

import "github.com/cloudwego/eino/schema"

// ToSchemaMessages converts the app-neutral transcript into Eino messages.
func ToSchemaMessages(messages []Message) ([]*schema.Message, error) {
	converted := make([]*schema.Message, 0, len(messages))
	for _, message := range messages {
		switch message.Role {
		case RoleSystem:
			converted = append(converted, schema.SystemMessage(message.Content))
		case RoleUser:
			converted = append(converted, schema.UserMessage(message.Content))
		case RoleAssistant:
			assistant := schema.AssistantMessage(message.Content, nil)
			for _, call := range message.ToolCalls {
				assistant.ToolCalls = append(assistant.ToolCalls, schema.ToolCall{
					ID:   call.ID,
					Type: "function",
					Function: schema.FunctionCall{
						Name:      call.Name,
						Arguments: call.Arguments,
					},
				})
			}
			converted = append(converted, assistant)
		case RoleTool:
			converted = append(converted, schema.ToolMessage(message.Content, message.ToolCallID))
		default:
			return nil, NewError(400, CodeInvalidRequest, "The request contains an unsupported message role.", false)
		}
	}
	return converted, nil
}
