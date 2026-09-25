package qltbyt

import (
	"bytes"
	"encoding/json"
	"strconv"
	"strings"

	"example.com/shared-ai-service/internal/protocol"
	"github.com/cloudwego/eino/schema"
)

type argField struct {
	kind     string
	required bool
	minLen   int
	maxLen   int
	minInt   int
	maxInt   int
	bounded  bool
	fields   map[string]argField
	desc     string
}

func toolParameters(name string) map[string]*schema.ParameterInfo {
	fields := argumentSchema(name)
	if len(fields) == 0 {
		return nil
	}
	return parameterInfo(fields)
}

func parameterInfo(fields map[string]argField) map[string]*schema.ParameterInfo {
	params := make(map[string]*schema.ParameterInfo, len(fields))
	for name, field := range fields {
		info := &schema.ParameterInfo{Desc: field.desc, Required: field.required}
		switch field.kind {
		case "int":
			info.Type = schema.Integer
		case "object":
			info.Type = schema.Object
			info.SubParams = parameterInfo(field.fields)
		default:
			info.Type = schema.String
		}
		params[name] = info
	}
	return params
}

func argumentSchema(name string) map[string]argField {
	switch name {
	case "equipmentLookup":
		return map[string]argField{
			"query":  {kind: "string", minLen: 1, maxLen: 200, desc: "Text search, 1 to 200 characters."},
			"limit":  {kind: "int", minInt: 1, maxInt: 50, bounded: true, desc: "Integer from 1 to 50."},
			"status": {kind: "string", minLen: 1, maxLen: 100, desc: "Status filter, 1 to 100 characters."},
			"filters": {kind: "object", desc: "Exact equipment filters.", fields: map[string]argField{
				"equipmentCode":  {kind: "string", minLen: 1, maxLen: 200, desc: "Exact equipment code."},
				"status":         {kind: "string", minLen: 1, maxLen: 100, desc: "Exact status."},
				"department":     {kind: "string", minLen: 1, maxLen: 200, desc: "Department name."},
				"location":       {kind: "string", minLen: 1, maxLen: 200, desc: "Location."},
				"classification": {kind: "string", minLen: 1, maxLen: 50, desc: "Classification."},
				"model":          {kind: "string", minLen: 1, maxLen: 200, desc: "Model."},
				"serial":         {kind: "string", minLen: 1, maxLen: 200, desc: "Serial number."},
			}},
		}
	case "maintenanceSummary":
		return map[string]argField{
			"fromDate": {kind: "string", desc: "Inclusive start date."},
			"toDate":   {kind: "string", desc: "Inclusive end date."},
		}
	case "maintenancePlanLookup":
		return map[string]argField{
			"p_thiet_bi_id": {kind: "int", required: true, minInt: 1, bounded: true, desc: "Positive equipment id."},
			"p_nam":         {kind: "int", minInt: 2000, maxInt: 2100, bounded: true, desc: "Plan year from 2000 to 2100."},
		}
	case "repairSummary":
		return map[string]argField{
			"status": {kind: "string", minLen: 1, maxLen: 50, desc: "Repair status, 1 to 50 characters."},
		}
	case "usageHistory":
		return map[string]argField{
			"p_thiet_bi_id": {kind: "int", required: true, minInt: 1, bounded: true, desc: "Positive equipment id."},
			"p_months":      {kind: "int", minInt: 1, maxInt: 24, bounded: true, desc: "History window from 1 to 24 months."},
		}
	case "attachmentLookup", "deviceQuotaLookup":
		return map[string]argField{
			"p_thiet_bi_id": {kind: "int", required: true, minInt: 1, bounded: true, desc: "Positive equipment id."},
		}
	case "categorySuggestion":
		return map[string]argField{
			"device_name": {kind: "string", required: true, minLen: 1, maxLen: 200, desc: "Device name, 1 to 200 characters."},
		}
	case QueryToolName:
		return map[string]argField{
			"sql":       {kind: "string", required: true, minLen: 1, maxLen: 20_000, desc: "One read-only SELECT on approved ai_readonly views."},
			"reasoning": {kind: "string", required: true, minLen: 1, maxLen: 500, desc: "Why this query answers the user, 1 to 500 characters."},
		}
	default:
		return map[string]argField{}
	}
}

func validatedQueryArguments(arguments string) (string, string, error) {
	fields, err := validateArguments(QueryToolName, arguments)
	if err != nil {
		return "", "", err
	}
	return jsonString(fields["sql"]), jsonString(fields["reasoning"]), nil
}

func buildRPCPayload(name, arguments string, scope Scope, cred Credential) (json.RawMessage, error) {
	fields, err := validateArguments(name, arguments)
	if err != nil {
		return nil, err
	}
	out := map[string]json.RawMessage{}
	if name == "categorySuggestion" {
		out["p_device_name"] = fields["device_name"]
	} else {
		for key, value := range fields {
			out[key] = value
		}
	}
	facility, err := json.Marshal(scope.EffectiveFacilityID)
	if err != nil {
		return nil, err
	}
	user, err := json.Marshal(strconv.FormatInt(cred.UserID, 10))
	if err != nil {
		return nil, err
	}
	out["p_don_vi"] = facility
	out["p_user_id"] = user
	return json.Marshal(out)
}

func validateArguments(name, arguments string) (map[string]json.RawMessage, error) {
	decoded, err := decodeArguments(arguments)
	if err != nil {
		return nil, err
	}
	checked, err := checkFields(argumentSchema(name), decoded)
	if err != nil {
		return nil, err
	}
	return checked, nil
}

func decodeArguments(arguments string) (map[string]json.RawMessage, error) {
	trimmed := strings.TrimSpace(arguments)
	if trimmed == "" || trimmed == "{}" {
		return map[string]json.RawMessage{}, nil
	}
	if strings.EqualFold(trimmed, "null") {
		return nil, invalidArguments()
	}
	fields := map[string]json.RawMessage{}
	decoder := json.NewDecoder(bytes.NewReader([]byte(trimmed)))
	decoder.UseNumber()
	if err := decoder.Decode(&fields); err != nil || fields == nil {
		return nil, invalidArguments()
	}
	return fields, nil
}

func checkFields(schema map[string]argField, fields map[string]json.RawMessage) (map[string]json.RawMessage, error) {
	if fields == nil {
		return nil, invalidArguments()
	}
	checked := make(map[string]json.RawMessage, len(fields))
	for key, raw := range fields {
		field, ok := schema[key]
		if !ok {
			return nil, invalidArguments()
		}
		value, err := checkField(field, raw)
		if err != nil {
			return nil, err
		}
		checked[key] = value
	}
	for key, field := range schema {
		if field.required {
			if _, ok := checked[key]; !ok {
				return nil, invalidArguments()
			}
		}
	}
	return checked, nil
}

func checkField(field argField, raw json.RawMessage) (json.RawMessage, error) {
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, invalidArguments()
	}
	switch field.kind {
	case "int":
		number, err := strictInt(raw)
		if err != nil || (field.bounded && (number < field.minInt || (field.maxInt > 0 && number > field.maxInt))) {
			return nil, invalidArguments()
		}
		encoded, err := json.Marshal(number)
		return json.RawMessage(encoded), err
	case "object":
		var nested map[string]json.RawMessage
		if err := json.Unmarshal(raw, &nested); err != nil || nested == nil {
			return nil, invalidArguments()
		}
		checked, err := checkFields(field.fields, nested)
		if err != nil {
			return nil, err
		}
		encoded, err := json.Marshal(checked)
		return json.RawMessage(encoded), err
	default:
		text, err := strictString(raw)
		if err != nil {
			return nil, invalidArguments()
		}
		if field.minLen == 0 && field.maxLen == 0 {
			encoded, err := json.Marshal(text)
			return json.RawMessage(encoded), err
		}
		trimmed := strings.TrimSpace(text)
		length := len([]rune(trimmed))
		if field.minLen > 0 && length < field.minLen {
			return nil, invalidArguments()
		}
		if field.maxLen > 0 && length > field.maxLen {
			return nil, invalidArguments()
		}
		if field.minLen > 0 {
			text = trimmed
		}
		encoded, err := json.Marshal(text)
		return json.RawMessage(encoded), err
	}
}

func strictInt(raw json.RawMessage) (int, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || raw[0] == '"' || raw[0] == '{' || raw[0] == '[' {
		return 0, invalidArguments()
	}
	var number json.Number
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&number); err != nil {
		return 0, err
	}
	if decoder.More() {
		return 0, invalidArguments()
	}
	parsed, err := number.Int64()
	if err != nil {
		return 0, err
	}
	return int(parsed), nil
}

func strictString(raw json.RawMessage) (string, error) {
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return "", err
	}
	return text, nil
}

func jsonString(raw json.RawMessage) string {
	text, err := strictString(raw)
	if err != nil {
		return ""
	}
	return text
}

func invalidArguments() error {
	return protocol.NewError(400, protocol.CodeInvalidRequest, "The tool arguments are not valid.", false)
}
