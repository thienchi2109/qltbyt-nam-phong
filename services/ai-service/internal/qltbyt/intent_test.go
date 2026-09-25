package qltbyt

import (
	"testing"

	"example.com/shared-ai-service/internal/protocol"
)

func TestIntentRoutesCuratedBeforeQueryDatabase(t *testing.T) {
	all := []string{
		"equipmentLookup", "maintenanceSummary", "maintenancePlanLookup", "repairSummary",
		"usageHistory", "attachmentLookup", "deviceQuotaLookup", "quotaComplianceSummary", "query_database",
	}
	full := append(append([]string{}, all...), "generateTroubleshootingDraft", "generateRepairRequestDraft", "categorySuggestion", "departmentList")
	cases := []struct {
		name    string
		text    string
		tools   []string
		clarify string
		want    []string
	}{
		{name: "mixed clarify", text: "Có bao nhiêu phiếu sửa chữa và thiết bị vượt định mức trong đơn vị hiện tại?", tools: all, clarify: MixedClarification},
		{name: "draft start keeps panel", text: "Tạo phiếu yêu cầu sửa chữa thiết bị máy thở ABC đang vượt định mức", tools: full, want: removeTool(full, "query_database")},
		{name: "repair summary", text: "Có bao nhiêu phiếu sửa chữa đang chờ xử lý?", tools: all, want: removeTool(removeTool(all, "equipmentLookup"), "query_database")},
		{name: "quota summary", text: "Tổng quan định mức của đơn vị hiện tại thế nào?", tools: all, want: removeTool(removeTool(all, "deviceQuotaLookup"), "query_database")},
		{name: "generic empty", text: "Xin chào, bạn giúp được gì?", tools: all, want: []string{}},
		{name: "repair history clarifies", text: "thiết bị X có bao nhiêu lần sửa chữa?", tools: []string{"equipmentLookup", "repairSummary"}, clarify: RepairClarification},
		{name: "equipment status", text: "trạng thái sửa chữa thiết bị X", tools: []string{"equipmentLookup", "repairSummary"}, want: []string{"equipmentLookup"}},
		{name: "repair request", text: "yêu cầu sửa chữa đang tồn đọng", tools: []string{"equipmentLookup", "repairSummary"}, want: []string{"repairSummary"}},
		{name: "draft keeps both", text: "Tạo phiếu yêu cầu sửa chữa thiết bị", tools: []string{"equipmentLookup", "repairSummary"}, want: []string{"equipmentLookup", "repairSummary"}},
		{name: "cancel is not draft start", text: "Hủy tạo phiếu sửa chữa", tools: []string{"equipmentLookup", "repairSummary"}, want: []string{"repairSummary"}},
		{name: "quota code", text: "kiểm tra định mức TB-001234", tools: []string{"deviceQuotaLookup", "quotaComplianceSummary"}, want: []string{"deviceQuotaLookup"}},
		{name: "quota serial", text: "định mức cho SN-9999", tools: []string{"deviceQuotaLookup", "quotaComplianceSummary"}, want: []string{"deviceQuotaLookup"}},
		{name: "quota dotted code", text: "định mức mã thiết bị TT.192004.JPDCTA", tools: []string{"deviceQuotaLookup", "quotaComplianceSummary"}, want: []string{"deviceQuotaLookup"}},
		{name: "hyphenated english is not a code", text: "kiểm tra định mức cho thiết bị non-invasive", tools: []string{"deviceQuotaLookup", "quotaComplianceSummary"}, clarify: QuotaClarification},
		{name: "code after english hyphen", text: "kiểm tra định mức high-tech TB-001234", tools: []string{"deviceQuotaLookup", "quotaComplianceSummary"}, want: []string{"deviceQuotaLookup"}},
		{name: "reporting fallback", text: "Báo cáo tổng hợp số lượng thiết bị theo trạng thái của đơn vị hiện tại", tools: all, want: []string{"query_database"}},
		{name: "curated lookup", text: "Tra cứu thông tin thiết bị monitor CMS8000", tools: all, want: []string{"equipmentLookup"}},
		{name: "name lookup", text: "Tra cứu bơm tiêm điện", tools: all, want: []string{"equipmentLookup"}},
		{name: "detail report", text: "Báo cáo chi tiết tình trạng thiết bị theo khoa trong đơn vị hiện tại", tools: all, want: []string{"query_database"}},
		{name: "only sql tool", text: "Xin chào", tools: []string{"query_database"}, want: []string{"query_database"}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			result := routeIntent(userMessages(test.text), test.tools)
			if test.clarify != "" {
				if result.Clarify != test.clarify {
					t.Fatalf("clarify = %q", result.Clarify)
				}
				return
			}
			if result.Clarify != "" {
				t.Fatalf("unexpected clarify %q", result.Clarify)
			}
			if stringsJoin(result.Tools) != stringsJoin(test.want) {
				t.Fatalf("tools = %#v want %#v", result.Tools, test.want)
			}
		})
	}
}

func TestIntentUsesLatestUserMessage(t *testing.T) {
	messages := []protocol.Message{
		{Role: protocol.RoleUser, Content: "old message"},
		{Role: protocol.RoleAssistant, Content: "response"},
		{Role: protocol.RoleUser, Content: "kiểm tra yêu cầu sửa chữa"},
	}
	result := routeIntent(messages, []string{"equipmentLookup", "repairSummary"})
	if stringsJoin(result.Tools) != stringsJoin([]string{"repairSummary"}) {
		t.Fatalf("tools = %#v", result.Tools)
	}
}

func TestIntentKeepsToolsWhenNoUserText(t *testing.T) {
	tools := []string{"equipmentLookup", "repairSummary"}
	result := routeIntent(nil, tools)
	if stringsJoin(result.Tools) != stringsJoin(tools) {
		t.Fatalf("tools = %#v", result.Tools)
	}
}

func userMessages(text string) []protocol.Message {
	return []protocol.Message{{Role: protocol.RoleUser, Content: text}}
}
