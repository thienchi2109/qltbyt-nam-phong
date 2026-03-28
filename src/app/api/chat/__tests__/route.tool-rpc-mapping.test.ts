import { describe, expect, it } from 'vitest'

import { getToolRpcMapping } from '@/lib/ai/tools/registry'

describe('AI tool → RPC mapping contract', () => {
  const EXPECTED_MAPPING: Record<string, string> = {
    equipmentLookup: 'ai_equipment_lookup',
    maintenanceSummary: 'ai_maintenance_summary',
    maintenancePlanLookup: 'ai_maintenance_plan_lookup',
    repairSummary: 'ai_repair_summary',
    usageHistory: 'ai_usage_summary',
    attachmentLookup: 'ai_attachment_metadata',
    deviceQuotaLookup: 'ai_device_quota_lookup',
    quotaComplianceSummary: 'ai_quota_compliance_summary',
    categorySuggestion: 'ai_category_suggestion',
    departmentList: 'ai_department_list',
  }

  it('maps tool names to their approved RPC functions', () => {
    const mapping = getToolRpcMapping()
    expect(mapping).toEqual(EXPECTED_MAPPING)
  })

  it('has exactly the expected number of tool→RPC entries', () => {
    const mapping = getToolRpcMapping()
    expect(Object.keys(mapping)).toHaveLength(Object.keys(EXPECTED_MAPPING).length)
  })

  it.each(Object.entries({
    equipmentLookup: 'ai_equipment_lookup',
    maintenanceSummary: 'ai_maintenance_summary',
    maintenancePlanLookup: 'ai_maintenance_plan_lookup',
    repairSummary: 'ai_repair_summary',
    usageHistory: 'ai_usage_summary',
    attachmentLookup: 'ai_attachment_metadata',
    deviceQuotaLookup: 'ai_device_quota_lookup',
    quotaComplianceSummary: 'ai_quota_compliance_summary',
    categorySuggestion: 'ai_category_suggestion',
    departmentList: 'ai_department_list',
  }))('tool "%s" maps to RPC "%s"', (tool, rpc) => {
    const mapping = getToolRpcMapping()
    expect(mapping[tool]).toBe(rpc)
  })
})
