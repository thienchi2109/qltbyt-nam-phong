import { describe, expect, it } from 'vitest'

import {
  getMigrationStatusMap,
  PENDING_TOOL_NAMES,
  READ_ONLY_TOOL_DEFINITIONS_FOR_TEST,
  type MigrationStatus,
} from '../registry'

// ---------------------------------------------------------------------------
// The exact migration-status map that MUST hold for all read-only / RPC tools.
// Changing a tool's status requires updating this test intentionally.
// ---------------------------------------------------------------------------

const EXPECTED_MIGRATION_MAP: Record<string, MigrationStatus> = {
  // Pass 1 — migrated in Batch 2
  categorySuggestion: 'migrated',
  departmentList: 'migrated',

  // Pending — not yet migrated to envelope contract
  equipmentLookup: 'pending',
  maintenanceSummary: 'pending',
  maintenancePlanLookup: 'pending',
  repairSummary: 'pending',
  usageHistory: 'pending',
  attachmentLookup: 'pending',
  deviceQuotaLookup: 'pending',
  quotaComplianceSummary: 'pending',
}

describe('migration gate', () => {
  it('locks the exact migrationStatus for every read-only / RPC tool', () => {
    const actual = getMigrationStatusMap()
    expect(actual).toEqual(EXPECTED_MIGRATION_MAP)
  })

  it('migrationStatus map covers every registered read-only tool', () => {
    const map = getMigrationStatusMap()
    const toolNames = Object.keys(map).sort()

    // Ensure no tool is silently added without a migration status
    expect(toolNames).toEqual(Object.keys(EXPECTED_MIGRATION_MAP).sort())
  })

  it('PENDING_TOOL_NAMES matches tools with status "pending"', () => {
    const map = getMigrationStatusMap()
    const expected = Object.entries(map)
      .filter(([, status]) => status === 'pending')
      .map(([name]) => name)
      .sort()

    expect([...PENDING_TOOL_NAMES].sort()).toEqual(expected)
  })

  it('every migrated read-only tool has a modelBudget', () => {
    const map = getMigrationStatusMap()
    const migratedTools = Object.entries(map)
      .filter(([, status]) => status === 'migrated')
      .map(([name]) => name)

    for (const toolName of migratedTools) {
      const def = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST[toolName]
      expect(def.modelBudget, `${toolName} must have modelBudget`).toBeDefined()
    }
  })
})
