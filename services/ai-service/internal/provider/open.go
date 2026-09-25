package provider

import (
	"context"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/components/model"
)

// Session is one configured provider conversation.
type Session interface {
	Transport() string
	ModelName() string
	ThinkingLevel() string
	KeyIndex() int
	AttemptLimit() int
	RotateOnQuota(failedIndex int) bool
	ChatModel(ctx context.Context) (model.ToolCallingChatModel, error)
	StructuredModel(ctx context.Context) (model.ToolCallingChatModel, error)
}

// Open builds the retained transport named by cfg.
func Open(ctx context.Context, cfg Config) (Session, error) {
	switch cfg.Transport {
	case protocol.TransportGateway, protocol.TransportOpenAICompatible:
		if cfg.APIKey == "" || cfg.Model == "" {
			return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The model transport is missing its API key or model.", false)
		}
		if cfg.Transport == protocol.TransportGateway && cfg.BaseURL == "" {
			return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The gateway transport is missing its endpoint.", false)
		}
		return newOpenAISession(ctx, cfg)
	case protocol.TransportGoogle:
		return newGoogleSession(cfg)
	default:
		return nil, protocol.NewError(400, protocol.CodeInvalidRequest, "The requested model transport is not supported.", false)
	}
}
