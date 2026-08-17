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
  preservesWaiverHistory: (previous: unknown, current: unknown) => boolean
  validateRegistrySet: (input: {
    appliedLock: unknown
    invariants: unknown
    previousAppliedLock?: unknown
    previousWaivers?: unknown
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

function validWaiver(overrides: Record<string, string> = {}) {
  return {
    approvalCommit: "a".repeat(40),
    approvedAt: "2026-08-16T15:00:00Z",
    approver: "database maintainer",
    approvalUrl: "https://example.test/approvals/1",
    candidateCommit: "b".repeat(40),
    candidateReportDigest: "c".repeat(64),
    classification: "DANGEROUS",
    compensatingControls: "Run the disposable validation lane.",
    findingFingerprint: "d".repeat(64),
    id: "approval-1",
    migrationPath: "supabase/migrations/20270101000000_candidate.sql",
    migrationSha256: "e".repeat(64),
    objectScope: "public.deprecated_table",
    rationale: "The destructive migration was reviewed.",
    recoveryPlan: "Restore the prior backup.",
    rejectedAlternatives: "Keeping the table preserves unused schema.",
    reviewEvidence: "Maintainer review evidence.",
    riskAndImpact: "The operation is destructive.",
    ruleId: "migration.dangerous-statement",
    statementScope: "DROP TABLE public.deprecated_table",
    status: "active",
    validation: "Verify the replacement after validation.",
    ...overrides,
  }
}

describe("database quality gate registry waiver transitions", () => {
  it("rejects waiver history that removes prior review evidence", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    previous.waivers.approvals.push({
      approvalCommit: "b".repeat(40),
      candidateCommit: "a".repeat(40),
      candidateReportDigest: "c".repeat(64),
      findingFingerprint: "d".repeat(64),
      id: "approval-1",
      migrationSha256: "e".repeat(64),
      reviewEvidence: "PR #936 reviewed by maintainer",
      ruleId: "migration.dangerous-statement",
      status: "active",
    })
    const current = validRegistries()

    const result = registry.validateRegistrySet({
      ...current,
      previousWaivers: previous.waivers,
    })

    expect(result.valid).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "registry.waivers.append-only",
      })
    )
  })

  it("accepts only complete exact-bound DANGEROUS approval evidence", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.waivers.approvals.push({
      approvalCommit: "b".repeat(40),
      approvedAt: "2026-08-16T15:10:00.000Z",
      approver: "maintainer",
      approvalUrl: "https://github.com/thienchi2109/qltbyt-nam-phong/pull/940#pullrequestreview-1",
      candidateCommit: "a".repeat(40),
      candidateReportDigest: "c".repeat(64),
      classification: "DANGEROUS",
      compensatingControls: "Verified in a disposable gate-run database.",
      findingFingerprint: "d".repeat(64),
      id: "approval-2",
      migrationPath: "supabase/migrations/20270101000000_candidate.sql",
      migrationSha256: "e".repeat(64),
      objectScope: "public.device_quota",
      rationale: "The reviewed data repair is necessary for the deployment.",
      recoveryPlan: "Restore the reviewed backup if post-apply validation fails.",
      rejectedAlternatives: "A background repair would leave inconsistent data.",
      reviewEvidence: "Maintainer approved the linked pull-request review.",
      riskAndImpact: "The update holds a write lock while backfilling rows.",
      ruleId: "migration.dangerous-statement",
      statementScope: "UPDATE public.device_quota SET limit = 0 WHERE limit IS NULL",
      status: "active",
      validation: "Check the exact row count and catalog state after the gate run.",
    })

    expect(registry.validateRegistrySet(input)).toEqual({
      findings: [],
      valid: true,
    })
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

  it("rejects orphan, self, future, and mismatched waiver supersedes transitions", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const invalidWaiverSets = [
      [validWaiver({ supersedes: "missing-approval" })],
      [validWaiver({ id: "self", supersedes: "self" })],
      [
        validWaiver({ id: "approval-1", supersedes: "approval-2" }),
        validWaiver({ id: "approval-2" }),
      ],
      [
        validWaiver({ id: "approval-1" }),
        validWaiver({
          id: "approval-2",
          migrationSha256: "f".repeat(64),
          supersedes: "approval-1",
        }),
      ],
    ]

    for (const approvals of invalidWaiverSets) {
      const input = validRegistries()
      input.waivers.approvals.push(...approvals)

      const result = registry.validateRegistrySet(input)

      expect(result.valid).toBe(false)
      expect(result.findings).toContainEqual(
        expect.objectContaining({ ruleId: "registry.waivers.schema" })
      )
    }
  })

  it("requires status-specific revocation and supersede evidence", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const invalidWaiverSets = [
      [validWaiver({ revokedAt: "2026-08-16T15:05:00.000Z" })],
      [validWaiver({ status: "revoked" })],
      [validWaiver({ status: "superseded" })],
      [
        validWaiver({ id: "approval-1" }),
        validWaiver({
          id: "approval-2",
          revokedAt: "2026-08-16T15:05:00.000Z",
          status: "active",
          supersedes: "approval-1",
        }),
      ],
    ]

    for (const approvals of invalidWaiverSets) {
      const input = validRegistries()
      input.waivers.approvals.push(...approvals)

      const result = registry.validateRegistrySet(input)

      expect(result.valid).toBe(false)
      expect(result.findings).toContainEqual(
        expect.objectContaining({ ruleId: "registry.waivers.schema" })
      )
    }
  })
})
