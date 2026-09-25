package qltbyt

// ToolSpec is one allowlisted read-only catalog tool.
// RPC names match src/lib/ai/tools/query-catalog.ts, including usageHistory
// and attachmentLookup, whose RPC names are not the tool names.
type ToolSpec struct {
	Name        string
	RPC         string
	Description string
	Budget      *ModelBudget
	Intents     []RoutingIntent
}

type RoutingIntent struct {
	Group string
	Role  string
}

type ModelBudget struct {
	MaxItems int
	MaxBytes int
	Fields   []string
}

var catalog = []ToolSpec{
	{Name: "equipmentLookup", RPC: "ai_equipment_lookup", Description: "Lookup equipment details using approved read-only RPC.", Intents: []RoutingIntent{{Group: "repair", Role: "equipment-status"}, {Group: "equipmentLookup", Role: "specific-item"}}},
	{Name: "maintenanceSummary", RPC: "ai_maintenance_summary", Description: "Retrieve maintenance summary data via approved read-only RPC."},
	{Name: "maintenancePlanLookup", RPC: "ai_maintenance_plan_lookup", Description: "Lookup maintenance, calibration, and inspection plans for a specific equipment item."},
	{Name: "repairSummary", RPC: "ai_repair_summary", Description: "Retrieve repair summary data via approved read-only RPC.", Intents: []RoutingIntent{{Group: "repair", Role: "workflow-summary"}}},
	{Name: "usageHistory", RPC: "ai_usage_summary", Description: "Retrieve usage summary evidence for a specific equipment item from usage logs."},
	{Name: "attachmentLookup", RPC: "ai_attachment_metadata", Description: "Lookup attachment metadata for a specific equipment item."},
	{Name: "deviceQuotaLookup", RPC: "ai_device_quota_lookup", Description: "Check quota status for a specific equipment item against the active quota decision.", Intents: []RoutingIntent{{Group: "quota", Role: "specific-item"}}},
	{Name: "quotaComplianceSummary", RPC: "ai_quota_compliance_summary", Description: "Get facility-level device quota compliance overview from the active decision.", Intents: []RoutingIntent{{Group: "quota", Role: "facility-summary"}}},
	{Name: "categorySuggestion", RPC: "ai_category_suggestion", Description: "Suggest matching equipment categories for a provided device name.", Budget: &ModelBudget{MaxItems: 10, Fields: []string{"ma_nhom", "ten_nhom", "parent_name", "phan_loai", "match_reason"}}},
	{Name: "departmentList", RPC: "ai_department_list", Description: "List departments with equipment in the current facility.", Budget: &ModelBudget{MaxItems: 50, Fields: []string{"name", "equipment_count"}}},
}

func catalogByName(name string) (ToolSpec, bool) {
	for _, spec := range catalog {
		if spec.Name == name {
			return spec, true
		}
	}
	return ToolSpec{}, false
}

func toolsByGroup(group string) []string {
	names := make([]string, 0, 2)
	for _, spec := range catalog {
		for _, intent := range spec.Intents {
			if intent.Group == group {
				names = append(names, spec.Name)
				break
			}
		}
	}
	return names
}

func catalogRPC(name string) (string, bool) {
	spec, ok := catalogByName(name)
	if !ok {
		return "", false
	}
	return spec.RPC, true
}

func isCatalogRPC(rpc string) bool {
	for _, spec := range catalog {
		if spec.RPC == rpc {
			return true
		}
	}
	return false
}

func chatRPCAllowed(rpc string) bool {
	return rpc == RPCAudit || isCatalogRPC(rpc)
}

func knownRPC(rpc string) bool {
	return chatRPCAllowed(rpc) || rpc == RPCQuotaReserve || rpc == RPCQuotaFinalize
}
