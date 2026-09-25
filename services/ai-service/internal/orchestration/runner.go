package orchestration

import (
	"context"
	"errors"
	"io"
	"strings"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/flow/agent/react"
	"github.com/cloudwego/eino/schema"
)

// Runner executes one capability through Eino.
type Runner struct {
	Registry *registry.Registry
	Usage    usage.Lifecycle
	Limits   protocol.Limits
	Cleanup  time.Duration
	Open     func(context.Context, protocol.Request) (ModelSession, error)
}

// Result is the normalized outcome of one run.
type Result struct {
	Events         []protocol.Event
	ReservationID  string
	Reconciliation usage.Reconciliation
	Reserved       bool
}

// Run executes the Eino tool loop and finalizes observed usage once.
func (r *Runner) Run(ctx context.Context, request protocol.Request) (Result, error) {
	return r.execute(ctx, request, false)
}

// Stream uses the provider stream when the request does not call tools.
// A request with tools still uses the Eino tool loop, then returns the same events.
func (r *Runner) Stream(ctx context.Context, request protocol.Request) (Result, error) {
	return r.execute(ctx, request, true)
}

func (r *Runner) execute(ctx context.Context, request protocol.Request, stream bool) (Result, error) {
	limits := r.Limits.Resolved()
	if err := protocol.Validate(request, limits); err != nil {
		return Result{}, err
	}
	if r.Registry == nil || r.Usage == nil || r.Open == nil {
		return Result{}, protocol.NewError(500, protocol.CodeInvalidRequest, "The service runtime is incomplete.", false).WithRequest(request.RequestID)
	}
	item, err := r.Registry.Lookup(request.AppID, request.CapabilityID, request.CapabilityVersion)
	if err != nil {
		return Result{}, publicError(request.RequestID, err)
	}
	if err := item.Authorize(ctx, request); err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return Result{}, publicError(request.RequestID, err)
		}
		return Result{}, unauthorized(err).WithRequest(request.RequestID)
	}
	prepared, err := item.Prepare(ctx, request)
	if err != nil {
		return Result{}, publicError(request.RequestID, err)
	}
	if text := strings.TrimSpace(prepared.Clarification); text != "" {
		return Result{Events: clarificationEvents(request.RequestID, text)}, nil
	}
	requestedTools := request.RequestedTools
	if prepared.RestrictTools {
		requestedTools = toolNames(prepared.Tools)
	}
	selected, err := selectTools(prepared.Tools, requestedTools)
	if err != nil {
		return Result{}, publicError(request.RequestID, err)
	}
	messages, err := modelMessages(item.Descriptor().PromptFragments, prepared.Messages)
	if err != nil {
		return Result{}, publicError(request.RequestID, err)
	}
	reservation, err := r.Usage.Reserve(ctx, usage.ReserveRequest{
		RequestID:         request.RequestID,
		AppID:             request.AppID,
		CapabilityID:      request.CapabilityID,
		CapabilityVersion: request.CapabilityVersion,
		TTL:               protocol.ReservationTTL,
	})
	if err != nil {
		return Result{}, publicError(request.RequestID, err)
	}
	session, err := r.Open(ctx, request)
	if err != nil {
		return r.finish(ctx, request, reservation.ID, nil, nil, nil, "", err)
	}

	bound, trace, err := bindTools(selected, toolLimits{
		maxSteps:  limits.MaxToolSteps,
		maxInput:  limits.MaxToolInputChars,
		maxOutput: limits.MaxToolOutput,
	})
	if err != nil {
		return r.finish(ctx, request, reservation.ID, nil, nil, nil, "", err)
	}
	state := &meterState{}
	text, runErr := r.modelLoop(ctx, session, messages, bound, trace, limits, state, stream && len(bound) == 0)
	calls, _ := state.snapshot()
	var artifacts []protocol.Artifact
	if runErr == nil {
		follow, hookErr := item.AfterPrimary(ctx, request, capability.PrimaryOutput{
			Text:        text,
			ToolResults: trace.snapshot(),
		})
		if hookErr != nil {
			runErr = hookErr
		} else {
			artifacts = follow.Artifacts
			if len(follow.Extraction) > 0 {
				if extractErr := r.extract(ctx, session, follow.Extraction, state); extractErr != nil {
					runErr = extractErr
				}
				calls, _ = state.snapshot()
			}
		}
	}
	return r.finish(ctx, request, reservation.ID, calls, trace.snapshot(), artifacts, text, runErr)
}

func (r *Runner) modelLoop(ctx context.Context, session ModelSession, messages []*schema.Message, tools []tool.BaseTool, trace *toolTrace, limits protocol.Limits, state *meterState, directStream bool) (string, error) {
	attempts := session.AttemptLimit()
	if attempts < 1 {
		attempts = 1
	}
	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		chat, keyIndex, err := session.ChatModel(ctx)
		if err != nil {
			return "", err
		}
		metered := newMeteringModel(chat, state)
		var text string
		if directStream {
			text, err = readStream(ctx, metered, messages)
		} else {
			text, err = generateWithAgent(ctx, metered, messages, tools, limits.MaxToolSteps)
		}
		if err == nil {
			return text, nil
		}
		lastErr = err
		_, emitted := state.snapshot()
		retry := text == "" && !emitted && trace.startedCount() == 0 && ctx.Err() == nil && isQuotaError(err) && attempt < attempts && session.RotateOnQuota(keyIndex)
		if !retry {
			return text, err
		}
	}
	return "", lastErr
}

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
	defer reader.Close()
	var text strings.Builder
	for {
		chunk, recvErr := reader.Recv()
		if errors.Is(recvErr, io.EOF) {
			return text.String(), nil
		}
		if recvErr != nil {
			return text.String(), recvErr
		}
		if chunk != nil {
			text.WriteString(chunk.Content)
		}
		if err := ctx.Err(); err != nil {
			return text.String(), err
		}
	}
}

func (r *Runner) extract(ctx context.Context, session ModelSession, messages []protocol.Message, state *meterState) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	converted, err := protocol.ToSchemaMessages(messages)
	if err != nil {
		return err
	}
	chat, err := session.StructuredModel(ctx)
	if err != nil {
		return err
	}
	_, err = newMeteringModel(chat, state).Generate(ctx, converted)
	return err
}

func (r *Runner) finish(ctx context.Context, request protocol.Request, reservationID string, calls []usage.CallUsage, tools []capability.ToolResult, artifacts []protocol.Artifact, text string, runErr error) (Result, error) {
	observation := usage.Aggregate(calls)
	if len(calls) == 0 {
		observation = usage.Classify(usage.CallUsage{})
	}
	reconciliation, err := r.finalize(ctx, reservationID, calls, observation)
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

func (r *Runner) finalize(parent context.Context, reservationID string, calls []usage.CallUsage, observation usage.Observation) (usage.Reconciliation, error) {
	budget := r.Cleanup
	if budget <= 0 {
		budget = protocol.CleanupBudget
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(parent), budget)
	defer cancel()
	var observeErr error
	for _, call := range calls {
		if err := r.Usage.Observe(ctx, reservationID, call); err != nil {
			observeErr = errors.Join(observeErr, err)
		}
	}
	record, err := r.Usage.Finalize(ctx, reservationID, observation)
	return record, errors.Join(observeErr, err)
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
