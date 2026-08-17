import { execFileSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type ContractModule = {
  createEvidenceInvalidationKeys: (input: {
    appliedLockHash: string
    baselineMigrationHighWater: string
    executorEnvironment: Record<string, string>
    harnessVersion: string
    migrationIdentities: Array<{ path: string; sha256: string }>
    registryHashes: Record<string, string>
  }) => Record<string, string>
  createFindingFingerprint: (input: {
    evidence: Record<string, unknown>
    ruleId: string
    subject: string
  }) => string
  createRuleId: (input: { domain: string; name: string }) => string
}

type CommandModule = {
  runDatabaseQualityGateCommand: (args: string[]) => {
    exitCode: 2
    stdout: string
  }
}

type RegistryModule = {
  validateRegistrySet: (input: {
    appliedLock: unknown
    invariants: unknown
    sqlTests: unknown
    waivers: unknown
  }) => {
    findings: Array<{
      classification: "BLOCKING" | "INCOMPLETE"
      ruleId: string
    }>
    valid: boolean
  }
}

describe("database quality gate Phase 1 contract core", () => {
  it("creates stable rule IDs, finding fingerprints, and evidence invalidation keys", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")
    const firstFingerprint = contract.createFindingFingerprint({
      evidence: {
        migration: "migration-hash",
        source: "supabase/migrations/example.sql",
      },
      ruleId: "migration.legacy-content",
      subject: "supabase/migrations/example.sql",
    })
    const secondFingerprint = contract.createFindingFingerprint({
      evidence: {
        source: "supabase/migrations/example.sql",
        migration: "migration-hash",
      },
      ruleId: "migration.legacy-content",
      subject: "supabase/migrations/example.sql",
    })
    const input = {
      appliedLockHash: "lock-hash",
      baselineMigrationHighWater: "20260816044031",
      executorEnvironment: {
        postgres: "17.6",
        supabase: "v1.26.08",
      },
      harnessVersion: "phase-1",
      migrationIdentities: [
        {
          path: "supabase/migrations/20270101000000_add_contract.sql",
          sha256: "migration-hash",
        },
      ],
      registryHashes: {
        invariants: "invariants-hash",
        sqlTests: "tests-hash",
        waivers: "waivers-hash",
      },
    }

    expect(contract.createRuleId({ domain: "Migration", name: "Legacy Content" })).toBe(
      "migration.legacy-content"
    )
    expect(firstFingerprint).toMatch(/^[a-f0-9]{64}$/)
    expect(secondFingerprint).toBe(firstFingerprint)
    expect(contract.createEvidenceInvalidationKeys(input)).toEqual({
      appliedLock: "lock-hash",
      baselineMigrationHighWater: "20260816044031",
      executorEnvironment: expect.stringMatching(/^[a-f0-9]{64}$/),
      harness: "phase-1",
      migration: expect.stringMatching(/^[a-f0-9]{64}$/),
      registries: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(
      contract.createEvidenceInvalidationKeys({
        ...input,
        harnessVersion: "phase-1-rebuilt",
      })
    ).not.toEqual(contract.createEvidenceInvalidationKeys(input))
  })

  it("keeps special JSON property names in canonical evidence fingerprints", async () => {
    const contract = await loadDatabaseQualityGateModule<ContractModule>("contract")
    const specialKeyEvidence: Record<string, unknown> = {}

    Object.defineProperty(specialKeyEvidence, "__proto__", {
      enumerable: true,
      value: "evidence-that-must-not-be-dropped",
    })

    expect(
      contract.createFindingFingerprint({
        evidence: {},
        ruleId: "migration.legacy-content",
        subject: "supabase/migrations/example.sql",
      })
    ).not.toBe(
      contract.createFindingFingerprint({
        evidence: specialKeyEvidence,
        ruleId: "migration.legacy-content",
        subject: "supabase/migrations/example.sql",
      })
    )
  })

  it("rejects unsupported registry schema versions for every committed registry", async () => {
    const registries = await loadDatabaseQualityGateModule<RegistryModule>("registries")

    const result = registries.validateRegistrySet({
      appliedLock: { schemaVersion: 0 },
      invariants: { schemaVersion: 0 },
      sqlTests: { schemaVersion: 0 },
      waivers: { schemaVersion: 0 },
    })

    expect(result.valid).toBe(false)
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "registry.applied-lock.schema-version",
        }),
        expect.objectContaining({
          classification: "INCOMPLETE",
          ruleId: "registry.invariants.schema-version",
        }),
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "registry.sql-tests.schema-version",
        }),
        expect.objectContaining({
          classification: "BLOCKING",
          ruleId: "registry.waivers.schema-version",
        }),
      ])
    )
  })

  it("requires an explicit lane and emits deterministic INCOMPLETE JSON while no lane executor exists", async () => {
    const command = await loadDatabaseQualityGateModule<CommandModule>("cli")
    const headCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim()
    const args = [
      "--created-at",
      "2026-08-16T09:29:20Z",
      "--lane",
      "static",
      "--run-id",
      "phase-1-contract",
      "--subject-commit",
      headCommit,
    ]

    const missingLane = command.runDatabaseQualityGateCommand([])
    const first = command.runDatabaseQualityGateCommand(args)
    const second = command.runDatabaseQualityGateCommand(args)

    expect(missingLane.exitCode).toBe(2)
    expect(JSON.parse(missingLane.stdout)).toMatchObject({
      error: "Missing required --lane argument",
      outcome: "INCOMPLETE",
      schemaVersion: 1,
    })
    expect(first.exitCode).toBe(2)
    expect(first.stdout).toBe(second.stdout)
    expect(JSON.parse(first.stdout)).toMatchObject({
      lane: "static",
      outcome: "INCOMPLETE",
      requiredChecksComplete: false,
      runId: "phase-1-contract",
      schemaVersion: 1,
      subjectCommit: headCommit,
    })

    const mismatchedSubject = command.runDatabaseQualityGateCommand([
      "--lane",
      "static",
      "--subject-commit",
      "0".repeat(40),
    ])

    expect(mismatchedSubject.exitCode).toBe(2)
    expect(JSON.parse(mismatchedSubject.stdout)).toMatchObject({
      error: "Subject commit must match repository HEAD",
      outcome: "INCOMPLETE",
    })
  }, 30_000)
})
