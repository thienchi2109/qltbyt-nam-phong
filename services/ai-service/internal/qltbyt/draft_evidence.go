package qltbyt

import (
	"encoding/json"
	"strconv"
	"strings"

	"example.com/shared-ai-service/internal/capability"
	"example.com/shared-ai-service/internal/protocol"
)

type draftEquipment struct {
	ID   int64
	Code string
	Name string
}

type draftEvidence struct {
	refs       []string
	equipment  *draftEquipment
	resolution string
}

func collectDraftEvidence(messages []protocol.Message, tools []capability.ToolResult) draftEvidence {
	type named struct {
		name   string
		output string
	}
	var results []named
	for _, message := range messages {
		if message.Role != protocol.RoleTool && message.Name == "" {
			continue
		}
		results = append(results, named{name: message.Name, output: message.Content})
	}
	for _, tool := range tools {
		results = append(results, named{name: tool.Name, output: tool.Output})
	}
	seenRef := map[string]struct{}{}
	seenID := map[int64]struct{}{}
	var refs []string
	var matches []draftEquipment
	for _, result := range results {
		if draftEligible(result.name) || outputHasEvidenceRef(result.output) {
			if result.name != "" {
				if _, ok := seenRef[result.name]; !ok {
					seenRef[result.name] = struct{}{}
					refs = append(refs, result.name)
				}
			}
		}
		if result.name != "equipmentLookup" {
			continue
		}
		for _, match := range equipmentFromOutput(result.output) {
			if _, ok := seenID[match.ID]; ok {
				continue
			}
			seenID[match.ID] = struct{}{}
			matches = append(matches, match)
		}
	}
	evidence := draftEvidence{refs: refs, resolution: "none"}
	switch len(matches) {
	case 0:
		return evidence
	case 1:
		equipment := matches[0]
		evidence.equipment = &equipment
		evidence.resolution = "single"
		return evidence
	default:
		evidence.resolution = "multiple"
		return evidence
	}
}

func draftEligible(name string) bool {
	switch name {
	case "equipmentLookup", "repairSummary", "maintenanceSummary", "maintenancePlanLookup", "usageHistory":
		return true
	default:
		return false
	}
}

func outputHasEvidenceRef(output string) bool {
	var envelope struct {
		FollowUp struct {
			EvidenceRef string `json:"evidenceRef"`
		} `json:"followUpContext"`
	}
	if err := json.Unmarshal([]byte(output), &envelope); err != nil {
		return false
	}
	return strings.TrimSpace(envelope.FollowUp.EvidenceRef) != ""
}

func equipmentFromOutput(output string) []draftEquipment {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal([]byte(output), &envelope); err != nil {
		return nil
	}
	if raw, ok := envelope["followUpContext"]; ok {
		var ctx struct {
			Equipment []map[string]json.RawMessage `json:"equipment"`
		}
		if err := json.Unmarshal(raw, &ctx); err == nil && len(ctx.Equipment) > 0 {
			return normalizeEquipment(ctx.Equipment)
		}
	}
	if raw, ok := envelope["data"]; ok {
		var rows []map[string]json.RawMessage
		if err := json.Unmarshal(raw, &rows); err == nil {
			return normalizeEquipment(rows)
		}
	}
	return nil
}

func normalizeEquipment(rows []map[string]json.RawMessage) []draftEquipment {
	matches := make([]draftEquipment, 0, len(rows))
	for _, row := range rows {
		id, ok := positiveFlexibleID(row["thiet_bi_id"])
		if !ok {
			continue
		}
		matches = append(matches, draftEquipment{
			ID:   id,
			Code: rawString(row["ma_thiet_bi"]),
			Name: rawString(row["ten_thiet_bi"]),
		})
	}
	return matches
}

func positiveFlexibleID(raw json.RawMessage) (int64, bool) {
	if id, ok := positiveID(raw); ok {
		return id, true
	}
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return 0, false
	}
	parsed, err := strconv.ParseInt(strings.TrimSpace(text), 10, 64)
	return parsed, err == nil && parsed > 0
}
