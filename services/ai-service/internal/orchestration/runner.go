package orchestration

import (
	"context"
	"errors"
	"strings"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
	"example.com/shared-ai-service/internal/usage"
	"github.com/cloudwego/eino/components/tool"
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
	Provider       protocol.ProviderMetadata
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
	if prepared.Cleanup != nil {
		defer prepared.Cleanup()
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
		UserID:            prepared.QuotaUserID,
		TenantID:          prepared.QuotaTenantID,
		Role:              prepared.QuotaRole,
		Caller:            prepared.QuotaCaller,
	})
	if err != nil {
		return Result{}, publicError(request.RequestID, err)
	}
	cleanup := newCleanupScope(ctx, r.cleanupBudget())
	defer cleanup.Close()
	session, err := r.Open(ctx, request)
	if err != nil {
		return r.finish(cleanup, request, reservation.ID, nil, nil, nil, "", err)
	}

	bound, trace, err := bindTools(selected, toolLimits{
		maxSteps:  limits.MaxToolSteps,
		maxInput:  limits.MaxToolInputChars,
		maxOutput: limits.MaxToolOutput,
	})
	if err != nil {
		return r.finish(cleanup, request, reservation.ID, nil, nil, nil, "", err)
	}
	state := &meterState{start: func(callCtx context.Context) error {
		return r.Usage.StartCall(callCtx, reservation.ID)
	}, observe: func(callCtx context.Context, call usage.CallUsage) error {
		ctx, cancel := cleanup.operation(callCtx)
		defer cancel()
		return r.Usage.Observe(ctx, reservation.ID, call)
	}}
	text, runErr := r.modelLoop(ctx, session, messages, bound, trace, limits, state, stream && len(bound) == 0)
	var artifacts []protocol.Artifact
	if runErr == nil {
		follow, hookErr := item.AfterPrimary(ctx, request, capability.PrimaryOutput{
			Text:        text,
			ToolResults: trace.snapshot(),
		})
		if hookErr != nil {
			runErr = hookErr
		} else {
			artifacts = append([]protocol.Artifact(nil), follow.Artifacts...)
			if len(follow.Extraction) > 0 {
				extracted, extractErr := r.extract(ctx, session, follow.Extraction, state)
				if extractErr != nil {
					runErr = extractErr
				} else if follow.MapExtraction != nil {
					mapped, mapErr := follow.MapExtraction(extracted)
					if mapErr == nil {
						artifacts = append(artifacts, mapped...)
					}
				}
			}
		}
	}
	if err := state.waitStreams(cleanup.start()); err != nil {
		runErr = errors.Join(runErr, err)
	}
	if ctx.Err() != nil {
		runErr = errors.Join(runErr, state.streamError())
	}
	calls, _ := state.snapshot()
	if outcome, ok := session.(interface{ MarkProviderOutcome(string, string) }); ok {
		if runErr != nil {
			class := providerErrorClass(runErr)
			if class == "" {
				class = "provider_failure"
			}
			outcome.MarkProviderOutcome("failure", class)
		} else {
			outcome.MarkProviderOutcome("success", "")
		}
	}
	result, finishErr := r.finish(cleanup, request, reservation.ID, calls, trace.snapshot(), artifacts, text, runErr)
	if metadataSource, ok := session.(interface {
		Metadata() protocol.ProviderMetadata
	}); ok {
		metadata := metadataSource.Metadata()
		result.Provider = metadata
		for i := range result.Events {
			if result.Events[i].Type == protocol.EventStart || result.Events[i].Type == protocol.EventDone {
				result.Events[i].Provider = metadata.Provider
				result.Events[i].Model = metadata.Model
			}
		}
	}
	return result, finishErr
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
			lastErr = err
			_, emitted := state.snapshot()
			if !canRetryProvider(attempt, attempts, "", emitted, trace, ctx, err) {
				return "", err
			}
			markProviderFallback(session, err)
			if !session.RotateOnQuota(keyIndex) {
				return "", err
			}
			continue
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
		retryEligible := canRetryProvider(attempt, attempts, text, emitted, trace, ctx, err)
		if !retryEligible {
			return text, err
		}
		markProviderFallback(session, err)
		if !session.RotateOnQuota(keyIndex) {
			return text, err
		}
	}
	return "", lastErr
}
