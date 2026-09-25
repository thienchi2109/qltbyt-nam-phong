package provider

import (
	"context"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
)

type openAISession struct {
	transport  string
	modelName  string
	thinking   string
	chat       model.ToolCallingChatModel
	structured model.ToolCallingChatModel
}

func newOpenAISession(ctx context.Context, cfg Config) (*openAISession, error) {
	chat, err := newOpenAIModel(ctx, cfg, false)
	if err != nil {
		return nil, err
	}
	structured, err := newOpenAIModel(ctx, cfg, true)
	if err != nil {
		return nil, err
	}
	return &openAISession{
		transport:  cfg.Transport,
		modelName:  cfg.Model,
		thinking:   ThinkingLevel(cfg.Model),
		chat:       chat,
		structured: structured,
	}, nil
}

func newOpenAIModel(ctx context.Context, cfg Config, structured bool) (model.ToolCallingChatModel, error) {
	maxTokens := cfg.MaxTokens
	if maxTokens <= 0 {
		maxTokens = protocol.DefaultMaxOutputTokens
	}
	modelCfg := &openai.ChatModelConfig{
		APIKey:      cfg.APIKey,
		BaseURL:     cfg.BaseURL,
		Model:       cfg.Model,
		HTTPClient:  cfg.HTTPClient,
		MaxTokens:   &maxTokens,
		Temperature: cfg.Temperature,
	}
	if structured {
		modelCfg.ResponseFormat = &openai.ChatCompletionResponseFormat{
			Type: openai.ChatCompletionResponseFormatTypeJSONObject,
		}
	}
	chat, err := openai.NewChatModel(ctx, modelCfg)
	if err != nil {
		return nil, protocol.NewError(500, protocol.CodeProviderFailure, "The model transport could not be configured.", false).WithCause(err)
	}
	return chat, nil
}

func (s *openAISession) Transport() string { return s.transport }

func (s *openAISession) ModelName() string { return s.modelName }

func (s *openAISession) ThinkingLevel() string { return s.thinking }

func (s *openAISession) KeyIndex() int { return 0 }

func (s *openAISession) AttemptLimit() int { return 1 }

func (s *openAISession) RotateOnQuota(int) bool { return false }

func (s *openAISession) ChatModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.chat, nil
}

func (s *openAISession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.structured, nil
}
