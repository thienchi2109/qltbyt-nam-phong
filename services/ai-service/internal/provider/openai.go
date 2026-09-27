package provider

import (
	"context"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/components/model"
)

type openAISession struct {
	transport  string
	modelName  string
	pair       ProviderModelPair
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
	pair := ProviderModelPair{Provider: cfg.Transport, Model: cfg.Model, Config: cfg, Capabilities: DefaultChatProfile}
	return &openAISession{
		transport:  cfg.Transport,
		modelName:  cfg.Model,
		thinking:   ThinkingLevel(cfg.Model),
		pair:       pair,
		chat:       newAdapterModel(chat, pair),
		structured: newAdapterModel(structured, pair),
	}, nil
}

func newOpenAIModel(ctx context.Context, cfg Config, structured bool) (model.ToolCallingChatModel, error) {
	maxTokens := cfg.MaxTokens
	if maxTokens <= 0 {
		maxTokens = protocol.DefaultMaxOutputTokens
	}
	baseURL := cfg.BaseURL
	if strings.HasSuffix(strings.TrimRight(baseURL, "/"), "/chat/completions") {
		baseURL = strings.TrimSuffix(strings.TrimRight(baseURL, "/"), "/chat/completions")
	}
	modelCfg := &openai.ChatModelConfig{
		APIKey:      cfg.APIKey,
		BaseURL:     baseURL,
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

func (s *openAISession) Pair() ProviderModelPair { return s.pair }

func (s *openAISession) ModelName() string { return s.modelName }

func (s *openAISession) ThinkingLevel() string { return s.thinking }

func (s *openAISession) KeyIndex() int { return 0 }

func (s *openAISession) AttemptLimit() int { return 1 }

func (s *openAISession) RotateOnQuota(int) bool { return false }

func (s *openAISession) ChatModel(context.Context) (model.ToolCallingChatModel, int, error) {
	return s.chat, 0, nil
}

func (s *openAISession) StructuredModel(context.Context) (model.ToolCallingChatModel, error) {
	return s.structured, nil
}
