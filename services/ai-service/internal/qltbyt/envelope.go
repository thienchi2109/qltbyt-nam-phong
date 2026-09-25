package qltbyt

import (
	"encoding/json"
	"fmt"
	"strconv"
)

type modelEnvelope struct {
	ModelSummary modelSummary    `json:"modelSummary"`
	FollowUp     json.RawMessage `json:"followUpContext,omitempty"`
	UIArtifact   *uiArtifact     `json:"uiArtifact,omitempty"`
}

type uiArtifact struct {
	RawPayload json.RawMessage `json:"rawPayload"`
}

type modelSummary struct {
	SummaryText     string                     `json:"summaryText"`
	ImportantFields map[string]json.RawMessage `json:"importantFields,omitempty"`
	ItemCount       *int                       `json:"itemCount,omitempty"`
	Truncated       bool                       `json:"truncated,omitempty"`
}

func compactModelOutput(spec ToolSpec, payload json.RawMessage) (json.RawMessage, error) {
	rows, _, _ := payloadRows(payload)
	projected, truncated := projectRows(rows, spec.Budget)
	if spec.Budget != nil && spec.Budget.MaxBytes > 0 {
		projected, truncated = fitBudgetBytes(spec, projected, truncated)
	}
	return marshalEnvelope(spec, payload, rows, projected, truncated)
}

func projectRows(rows []json.RawMessage, budget *ModelBudget) ([]json.RawMessage, bool) {
	truncated := false
	if budget != nil && budget.MaxItems > 0 && len(rows) > budget.MaxItems {
		rows = append([]json.RawMessage(nil), rows[:budget.MaxItems]...)
		truncated = true
	} else {
		rows = append([]json.RawMessage(nil), rows...)
	}
	if budget == nil || len(budget.Fields) == 0 {
		return rows, truncated
	}
	projected := make([]json.RawMessage, 0, len(rows))
	for _, row := range rows {
		var object map[string]json.RawMessage
		if err := json.Unmarshal(row, &object); err != nil {
			continue
		}
		filtered := make(map[string]json.RawMessage, len(budget.Fields))
		for _, field := range budget.Fields {
			if value, ok := object[field]; ok {
				filtered[field] = value
			}
		}
		encoded, err := json.Marshal(filtered)
		if err != nil {
			continue
		}
		projected = append(projected, encoded)
	}
	return projected, truncated
}

func fitBudgetBytes(spec ToolSpec, rows []json.RawMessage, truncated bool) ([]json.RawMessage, bool) {
	for {
		encoded, err := json.Marshal(importantFields(spec, rows))
		if err != nil || len(encoded) <= spec.Budget.MaxBytes {
			return rows, truncated
		}
		if len(rows) == 0 {
			return nil, true
		}
		rows = rows[:len(rows)-1]
		truncated = true
	}
}

func marshalEnvelope(spec ToolSpec, payload json.RawMessage, rows, projected []json.RawMessage, truncated bool) (json.RawMessage, error) {
	text, count := summarizePayload(spec.Name, payload)
	summary := modelSummary{SummaryText: text, ItemCount: count, Truncated: truncated}
	if fields := importantFields(spec, projected); len(fields) > 0 {
		summary.ImportantFields = fields
	}
	envelope := modelEnvelope{ModelSummary: summary}
	if followUp := followUpContext(spec.Name, rows); len(followUp) > 0 {
		envelope.FollowUp = followUp
	}
	if spec.Name != "departmentList" && len(payload) > 0 {
		envelope.UIArtifact = &uiArtifact{RawPayload: json.RawMessage(append([]byte(nil), payload...))}
	}
	return json.Marshal(envelope)
}

func summarizePayload(name string, payload json.RawMessage) (string, *int) {
	if len(payload) == 0 {
		return name + ": completed.", nil
	}
	var listed []json.RawMessage
	if err := json.Unmarshal(payload, &listed); err == nil {
		count := len(listed)
		return fmt.Sprintf("%s: %d item(s).", name, count), &count
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(payload, &object); err == nil {
		if raw, ok := object["total"]; ok {
			if count, ok := jsonInt(raw); ok {
				return fmt.Sprintf("%s: %d result(s).", name, count), &count
			}
		}
	}
	return name + ": completed.", nil
}

func jsonInt(raw json.RawMessage) (int, bool) {
	var number int
	if err := json.Unmarshal(raw, &number); err != nil {
		return 0, false
	}
	return number, true
}

func importantFields(spec ToolSpec, rows []json.RawMessage) map[string]json.RawMessage {
	if spec.Budget == nil || len(rows) == 0 {
		return nil
	}
	encoded, err := json.Marshal(rows)
	if err != nil {
		return nil
	}
	key := "rows"
	switch spec.Name {
	case "departmentList":
		key = "departments"
	case "categorySuggestion":
		key = "candidates"
	}
	return map[string]json.RawMessage{key: encoded}
}

func followUpContext(toolName string, rows []json.RawMessage) json.RawMessage {
	switch toolName {
	case "equipmentLookup":
		return equipmentFollowUp(rows)
	case "repairSummary", "maintenanceSummary", "maintenancePlanLookup", "usageHistory":
		encoded, _ := json.Marshal(map[string]string{"evidenceRef": toolName})
		return encoded
	default:
		return nil
	}
}

func equipmentFollowUp(rows []json.RawMessage) json.RawMessage {
	type item struct {
		ID   int64  `json:"thiet_bi_id"`
		Code string `json:"ma_thiet_bi,omitempty"`
		Name string `json:"ten_thiet_bi,omitempty"`
	}
	items := make([]item, 0, len(rows))
	for _, row := range rows {
		var object map[string]json.RawMessage
		if err := json.Unmarshal(row, &object); err != nil {
			continue
		}
		id, ok := positiveID(object["thiet_bi_id"])
		if !ok {
			continue
		}
		entry := item{ID: id}
		entry.Code = rawString(object["ma_thiet_bi"])
		entry.Name = rawString(object["ten_thiet_bi"])
		items = append(items, entry)
	}
	if len(items) == 0 {
		encoded, _ := json.Marshal(map[string][]item{"equipment": {}})
		return encoded
	}
	encoded, _ := json.Marshal(map[string][]item{"equipment": items})
	return encoded
}

func payloadRows(payload json.RawMessage) ([]json.RawMessage, int, bool) {
	if len(payload) == 0 {
		return nil, 0, false
	}
	var rows []json.RawMessage
	if err := json.Unmarshal(payload, &rows); err == nil {
		return rows, len(rows), false
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(payload, &object); err != nil {
		return nil, 0, false
	}
	total := 0
	hasTotal := false
	if raw, ok := object["data"]; ok {
		_ = json.Unmarshal(raw, &rows)
	}
	if raw, ok := object["total"]; ok {
		if value, err := strconv.Atoi(string(raw)); err == nil {
			total = value
			hasTotal = true
		}
	}
	if !hasTotal {
		total = len(rows)
	}
	return rows, total, true
}

func positiveID(raw json.RawMessage) (int64, bool) {
	if len(raw) == 0 {
		return 0, false
	}
	var value int64
	if err := json.Unmarshal(raw, &value); err != nil || value <= 0 {
		return 0, false
	}
	return value, true
}

func rawString(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return ""
	}
	return stringsTrim(value)
}

func stringsTrim(value string) string {
	return string([]rune(trimSpace(value)))
}

func trimSpace(value string) string {
	start := 0
	end := len(value)
	for start < end && (value[start] == ' ' || value[start] == '\n' || value[start] == '\t' || value[start] == '\r') {
		start++
	}
	for end > start && (value[end-1] == ' ' || value[end-1] == '\n' || value[end-1] == '\t' || value[end-1] == '\r') {
		end--
	}
	return value[start:end]
}
