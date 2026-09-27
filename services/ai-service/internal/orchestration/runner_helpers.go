package orchestration

import (
	"context"
	"errors"
	"io"
	"strings"
	"sync"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

func generateWithAgent(ctx context.Context, chat model.ToolCallingChatModel, messages []*schema.Message, tools []tool.BaseTool, maxToolSteps int) (string, error) {
	agent, err := react.NewAgent(ctx, &react.AgentConfig{
		ToolCallingModel: chat,
		ToolsConfig:      compose.ToolsNodeConfig{Tools: tools},
		MaxStep:          maxToolSteps*2 + 2,
	})
	if err != nil {
		return "", err
	}
	message, err := agent.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	if message == nil {
		return "", nil
	}
	return message.Content, nil
}

func readStream(ctx context.Context, chat model.ToolCallingChatModel, messages []*schema.Message) (string, error) {
	reader, err := chat.Stream(ctx, messages)
	if err != nil {
		return "", err
	}
	var closeReader sync.Once
	closeSource := func() { closeReader.Do(reader.Close) }
	stopClose := context.AfterFunc(ctx, closeSource)
	defer stopClose()
	defer closeSource()
	var text strings.Builder
	for {
		chunk, recvErr := reader.Recv()
		if errors.Is(recvErr, io.EOF) {
			if err := ctx.Err(); err != nil {
				return text.String(), err
			}
			return text.String(), nil
		}
		if recvErr != nil {
			return text.String(), errors.Join(ctx.Err(), recvErr)
		}
		if chunk != nil {
			text.WriteString(chunk.Content)
		}
		if err := ctx.Err(); err != nil {
			return text.String(), err
		}
	}
}

func (r *Runner) extract(ctx context.Context, session ModelSession, messages []protocol.Message, state *meterState) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	converted, err := protocol.ToSchemaMessages(messages)
	if err != nil {
		return "", err
	}
	chat, err := session.StructuredModel(ctx)
	if err != nil {
		return "", err
	}
	message, err := newMeteringModel(chat, state).Generate(ctx, converted)
	if err != nil || message == nil {
		return "", err
	}
	return message.Content, nil
}

func (r *Runner) finish(cleanup *cleanupScope, request protocol.Request, reservationID string, calls []usage.CallUsage, tools []capability.ToolResult, artifacts []protocol.Artifact, text string, runErr error) (Result, error) {
	observation := usage.Aggregate(calls)
	if len(calls) == 0 {
		observation = usage.Classify(usage.CallUsage{})
	}
	reconciliation, err := r.finalize(cleanup, reservationID, observation)
	if err != nil {
		runErr = errors.Join(runErr, err)
	}
	serviceErr := publicError(request.RequestID, runErr)
	result := Result{
		Events:         buildEvents(request.RequestID, text, tools, artifacts, serviceErr),
		ReservationID:  reservationID,
		Reconciliation: reconciliation,
		Reserved:       true,
	}
	if serviceErr == nil {
		return result, nil
	}
	return result, serviceErr
}

func (r *Runner) finalize(cleanup *cleanupScope, reservationID string, observation usage.Observation) (usage.Reconciliation, error) {
	record, err := r.Usage.Finalize(cleanup.start(), reservationID, observation)
	return record, err
}

func (r *Runner) cleanupBudget() time.Duration {
	if r.Cleanup <= 0 || r.Cleanup > protocol.CleanupBudget {
		return protocol.CleanupBudget
	}
	return r.Cleanup
}

func modelMessages(prompts []string, messages []protocol.Message) ([]*schema.Message, error) {
	combined := make([]protocol.Message, 0, len(prompts)+len(messages))
	for _, prompt := range prompts {
		if strings.TrimSpace(prompt) == "" {
			continue
		}
		combined = append(combined, protocol.Message{Role: protocol.RoleSystem, Content: prompt})
	}
	combined = append(combined, messages...)
	return protocol.ToSchemaMessages(combined)
}

func toolNames(tools []capability.Tool) []string {
	names := make([]string, len(tools))
	for i := range tools {
		names[i] = tools[i].Name
	}
	return names
}

func selectTools(offered []capability.Tool, requested []string) ([]capability.Tool, error) {
	if len(requested) == 0 {
		return nil, nil
	}
	byName := make(map[string]capability.Tool, len(offered))
	for _, item := range offered {
		byName[item.Name] = item
	}
	selected := make([]capability.Tool, 0, len(requested))
	for _, name := range requested {
		item, ok := byName[name]
		if !ok {
			return nil, protocol.NewError(400, protocol.CodeInvalidRequest, "The requested tool is not available.", false)
		}
		selected = append(selected, item)
	}
	return selected, nil
}

func unauthorized(err error) *protocol.Error {
	var serviceErr *protocol.Error
	if errors.As(err, &serviceErr) {
		return serviceErr
	}
	return protocol.NewError(403, protocol.CodeUnauthorized, "The caller is not authorized for this capability.", false).WithCause(err)
}

func (t *toolTrace) startedCount() int {
	if t == nil {
		return 0
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.started
}

func canRetryProvider(attempt, attempts int, text string, emitted bool, trace *toolTrace, ctx context.Context, err error) bool {
	return text == "" && !emitted && trace.startedCount() == 0 && ctx.Err() == nil && isQuotaError(err) && attempt < attempts
}

func providerErrorClass(err error) string {
	var classified interface{ ProviderErrorClass() string }
	if errors.As(err, &classified) && classified != nil {
		return classified.ProviderErrorClass()
	}
	return ""
}

func markProviderFallback(session ModelSession, err error) {
	if outcome, ok := session.(interface{ MarkProviderOutcome(string, string) }); ok {
		outcome.MarkProviderOutcome("fallback", providerErrorClass(err))
	}
}
