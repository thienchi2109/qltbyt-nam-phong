package qltbyt

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

const queryFollowUpRows = 10

type queryDimension struct {
	key       string
	title     string
	chartType string
}

type queryFollowUpBody struct {
	QueryResult queryFollowUpResult `json:"queryResult"`
}

type queryFollowUpResult struct {
	Reasoning string            `json:"reasoning"`
	RowCount  int               `json:"rowCount"`
	Rows      []json.RawMessage `json:"rows"`
	Truncated bool              `json:"truncated"`
}

type queryDataPayload struct {
	Data      []json.RawMessage `json:"data"`
	RowCount  int               `json:"rowCount"`
	Reasoning string            `json:"reasoning"`
}

var queryDimensions = []queryDimension{
	{key: "khoa_phong_quan_ly", title: "Số lượng thiết bị theo khoa", chartType: "bar"},
	{key: "vi_tri_lap_dat", title: "Số lượng thiết bị theo vị trí lắp đặt", chartType: "bar"},
	{key: "nguoi_dang_truc_tiep_quan_ly", title: "Số lượng thiết bị theo người quản lý trực tiếp", chartType: "bar"},
	{key: "tinh_trang_hien_tai", title: "Tỷ lệ tình trạng thiết bị", chartType: "pie"},
}

var queryCountKeys = []string{"so_luong", "count", "total"}

func queryDatabaseEnvelope(reasoning string, raw json.RawMessage) (json.RawMessage, error) {
	rows := queryRows(raw)
	count := len(rows)
	followRows := rows
	truncated := false
	if len(followRows) > queryFollowUpRows {
		followRows = append([]json.RawMessage(nil), followRows[:queryFollowUpRows]...)
		truncated = true
	}
	followUp, err := json.Marshal(queryFollowUpBody{QueryResult: queryFollowUpResult{
		Reasoning: reasoning,
		RowCount:  count,
		Rows:      followRows,
		Truncated: truncated,
	}})
	if err != nil {
		return nil, err
	}
	summary := modelSummary{
		SummaryText: fmt.Sprintf("query_database: %d row(s).", count),
		ItemCount:   &count,
	}
	rawPayload, chartTitle, err := queryRawPayload(reasoning, count, rows)
	if err != nil {
		return nil, err
	}
	if chartTitle != "" {
		summary.ImportantFields = map[string]json.RawMessage{
			"chartTitle": mustJSONString(chartTitle),
		}
	}
	return json.Marshal(modelEnvelope{
		ModelSummary: summary,
		FollowUp:     followUp,
		UIArtifact:   &uiArtifact{RawPayload: rawPayload},
	})
}

func queryRows(raw json.RawMessage) []json.RawMessage {
	if len(bytesTrim(raw)) == 0 {
		return []json.RawMessage{}
	}
	var rows []json.RawMessage
	if err := json.Unmarshal(raw, &rows); err != nil || rows == nil {
		return []json.RawMessage{}
	}
	return rows
}

func bytesTrim(raw json.RawMessage) json.RawMessage {
	return json.RawMessage(strings.TrimSpace(string(raw)))
}

func queryRawPayload(reasoning string, count int, rows []json.RawMessage) (json.RawMessage, string, error) {
	if chart, title, ok := queryChart(rows); ok {
		encoded, err := json.Marshal(chart)
		return encoded, title, err
	}
	encoded, err := json.Marshal(queryDataPayload{Data: rows, RowCount: count, Reasoning: reasoning})
	return encoded, "", err
}

func queryChart(rows []json.RawMessage) (map[string]interface{}, string, bool) {
	if len(rows) == 0 || len(rows) > 20 {
		return nil, "", false
	}
	objects := make([]map[string]json.RawMessage, len(rows))
	for index, row := range rows {
		var object map[string]json.RawMessage
		if err := json.Unmarshal(row, &object); err != nil {
			return nil, "", false
		}
		objects[index] = object
	}
	countKey := ""
	for _, candidate := range queryCountKeys {
		if rowsHaveCount(objects, candidate) {
			countKey = candidate
			break
		}
	}
	if countKey == "" {
		return nil, "", false
	}
	normalized := normalizeCounts(objects, countKey)
	for _, dimension := range queryDimensions {
		if !rowsHaveLabel(objects, dimension.key) {
			continue
		}
		chart := map[string]interface{}{
			"data": normalized,
			"type": dimension.chartType,
		}
		if dimension.chartType == "pie" {
			chart["innerRadius"] = 56
			chart["labelKey"] = dimension.key
			chart["valueKey"] = countKey
		} else {
			chart["xKey"] = dimension.key
			chart["yKey"] = countKey
		}
		return map[string]interface{}{
			"chart":   chart,
			"kind":    "reportChart",
			"table":   map[string]interface{}{"columns": sortedKeys(objects[0]), "rows": normalized},
			"title":   dimension.title,
			"version": 1,
		}, dimension.title, true
	}
	return nil, "", false
}

func rowsHaveCount(rows []map[string]json.RawMessage, key string) bool {
	for _, row := range rows {
		if _, ok := numericRaw(row[key]); !ok {
			return false
		}
	}
	return true
}

func rowsHaveLabel(rows []map[string]json.RawMessage, key string) bool {
	for _, row := range rows {
		raw := row[key]
		if len(raw) == 0 {
			return false
		}
		var text string
		if err := json.Unmarshal(raw, &text); err == nil {
			if strings.TrimSpace(text) == "" {
				return false
			}
			continue
		}
		if _, ok := numericRaw(raw); !ok {
			return false
		}
	}
	return true
}

func normalizeCounts(rows []map[string]json.RawMessage, key string) []map[string]interface{} {
	normalized := make([]map[string]interface{}, len(rows))
	for index, row := range rows {
		copyRow := make(map[string]interface{}, len(row))
		for name, value := range row {
			copyRow[name] = json.RawMessage(append([]byte(nil), value...))
		}
		if number, ok := numericRaw(row[key]); ok {
			copyRow[key] = number
		}
		normalized[index] = copyRow
	}
	return normalized
}

func numericRaw(raw json.RawMessage) (float64, bool) {
	if len(raw) == 0 {
		return 0, false
	}
	var number float64
	if err := json.Unmarshal(raw, &number); err == nil {
		return number, true
	}
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return 0, false
	}
	number, err := strconv.ParseFloat(strings.TrimSpace(text), 64)
	return number, err == nil
}

func sortedKeys(row map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(row))
	for key := range row {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func mustJSONString(value string) json.RawMessage {
	encoded, _ := json.Marshal(value)
	return encoded
}
