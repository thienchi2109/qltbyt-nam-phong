import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type ValidationFinding = {
  classification: "BLOCKING" | "INCOMPLETE"
  ruleId: string
}

type RegistryValidation = {
  findings: ValidationFinding[]
  valid: boolean
}

type RegistryModule = {
  validateRegistrySet: (input: {
    appliedLock: unknown
    invariants: unknown
    previousAppliedLock?: unknown
    sqlTests: unknown
    waivers: unknown
  }) => RegistryValidation
}

function validRegistries() {
  return {
    appliedLock: {
      applied: [],
      cutover: {
        commit: "a".repeat(40),
        migrationRoot: "supabase/migrations",
      },
      legacy: [
        {
          path: "supabase/migrations/20241220_add_completion_tracking.sql",
          sha256: "1".repeat(64),
        },
      ],
      schemaVersion: 1,
    },
    invariants: {
      schemaVersion: 1,
      tables: [
        {
          allowedOperations: ["SELECT"],
          classification: "rpc-only",
          enforcement: "guarded RPC",
          evidence: "Wayfinder #935",
          owner: "postgres",
          table: "public.nhan_vien",
        },
      ],
    },
    sqlTests: {
      schemaVersion: 1,
      tests: [
        {
          evidence: "existing smoke test",
          fixture: "none",
          path: "supabase/tests/equipment_list_enhanced_active_repair_smoke.sql",
          purpose: "equipment list regression",
          runner: "psql",
          safety: "default-safe",
          timeoutMs: 30000,
          transaction: "rollback-required",
        },
      ],
    },
    waivers: {
      approvals: [] as Array<Record<string, unknown>>,
      schemaVersion: 1,
    },
  }
}

describe("database quality gate registry schemas", () => {
  it("accepts a complete applied-lock, waiver, invariant, and SQL-test registry set", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()

    expect(registry.validateRegistrySet(input)).toEqual({
      findings: [],
      valid: true,
    })
  })

  it("rejects an applied lock that rewrites protected lock history", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    const current = validRegistries()
    current.appliedLock.legacy[0].sha256 = "2".repeat(64)

    const result = registry.validateRegistrySet({
      ...current,
      previousAppliedLock: previous.appliedLock,
    })

    expect(result.valid).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "registry.applied-lock.append-only",
      })
    )
  })

  it("rejects a waiver that is not bound to reviewed candidate evidence", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.waivers.approvals.push({
      approvalCommit: "b".repeat(40),
      candidateCommit: "a".repeat(40),
      id: "approval-1",
      ruleId: "sql.dangerous",
      status: "active",
    })

    const result = registry.validateRegistrySet(input)

    expect(result.valid).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "registry.waivers.schema",
      })
    )
  })

  it("rejects a waiver whose candidate report digest is not a SHA-256 value", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.waivers.approvals.push({
      approvalCommit: "b".repeat(40),
      candidateCommit: "a".repeat(40),
      candidateReportDigest: "not-a-sha256",
      findingFingerprint: "1".repeat(64),
      id: "approval-1",
      migrationSha256: "2".repeat(64),
      reviewEvidence: "PR #936 reviewed by maintainer",
      ruleId: "sql.dangerous",
      status: "active",
    })

    const result = registry.validateRegistrySet(input)

    expect(result.valid).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "registry.waivers.schema",
      })
    )
  })

  it("rejects unknown table intent and incomplete SQL-test execution metadata", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.invariants.tables[0].classification = "unclassified"
    input.sqlTests.tests[0].transaction = ""

    const result = registry.validateRegistrySet(input)

    expect(result.valid).toBe(false)
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "INCOMPLETE",
          ruleId: "registry.invariants.table-intent",
        }),
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "registry.sql-tests.schema",
        }),
      ])
    )
  })
})
