package qltbyt

import (
	"context"
	"strconv"
	"sync"
	"time"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
	"example.com/shared-ai-service/internal/registry"
)

// Assistant is the QLTBYT assistant-chat capability. Shared packages do not import it.
type Assistant struct {
	Broker  Broker
	Secret  []byte
	Query   QueryExecutor
	Now     func() time.Time
	Log     RedactedLog
	Cleanup time.Duration
	// budgets is a pointer so registration copies share one map.
	// A mutex stored by value would be copied with the Assistant.
	budgets *sync.Map
	kill    *killSwitchState
}

// Register adds assistant-chat to a registry the neutral server already owns.
func Register(reg *registry.Registry, assistant Assistant) error {
	if reg == nil {
		return protocol.NewError(500, protocol.CodeInvalidRequest, "The capability registry is missing.", false)
	}
	return reg.Register(activate(assistant))
}

func activate(assistant Assistant) Assistant {
	if assistant.budgets == nil {
		assistant.budgets = &sync.Map{}
	}
	if assistant.kill == nil {
		assistant.kill = &killSwitchState{}
	}
	return assistant
}

func (a Assistant) Descriptor() capability.Descriptor {
	return capability.Descriptor{
		AppID:           AppID,
		CapabilityID:    CapabilityID,
		Version:         Version,
		ArtifactSchemas: []string{TroubleshootingDraftKind, RepairRequestDraftKind},
	}
}

func (a Assistant) Authorize(ctx context.Context, request protocol.Request) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	_, err := a.credential(request)
	return err
}

func (a Assistant) Prepare(ctx context.Context, request protocol.Request) (capability.Prepared, error) {
	if err := ctx.Err(); err != nil {
		return capability.Prepared{}, err
	}
	cred, err := a.credential(request)
	if err != nil {
		return capability.Prepared{}, err
	}
	if err := validateToolNames(request.RequestedTools); err != nil {
		return capability.Prepared{}, err
	}
	decision := routeIntent(request.Messages, request.RequestedTools)
	if decision.Clarify != "" {
		return capability.Prepared{Clarification: decision.Clarify}, nil
	}
	names := a.runnableNames(decision.Tools)
	scope := resolveScope(cred, len(names) > 0)
	if scope.Guidance != "" {
		return capability.Prepared{Clarification: scope.Guidance}, nil
	}
	history := make([]protocol.Message, 0, len(request.Messages))
	for _, message := range request.Messages {
		history = append(history, compactHistoryMessage(message))
	}
	if messageBytes(history) > CompactedInputLimit {
		return capability.Prepared{}, protocol.NewError(400, protocol.CodeLimitExceeded, "Request exceeds compacted context limit.", false)
	}
	budget, err := a.claimBudget(request.RequestID, messageBytes(history))
	if err != nil {
		return capability.Prepared{}, err
	}
	var facilityID int64
	if len(names) > 0 || scope.EffectiveFacilityID > 0 {
		facilityID = scope.EffectiveFacilityID
	}
	prompt := buildSystemPrompt(promptInput{
		Role:           cred.RawRole,
		FacilityID:     facilityID,
		FacilityName:   displayName(request),
		PrivilegedRole: promptPrivileged(cred.RawRole),
	})
	messages := make([]protocol.Message, 0, len(history)+1)
	messages = append(messages, protocol.Message{Role: protocol.RoleSystem, Content: prompt})
	messages = append(messages, history...)
	var tenantID *int64
	if scope.EffectiveFacilityID > 0 {
		value := scope.EffectiveFacilityID
		tenantID = &value
	}
	prepared := capability.Prepared{
		Messages:      messages,
		Tools:         a.bindTools(cred, scope, request.RequestID, names),
		RestrictTools: true,
		QuotaUserID:   strconv.FormatInt(cred.UserID, 10),
		QuotaTenantID: tenantID,
		QuotaRole:     cred.RawRole,
		QuotaCaller:   quotaCaller{assistant: a, cred: cred, scope: scope},
	}
	if budget != nil {
		prepared.Cleanup = func() { a.releaseBudget(request.RequestID, budget) }
	}
	return prepared, nil
}

func (a Assistant) AfterPrimary(ctx context.Context, request protocol.Request, primary capability.PrimaryOutput) (capability.FollowUp, error) {
	if err := ctx.Err(); err != nil {
		return capability.FollowUp{}, err
	}
	return a.repairFollowUp(request, primary), nil
}

func (a Assistant) credential(request protocol.Request) (Credential, error) {
	return parseCredential(a.Secret, tokenFromRequest(request), a.clock())
}

func (a Assistant) clock() time.Time {
	if a.Now != nil {
		return a.Now()
	}
	return time.Now()
}
