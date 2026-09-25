package phase0proof

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/cloudwego/eino-ext/components/model/gemini"
	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/schema"
	"google.golang.org/genai"
)

func TestEinoProviderAdaptersAgainstLocalStubs(t *testing.T) {
	var requests []struct {
		path string
		body map[string]any
	}
	var geminiRequest map[string]any
	var requestsMu sync.Mutex
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/v1beta/models/gemini-model:generateContent" {
			var body map[string]any
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				http.Error(writer, err.Error(), http.StatusBadRequest)
				return
			}
			requestsMu.Lock()
			geminiRequest = body
			requests = append(requests, struct {
				path string
				body map[string]any
			}{request.URL.Path, body})
			requestsMu.Unlock()
			writer.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(writer, `{"candidates":[{"content":{"role":"model","parts":[{"text":"gemini response"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":2,"totalTokenCount":6}}`)
			return
		}
		if request.URL.Path == "/v1beta/models/gemini-error:generateContent" {
			http.Error(writer, `{"error":{"code":429,"message":"stub quota"}}`, http.StatusTooManyRequests)
			return
		}
		if request.URL.Path == "/v1beta/models/gemini-tool-model:generateContent" {
			writer.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(writer, `{"candidates":[{"content":{"role":"model","parts":[{"functionCall":{"name":"lookup_equipment","args":{"equipment_id":42}}}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":7,"candidatesTokenCount":3,"totalTokenCount":10}}`)
			return
		}

		if !strings.HasSuffix(request.URL.Path, "/chat/completions") {
			http.Error(writer, "unexpected endpoint", http.StatusBadRequest)
			return
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			http.Error(writer, err.Error(), http.StatusBadRequest)
			return
		}
		requestsMu.Lock()
		requests = append(requests, struct {
			path string
			body map[string]any
		}{request.URL.Path, body})
		requestsMu.Unlock()
		if body["model"] == "error-model" {
			http.Error(writer, `{"error":{"code":429,"message":"stub quota"}}`, http.StatusTooManyRequests)
			return
		}
		if body["stream"] != true {
			writer.Header().Set("Content-Type", "application/json")
			_, _ = fmt.Fprint(writer, `{"id":"tool-response","choices":[{"index":0,"message":{"role":"assistant","content":"","tool_calls":[{"id":"call-1","type":"function","function":{"name":"lookup_equipment","arguments":"{\"equipment_id\":42}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":7,"completion_tokens":3,"total_tokens":10}}`)
			return
		}
		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprintln(writer, `data: {"choices":[{"delta":{"content":"openai "},"finish_reason":null}]}`)
		_, _ = fmt.Fprintln(writer, `data: {"choices":[{"delta":{"content":"response"},"finish_reason":null}]}`)
		_, _ = fmt.Fprintln(writer, `data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":2,"total_tokens":6}}`)
		_, _ = fmt.Fprintln(writer, "data: [DONE]")
	}))
	defer server.Close()

	ctx := context.Background()
	maxTokens := 32
	temperature := float32(0.2)
	for _, transport := range []struct {
		name    string
		baseURL string
		model   string
	}{
		{name: "gateway", baseURL: server.URL + "/gateway/v1", model: "google/gemini-stub"},
		{name: "openai-compatible", baseURL: server.URL + "/openai/v1", model: "stub-model"},
	} {
		t.Run(transport.name, func(t *testing.T) {
			chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
				APIKey:      "stub-secret",
				BaseURL:     transport.baseURL,
				Model:       transport.model,
				HTTPClient:  server.Client(),
				MaxTokens:   &maxTokens,
				Temperature: &temperature,
			})
			if err != nil {
				t.Fatal(err)
			}
			stream, err := chatModel.Stream(ctx, []*schema.Message{schema.UserMessage("hello")})
			if err != nil {
				t.Fatal(err)
			}
			var content strings.Builder
			var lastMessage *schema.Message
			for {
				message, recvErr := stream.Recv()
				if errors.Is(recvErr, io.EOF) {
					break
				}
				if recvErr != nil {
					t.Fatal(recvErr)
				}
				lastMessage = message
				content.WriteString(message.Content)
			}
			stream.Close()
			if content.String() != "openai response" {
				t.Fatalf("%s content = %q", transport.name, content.String())
			}
			if lastMessage == nil || lastMessage.ResponseMeta == nil || lastMessage.ResponseMeta.FinishReason != "stop" || lastMessage.ResponseMeta.Usage == nil {
				t.Fatalf("%s stream finish/usage = %+v", transport.name, lastMessage)
			}
			if usage := lastMessage.ResponseMeta.Usage; usage.PromptTokens != 4 || usage.CompletionTokens != 2 || usage.TotalTokens != 6 {
				t.Fatalf("%s stream usage = %+v", transport.name, usage)
			}
		})
	}

	geminiClient, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:      "stub-secret",
		Backend:     genai.BackendGeminiAPI,
		HTTPClient:  server.Client(),
		HTTPOptions: genai.HTTPOptions{BaseURL: server.URL + "/"},
	})
	if err != nil {
		t.Fatal(err)
	}
	geminiModel, err := gemini.NewChatModel(ctx, &gemini.Config{
		Client:      geminiClient,
		Model:       "gemini-model",
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		t.Fatal(err)
	}
	message, err := geminiModel.Generate(ctx, []*schema.Message{schema.UserMessage("hello")})
	if err != nil {
		t.Fatal(err)
	}
	if message.Content != "gemini response" {
		t.Fatalf("google content = %q", message.Content)
	}
	if message.ResponseMeta == nil || message.ResponseMeta.Usage == nil {
		t.Fatalf("google usage metadata is missing: %+v", message.ResponseMeta)
	}
	if usage := message.ResponseMeta.Usage; usage.PromptTokens != 4 || usage.CompletionTokens != 2 || usage.TotalTokens != 6 {
		t.Fatalf("google usage metadata = %+v", usage)
	}

	requestsMu.Lock()
	if len(requests) != 3 {
		t.Fatalf("stub request count = %d, want 3", len(requests))
	}
	if requests[0].path != "/gateway/v1/chat/completions" || requests[1].path != "/openai/v1/chat/completions" {
		t.Fatalf("OpenAI adapter paths = %q, %q", requests[0].path, requests[1].path)
	}
	for _, request := range requests[:2] {
		maxTokensValue, maxTokensOK := request.body["max_tokens"].(float64)
		temperatureValue, temperatureOK := request.body["temperature"].(float64)
		if !maxTokensOK || !temperatureOK || maxTokensValue != float64(maxTokens) || math.Abs(temperatureValue-float64(temperature)) > 0.000001 {
			t.Fatalf("provider options missing from %s request: %#v", request.path, request.body)
		}
	}
	generationConfig, ok := geminiRequest["generationConfig"].(map[string]any)
	if !ok {
		t.Fatalf("Gemini generation config missing: %#v", geminiRequest)
	}
	maxOutputTokensValue, maxOutputTokensOK := generationConfig["maxOutputTokens"].(float64)
	temperatureValue, temperatureOK := generationConfig["temperature"].(float64)
	if !maxOutputTokensOK || !temperatureOK || maxOutputTokensValue != float64(maxTokens) || math.Abs(temperatureValue-float64(temperature)) > 0.000001 {
		t.Fatalf("Gemini options missing: %#v", generationConfig)
	}
	requestsMu.Unlock()

	toolInfo := []*schema.ToolInfo{{
		Name: "lookup_equipment",
		Desc: "Look up one equipment record.",
		ParamsOneOf: schema.NewParamsOneOfByParams(map[string]*schema.ParameterInfo{
			"equipment_id": {Type: "integer", Desc: "equipment identifier"},
		}),
	}}
	for _, transport := range []struct {
		name    string
		baseURL string
		model   string
	}{
		{name: "gateway", baseURL: server.URL + "/gateway/v1", model: "google/gemini-stub"},
		{name: "openai-compatible", baseURL: server.URL + "/openai/v1", model: "stub-model"},
	} {
		t.Run(transport.name+" tool and usage", func(t *testing.T) {
			chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
				APIKey:     "stub-secret",
				BaseURL:    transport.baseURL,
				Model:      transport.model,
				HTTPClient: server.Client(),
			})
			if err != nil {
				t.Fatal(err)
			}
			if err := chatModel.BindTools(toolInfo); err != nil {
				t.Fatal(err)
			}
			message, err := chatModel.Generate(ctx, []*schema.Message{schema.UserMessage("use lookup tool")})
			if err != nil {
				t.Fatal(err)
			}
			assertToolResponse(t, message, "tool_calls", 7, 3, 10)
		})
	}

	toolGemini, err := gemini.NewChatModel(ctx, &gemini.Config{
		Client:      geminiClient,
		Model:       "gemini-tool-model",
		MaxTokens:   &maxTokens,
		Temperature: &temperature,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := toolGemini.BindTools(toolInfo); err != nil {
		t.Fatal(err)
	}
	toolMessage, err := toolGemini.Generate(ctx, []*schema.Message{schema.UserMessage("use lookup tool")})
	if err != nil {
		t.Fatal(err)
	}
	assertToolResponse(t, toolMessage, "STOP", 7, 3, 10)

	for _, transport := range []struct {
		name    string
		baseURL string
		model   string
	}{
		{name: "gateway", baseURL: server.URL + "/gateway/v1", model: "error-model"},
		{name: "openai-compatible", baseURL: server.URL + "/openai/v1", model: "error-model"},
	} {
		t.Run(transport.name+" HTTP error", func(t *testing.T) {
			chatModel, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
				APIKey:     "stub-secret",
				BaseURL:    transport.baseURL,
				Model:      transport.model,
				HTTPClient: server.Client(),
			})
			if err != nil {
				t.Fatal(err)
			}
			if _, err := chatModel.Generate(ctx, []*schema.Message{schema.UserMessage("error")}); err == nil {
				t.Fatal("HTTP error was swallowed")
			}
		})
	}

	errorGeminiClient, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:      "stub-secret",
		Backend:     genai.BackendGeminiAPI,
		HTTPClient:  server.Client(),
		HTTPOptions: genai.HTTPOptions{BaseURL: server.URL + "/"},
	})
	if err != nil {
		t.Fatal(err)
	}
	errorGemini, err := gemini.NewChatModel(ctx, &gemini.Config{Client: errorGeminiClient, Model: "gemini-error"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := errorGemini.Generate(ctx, []*schema.Message{schema.UserMessage("error")}); err == nil {
		t.Fatal("Gemini HTTP error was swallowed")
	}
}

func assertToolResponse(t *testing.T, message *schema.Message, finishReason string, promptTokens, completionTokens, totalTokens int) {
	t.Helper()
	if len(message.ToolCalls) != 1 || message.ToolCalls[0].Function.Name != "lookup_equipment" {
		t.Fatalf("tool response = %+v", message)
	}
	if message.ResponseMeta == nil || message.ResponseMeta.FinishReason != finishReason || message.ResponseMeta.Usage == nil {
		t.Fatalf("tool finish/usage = %+v", message.ResponseMeta)
	}
	usage := message.ResponseMeta.Usage
	if usage.PromptTokens != promptTokens || usage.CompletionTokens != completionTokens || usage.TotalTokens != totalTokens {
		t.Fatalf("tool usage = %+v", usage)
	}
}
