import { describe, expect, it } from 'vitest'

const EXPECTED_TOOL_NAMES = [
  'attachmentLookup',
  'categorySuggestion',
  'departmentList',
  'deviceQuotaLookup',
  'equipmentLookup',
  'maintenancePlanLookup',
  'maintenanceSummary',
  'quotaComplianceSummary',
  'repairSummary',
  'usageHistory',
]

const EXPECTED_RPC_MAPPING: Record<string, string> = {
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

const EXPECTED_MIGRATION_STATUS: Record<string, 'migrated' | 'pending'> = {
  categorySuggestion: 'migrated',
  departmentList: 'migrated',
  equipmentLookup: 'pending',
  maintenanceSummary: 'pending',
  maintenancePlanLookup: 'pending',
  repairSummary: 'pending',
  usageHistory: 'pending',
  attachmentLookup: 'pending',
  deviceQuotaLookup: 'pending',
  quotaComplianceSummary: 'pending',
}

describe('query catalog', () => {
  it('exports the exact curated read-only tool names', async () => {
    const { QUERY_CATALOG } = await import('../query-catalog')

    expect(Object.keys(QUERY_CATALOG).sort()).toEqual(EXPECTED_TOOL_NAMES)
  })

  it('exports the exact tool to RPC mapping', async () => {
    const { getQueryCatalogToolRpcMapping } = await import('../query-catalog')

    expect(getQueryCatalogToolRpcMapping()).toEqual(EXPECTED_RPC_MAPPING)
  })

  it('exports the exact migration status map', async () => {
    const { getQueryCatalogMigrationStatusMap } = await import('../query-catalog')

    expect(getQueryCatalogMigrationStatusMap()).toEqual(EXPECTED_MIGRATION_STATUS)
  })

  it('marks migrated tools with a model budget', async () => {
    const { QUERY_CATALOG } = await import('../query-catalog')

    const migratedToolNames = Object.entries(EXPECTED_MIGRATION_STATUS)
      .filter(([, status]) => status === 'migrated')
      .map(([name]) => name)

    for (const toolName of migratedToolNames) {
      expect(QUERY_CATALOG[toolName]?.modelBudget, `${toolName} must define modelBudget`).toBeDefined()
    }
  })
})
