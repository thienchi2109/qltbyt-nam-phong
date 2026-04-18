import { describe, expect, it } from 'vitest'

import {
  QUERY_CATALOG,
  getQueryCatalogMigrationStatusMap,
  getQueryCatalogToolRpcMapping,
} from '@/lib/ai/tools/query-catalog'

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
  it('exports the exact curated read-only tool names', () => {
    expect(Object.keys(QUERY_CATALOG).sort((a, b) => a.localeCompare(b))).toEqual(
      EXPECTED_TOOL_NAMES,
    )
  })

  it('exports the exact tool to RPC mapping', () => {
    expect(getQueryCatalogToolRpcMapping()).toEqual(EXPECTED_RPC_MAPPING)
  })

  it('does not define query_database rollout artifacts in the current catalog', () => {
    const catalogToolNames = Object.keys(QUERY_CATALOG)

    expect(catalogToolNames).not.toContain('query_database')
    expect(catalogToolNames).not.toContain('queryDatabase')
    expect(Object.values(getQueryCatalogToolRpcMapping())).not.toContain('ai_query_database')
  })

  it('exports the exact migration status map', () => {
    expect(getQueryCatalogMigrationStatusMap()).toEqual(EXPECTED_MIGRATION_STATUS)
  })

  it('marks migrated tools with a model budget', () => {
    const migratedToolNames = Object.entries(EXPECTED_MIGRATION_STATUS)
      .filter(([, status]) => status === 'migrated')
      .map(([name]) => name)

    for (const toolName of migratedToolNames) {
      expect(QUERY_CATALOG[toolName]?.modelBudget, `${toolName} must define modelBudget`).toBeDefined()
    }
  })
})
