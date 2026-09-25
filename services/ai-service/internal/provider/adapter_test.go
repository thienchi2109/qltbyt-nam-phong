package provider

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/schema"
)

func TestRetainedTransportsAgainstLocalStubs(t *testing.T) {
	var mu sync.Mutex
	var requests []recordedRequest
	var geminiBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if strings.Contains(request.URL.Path, ":generateContent") {
			var body map[string]any
			if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
				http.Error(writer, err.Error(), http.StatusBadRequest)
				return
			}
			mu.Lock()
			geminiBody = body
			requests = append(requests, recordedRequest{path: request.URL.Path, body: body})
			mu.Unlock()
			if strings.Contains(request.URL.Path, "gemini-error") {
				http.Error(writer, `{"error":{"code":429,"message":"stub quota"}}`, http.StatusTooManyRequests)
				return
			}
			writer.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(writer, `{"candidates":[{"content":{"role":"model","parts":[{"text":"gemini response"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":2,"totalTokenCount":6}}`)
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
		mu.Lock()
		requests = append(requests, recordedRequest{path: request.URL.Path, body: body})
		mu.Unlock()
		if body["model"] == "error-model" {
			http.Error(writer, `{"error":{"code":429,"message":"stub quota"}}`, http.StatusTooManyRequests)
			return
		}
		if body["stream"] != true {
			writer.Header().Set("Content-Type", "application/json")
			_, _ = io.WriteString(writer, `{"choices":[{"message":{"role":"assistant","content":"{\"status\":\"ready\"}"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}`)
			return
		}
		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = io.WriteString(writer, "data: {\"choices\":[{\"delta\":{\"content\":\"openai \"},\"finish_reason\":null}]}\n\n")
		_, _ = io.WriteString(writer, "data: {\"choices\":[{\"delta\":{\"content\":\"response\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":4,\"completion_tokens\":2,\"total_tokens\":6}}\n\n")
		_, _ = io.WriteString(writer, "data: [DONE]\n\n")
	}))
	defer server.Close()

	maxTokens := 32
	temperature := float32(0.2)
	ctx := context.Background()
	for _, transport := range []Config{
		{Transport: protocol.TransportGateway, Model: "google/gemini-stub", APIKey: "stub-secret", BaseURL: server.URL + "/gateway/v1", MaxTokens: maxTokens, Temperature: &temperature, HTTPClient: server.Client()},
		{Transport: protocol.TransportOpenAICompatible, Model: "stub-model", APIKey: "stub-secret", BaseURL: server.URL + "/openai/v1", MaxTokens: maxTokens, Temperature: &temperature, HTTPClient: server.Client()},
	} {
		t.Run(transport.Transport, func(t *testing.T) {
			session, err := Open(ctx, transport)
			if err != nil {
				t.Fatal(err)
			}
			if transport.Transport == protocol.TransportGateway && session.ThinkingLevel() != "medium" {
				t.Fatalf("thinking = %q", session.ThinkingLevel())
			}
			if transport.Transport == protocol.TransportOpenAICompatible && session.ThinkingLevel() != "" {
				t.Fatalf("non-gemini thinking = %q", session.ThinkingLevel())
			}
			chat, err := session.ChatModel(ctx)
			if err != nil {
				t.Fatal(err)
			}
			stream, err := chat.Stream(ctx, []*schema.Message{schema.UserMessage("hello")})
			if err != nil {
				t.Fatal(err)
			}
			var content strings.Builder
			for {
				message, recvErr := stream.Recv()
				if errors.Is(recvErr, io.EOF) {
					break
				}
				if recvErr != nil {
					t.Fatal(recvErr)
				}
				content.WriteString(message.Content)
			}
			stream.Close()
			if content.String() != "openai response" {
				t.Fatalf("content = %q", content.String())
			}
			structured, err := session.StructuredModel(ctx)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := structured.Generate(ctx, []*schema.Message{schema.UserMessage("extract")}); err != nil {
				t.Fatal(err)
			}
		})
	}

	googleCfg := Config{
		Transport:   protocol.TransportGoogle,
		Model:       "gemini-3.1-flash-lite-preview",
		APIKeys:     []string{"key-a"},
		BaseURL:     server.URL + "/",
		MaxTokens:   maxTokens,
		Temperature: &temperature,
		HTTPClient:  server.Client(),
	}
	googleSession, err := Open(ctx, googleCfg)
	if err != nil {
		t.Fatal(err)
	}
	if googleSession.ThinkingLevel() != "medium" || googleSession.AttemptLimit() != 1 {
		t.Fatalf("google session = %s attempts %d", googleSession.ThinkingLevel(), googleSession.AttemptLimit())
	}
	chat, err := googleSession.ChatModel(ctx)
	if err != nil {
		t.Fatal(err)
	}
	message, err := chat.Generate(ctx, []*schema.Message{schema.UserMessage("hello")})
	if err != nil {
		t.Fatal(err)
	}
	if message.Content != "gemini response" || message.ResponseMeta == nil || message.ResponseMeta.Usage == nil || message.ResponseMeta.Usage.TotalTokens != 6 {
		t.Fatalf("gemini message = %+v", message)
	}

	mu.Lock()
	defer mu.Unlock()
	if len(requests) < 3 {
		t.Fatalf("requests = %d", len(requests))
	}
	sawFormat := false
	for _, request := range requests {
		if request.body["model"] == "stub-model" || request.body["model"] == "google/gemini-stub" {
			if format, ok := request.body["response_format"].(map[string]any); ok && format["type"] == "json_object" {
				sawFormat = true
			}
			if _, stream := request.body["stream"]; stream {
				assertFloat(t, request.body["max_tokens"], float64(maxTokens))
				assertFloat(t, request.body["temperature"], float64(temperature))
			}
		}
	}
	if !sawFormat {
		t.Fatal("structured extraction did not set response_format")
	}
	generation, ok := geminiBody["generationConfig"].(map[string]any)
	if !ok {
		t.Fatalf("generation config missing: %#v", geminiBody)
	}
	assertFloat(t, generation["maxOutputTokens"], float64(maxTokens))
	assertFloat(t, generation["temperature"], float64(temperature))
	thinking, _ := generation["thinkingConfig"].(map[string]any)
	if thinking["thinkingLevel"] != "MEDIUM" {
		t.Fatalf("thinking config = %#v", generation)
	}
}

type recordedRequest struct {
	path string
	body map[string]any
}

func assertFloat(t *testing.T, value any, want float64) {
	t.Helper()
	number, ok := value.(float64)
	if !ok || math.Abs(number-want) > 0.000001 {
		t.Fatalf("value = %#v, want %v", value, want)
	}
}
