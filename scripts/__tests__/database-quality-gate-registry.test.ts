import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"
import { validRegistries } from "./database-quality-gate-registry-test-support"

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

describe("database quality gate registry schemas", () => {
  it("requires waiver history to preserve the exact prior prefix", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const approvalA = { id: "approval-a" }
    const approvalB = { id: "approval-b" }

    expect(
      registry.preservesWaiverHistory(
        { approvals: [approvalA], schemaVersion: 1 },
        { approvals: [approvalA, approvalB], schemaVersion: 1 }
      )
    ).toBe(true)
    expect(
      registry.preservesWaiverHistory(
        { approvals: [approvalA, approvalB], schemaVersion: 1 },
        { approvals: [approvalB, approvalA], schemaVersion: 1 }
      )
    ).toBe(false)
    expect(
      registry.preservesWaiverHistory(
        { approvals: [approvalA], schemaVersion: 1 },
        { approvals: [approvalA, approvalA], schemaVersion: 1 }
      )
    ).toBe(false)
  })

  it("accepts a complete applied-lock, waiver, invariant, and SQL-test registry set", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()

    expect(registry.validateRegistrySet(input)).toEqual({
      findings: [],
      valid: true,
    })
  })

  it("marks an unknown table classification incomplete instead of inferring current access", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.invariants.invariants[0].classification = "unreviewed"

    expect(registry.validateRegistrySet(input)).toEqual({
      findings: [
        {
          classification: "INCOMPLETE",
          ruleId: "registry.invariants.table-intent",
        },
      ],
      valid: false,
    })
  })

  it("accepts explicit unresolved table authority as tracked non-blocking debt", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()

    expect(
      registry.validateRegistrySet({
        ...input,
        invariants: {
          ...input.invariants,
          invariants: [
            {
              evidence: ["Wayfinder #941 table-security decision"],
              id: "public.thiet_bi.access",
              objectIdentity: "public.thiet_bi",
              rule: "table-access-contract",
              scope: "table-security",
              status: "unresolved",
            },
          ],
        },
      })
    ).toEqual({ findings: [], valid: true })
  })

  it("rejects metadata that would admit performance tests to the default lane", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.sqlTests.tests[0].purpose = "performance"

    expect(registry.validateRegistrySet(input)).toEqual({
      findings: [
        {
          classification: "BLOCKING",
          ruleId: "registry.sql-tests.default-safe-contract",
        },
      ],
      valid: false,
    })
  })

  it("rejects duplicate migration paths across legacy and applied lock entries", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const input = validRegistries()
    input.appliedLock.applied.push({
      path: input.appliedLock.legacy[0].path,
      sha256: "2".repeat(64),
    })

    const result = registry.validateRegistrySet(input)

    expect(result.valid).toBe(false)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "registry.applied-lock.schema",
      })
    )
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

  it("rejects an applied lock that reorders prior history before appending", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    const current = validRegistries()
    current.appliedLock.legacy.unshift({
      path: "supabase/migrations/20241219_preceding.sql",
      sha256: "3".repeat(64),
    })

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

  it("rejects a changed cutover commit and a noncanonical migration root", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    const changedCommit = validRegistries()
    const changedRoot = validRegistries()
    changedCommit.appliedLock.cutover.commit = "b".repeat(40)
    changedRoot.appliedLock.cutover.migrationRoot = "supabase/renamed-migrations"

    const commitResult = registry.validateRegistrySet({
      ...changedCommit,
      previousAppliedLock: previous.appliedLock,
    })
    const rootResult = registry.validateRegistrySet({
      ...changedRoot,
      previousAppliedLock: previous.appliedLock,
    })

    expect(commitResult.valid).toBe(false)
    expect(rootResult.valid).toBe(false)
    expect(commitResult.findings).toContainEqual(
      expect.objectContaining({ ruleId: "registry.applied-lock.append-only" })
    )
    expect(rootResult.findings).toContainEqual(
      expect.objectContaining({ ruleId: "registry.applied-lock.schema" })
    )
  })

  it("marks newly appended applied migrations incomplete without read-back evidence", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    const current = validRegistries()
    current.appliedLock.applied = [
      {
        path: "supabase/migrations/20270101000000_candidate.sql",
        sha256: "2".repeat(64),
      },
    ]

    const validation = registry.validateRegistrySet({
      ...current,
      previousAppliedLock: previous.appliedLock,
    })

    expect(validation.valid).toBe(false)
    expect(validation.findings).toContainEqual({
      classification: "INCOMPLETE",
      ruleId: "registry.applied-lock.readback",
    })
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
})
