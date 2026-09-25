package qltbyt

import (
	"context"
	"regexp"
	"strings"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
)

var writeIntentPattern = regexp.MustCompile(`(?i)(create|update|delete)`)
var safeToolPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_]{0,80}$`)

func validateToolNames(names []string) error {
	seen := make(map[string]struct{}, len(names))
	for _, name := range names {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		label := safeToolLabel(name)
		if writeIntentPattern.MatchString(name) {
			return protocol.NewError(400, protocol.CodeInvalidRequest, "Write-intent tool names are blocked: "+label, false)
		}
		if !knownTool(name) {
			return protocol.NewError(400, protocol.CodeInvalidRequest, "Unknown tool requested: "+label, false)
		}
		if name == ToolSystemDiagnostics {
			return protocol.NewError(400, protocol.CodeInvalidRequest, "Tool is not allowed in v1: systemDiagnostics", false)
		}
	}
	return nil
}

func knownTool(name string) bool {
	if name == QueryToolName || name == ToolSystemDiagnostics || name == ToolRepairRequestDraft || name == ToolTroubleshootingDraft {
		return true
	}
	_, ok := catalogByName(name)
	return ok
}

func safeToolLabel(name string) string {
	if safeToolPattern.MatchString(name) {
		return name
	}
	return "invalid"
}

func rejectAutonomousDraft(name string) error {
	switch name {
	case ToolRepairRequestDraft:
		return protocol.NewError(400, protocol.CodeInvalidRequest, "generateRepairRequestDraft is orchestration-driven and is not executed by the model.", false)
	case ToolTroubleshootingDraft:
		return protocol.NewError(400, protocol.CodeInvalidRequest, "generateTroubleshootingDraft is advisory and is not executed in this phase.", false)
	default:
		return nil
	}
}

func (a Assistant) runnableNames(names []string) []string {
	runnable := make([]string, 0, len(names))
	for _, name := range names {
		if rejectAutonomousDraft(name) != nil {
			continue
		}
		if name == QueryToolName && !a.queryEnabled() {
			continue
		}
		runnable = append(runnable, name)
	}
	return runnable
}

func (a Assistant) bindTools(cred Credential, scope Scope, requestID string, names []string) []capability.Tool {
	tools := make([]capability.Tool, 0, len(names))
	for _, name := range names {
		toolName := name
		if toolName == QueryToolName {
			tools = append(tools, capability.Tool{
				Name:        QueryToolName,
				Description: "Run exactly one read-only SELECT on the ai_readonly semantic layer. Do not call set_config.",
				Parameters:  toolParameters(QueryToolName),
				Run: func(ctx context.Context, arguments string) (string, error) {
					sql, reasoning, err := validatedQueryArguments(arguments)
					if err != nil {
						return "", err
					}
					raw, err := a.executeQuery(ctx, cred, scope, scope.EffectiveFacilityID, sql, requestID)
					if err != nil {
						return "", err
					}
					encoded, err := queryDatabaseEnvelope(reasoning, raw)
					if err != nil {
						return "", err
					}
					full := string(encoded)
					if err := a.acceptToolOutput(requestID, arguments, full); err != nil {
						return "", err
					}
					return full, nil
				},
				ModelOutput: modelFacingOutput,
			})
			continue
		}
		spec, ok := catalogByName(toolName)
		if !ok {
			continue
		}
		boundSpec := spec
		tools = append(tools, capability.Tool{
			Name:        boundSpec.Name,
			Description: boundSpec.Description,
			Parameters:  toolParameters(boundSpec.Name),
			Run: func(ctx context.Context, arguments string) (string, error) {
				return a.runCatalog(ctx, cred, scope, requestID, boundSpec, arguments)
			},
			ModelOutput: modelFacingOutput,
		})
	}
	return tools
}

func (a Assistant) runCatalog(ctx context.Context, cred Credential, scope Scope, requestID string, spec ToolSpec, arguments string) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	payload, err := buildRPCPayload(spec.Name, arguments, scope, cred)
	if err != nil {
		return "", err
	}
	raw, err := a.gate().Call(ctx, cred, spec.RPC, payload)
	if err != nil {
		a.record(requestID, "rpc_error")
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		return "", protocol.NewError(502, protocol.CodeProviderFailure, "The read-only tool failed.", false)
	}
	compacted, err := compactModelOutput(spec, raw)
	if err != nil {
		a.record(requestID, "rpc_error")
		return "", protocol.NewError(502, protocol.CodeProviderFailure, "The read-only tool failed.", false)
	}
	full := string(compacted)
	if err := a.acceptToolOutput(requestID, arguments, full); err != nil {
		return "", err
	}
	return full, nil
}

func messageBytes(messages []protocol.Message) int {
	total := 0
	for _, message := range messages {
		total += len(message.Content)
	}
	return total
}
