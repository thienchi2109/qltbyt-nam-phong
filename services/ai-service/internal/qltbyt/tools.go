package qltbyt

import (
	"context"
	"encoding/json"
	"regexp"
	"strconv"
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
				Run: func(ctx context.Context, arguments string) (string, error) {
					sql, reasoning := queryArguments(arguments)
					raw, err := a.executeQuery(ctx, cred, scope, scope.EffectiveFacilityID, sql, requestID)
					if err != nil {
						return "", err
					}
					encoded, err := queryDatabaseEnvelope(reasoning, raw)
					if err != nil {
						return "", err
					}
					return string(encoded), nil
				},
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
			Run: func(ctx context.Context, arguments string) (string, error) {
				return a.runCatalog(ctx, cred, scope, requestID, boundSpec, arguments)
			},
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
	return string(compacted), nil
}

func buildRPCPayload(name, arguments string, scope Scope, cred Credential) (json.RawMessage, error) {
	fields := map[string]json.RawMessage{}
	if strings.TrimSpace(arguments) != "" {
		if err := json.Unmarshal([]byte(arguments), &fields); err != nil {
			return nil, protocol.NewError(400, protocol.CodeInvalidRequest, "The tool arguments are not valid.", false)
		}
	}
	if name == "categorySuggestion" {
		device := fields["device_name"]
		fields = map[string]json.RawMessage{}
		if len(device) > 0 {
			fields["p_device_name"] = device
		}
	}
	delete(fields, "p_don_vi")
	delete(fields, "p_user_id")
	facility, err := json.Marshal(scope.EffectiveFacilityID)
	if err != nil {
		return nil, err
	}
	user, err := json.Marshal(strconv.FormatInt(cred.UserID, 10))
	if err != nil {
		return nil, err
	}
	fields["p_don_vi"] = facility
	fields["p_user_id"] = user
	return json.Marshal(fields)
}

func queryArguments(arguments string) (string, string) {
	var payload struct {
		SQL       string `json:"sql"`
		Reasoning string `json:"reasoning"`
	}
	if err := json.Unmarshal([]byte(arguments), &payload); err != nil || strings.TrimSpace(payload.SQL) == "" {
		return arguments, ""
	}
	return payload.SQL, strings.TrimSpace(payload.Reasoning)
}

func sqlFromArgs(arguments string) string {
	sql, _ := queryArguments(arguments)
	return sql
}

func messageBytes(messages []protocol.Message) int {
	total := 0
	for _, message := range messages {
		total += len(message.Content)
	}
	return total
}
