package provider

import (
	"context"
	"net/http"
	"sync"
	"time"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino-ext/components/model/gemini"
	"github.com/cloudwego/eino/components/model"
	"github.com/eino-contrib/jsonschema"
	"google.golang.org/genai"
)

type googleSession struct {
	mu          sync.Mutex
	modelName   string
	thinking    string
	maxTokens   int
	temperature *float32
	baseURL     string
	httpClient  *http.Client
	pool        *keyPool
	now         func() time.Time
	cache       map[cacheKey]model.ToolCallingChatModel
}

type cacheKey struct {
	index      int
	structured bool
}

func newGoogleSession(cfg Config) (*googleSession, error) {
	if len(cfg.APIKeys) == 0 {
		return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The google transport is missing its API key.", false)
	}
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	maxTokens := cfg.MaxTokens
	if maxTokens <= 0 {
		maxTokens = protocol.DefaultMaxOutputTokens
	}
	modelName := normalizeGeminiModel(cfg.Model)
	if modelName == "" {
		return nil, protocol.NewError(500, protocol.CodeInvalidRequest, "The google transport is missing its model.", false)
	}
	return &googleSession{
		modelName:   modelName,
		thinking:    ThinkingLevel(modelName),
		maxTokens:   maxTokens,
		temperature: cfg.Temperature,
		baseURL:     cfg.BaseURL,
		httpClient:  cfg.HTTPClient,
		pool:        newKeyPool(cfg.APIKeys),
		now:         now,
		cache:       make(map[cacheKey]model.ToolCallingChatModel),
	}, nil
}

func (s *googleSession) Transport() string { return protocol.TransportGoogle }

func (s *googleSession) ModelName() string { return s.modelName }

func (s *googleSession) ThinkingLevel() string { return s.thinking }

func (s *googleSession) KeyIndex() int {
	index, _, ok := s.pool.current(s.now())
	if !ok {
		return 0
	}
	return index
}

func (s *googleSession) AttemptLimit() int {
	if size := s.pool.size(); size > 0 {
		return size
	}
	return 1
}

func (s *googleSession) RotateOnQuota(failedIndex int) bool {
	return s.pool.rotate(s.now(), failedIndex)
}

func (s *googleSession) ChatModel(ctx context.Context) (model.ToolCallingChatModel, int, error) {
	return s.model(ctx, false)
}

func (s *googleSession) StructuredModel(ctx context.Context) (model.ToolCallingChatModel, error) {
	chat, _, err := s.model(ctx, true)
	return chat, err
}

func (s *googleSession) model(ctx context.Context, structured bool) (model.ToolCallingChatModel, int, error) {
	index, key, ok := s.pool.current(s.now())
	if !ok {
		return nil, 0, protocol.NewError(503, protocol.CodeProviderQuota, "The model provider is temporarily unavailable.", true)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	cachedKey := cacheKey{index: index, structured: structured}
	if cached := s.cache[cachedKey]; cached != nil {
		return cached, index, nil
	}
	clientCfg := &genai.ClientConfig{
		APIKey:     key,
		Backend:    genai.BackendGeminiAPI,
		HTTPClient: s.httpClient,
	}
	if s.baseURL != "" {
		clientCfg.HTTPOptions = genai.HTTPOptions{BaseURL: s.baseURL}
	}
	client, err := genai.NewClient(ctx, clientCfg)
	if err != nil {
		return nil, 0, protocol.NewError(500, protocol.CodeProviderFailure, "The model transport could not be configured.", false).WithCause(err)
	}
	geminiCfg := &gemini.Config{
		Client:      client,
		Model:       s.modelName,
		MaxTokens:   &s.maxTokens,
		Temperature: s.temperature,
	}
	if s.thinking == "medium" {
		geminiCfg.ThinkingConfig = &genai.ThinkingConfig{ThinkingLevel: genai.ThinkingLevelMedium}
	}
	if structured {
		geminiCfg.ResponseJSONSchema = &jsonschema.Schema{Type: "object"}
	}
	chat, err := gemini.NewChatModel(ctx, geminiCfg)
	if err != nil {
		return nil, 0, protocol.NewError(500, protocol.CodeProviderFailure, "The model transport could not be configured.", false).WithCause(err)
	}
	s.cache[cachedKey] = chat
	return chat, index, nil
}
