import { describe, expect, it } from "vitest"

import { validRegistries } from "./database-quality-gate-registry-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type RegistryModule = {
  validateRegistrySet: (input: {
    appliedLock: unknown
    invariants: unknown
    previousAppliedLock?: unknown
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

describe("database quality gate applied-lock authority", () => {
  it("accepts a complete evidence-bound applied-lock append", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    const current = validRegistries()
    current.appliedLock.applied = [
      {
        liveName: "candidate",
        liveVersion: "20270101000000",
        path: "supabase/migrations/20270101000000_candidate.sql",
        readBackDigest: "3".repeat(64),
        readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
        sha256: "2".repeat(64),
      },
    ]

    const validation = registry.validateRegistrySet({
      ...current,
      previousAppliedLock: previous.appliedLock,
    })

    expect(validation.valid).toBe(true)
    expect(validation.findings).not.toContainEqual(
      expect.objectContaining({ ruleId: "registry.applied-lock.readback" })
    )
  })

  it("accepts authority when the live version differs from the local filename timestamp", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    const current = validRegistries()
    current.appliedLock.applied = [
      {
        liveName: "technical_configuration_baseline_cross_dossier_copy",
        liveVersion: "20260819062043",
        path: "supabase/migrations/20260819031200_technical_configuration_baseline_cross_dossier_copy.sql",
        readBackDigest: "3".repeat(64),
        readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
        sha256: "2".repeat(64),
      },
    ]

    expect(
      registry.validateRegistrySet({
        ...current,
        previousAppliedLock: previous.appliedLock,
      }).valid
    ).toBe(true)
  })

  it("rejects an appended applied migration without a complete immutable evidence pointer", async () => {
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
      classification: "BLOCKING",
      ruleId: "registry.applied-lock.schema",
    })
  })

  it("rejects mutation of immutable authority fields in prior applied history", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    previous.appliedLock.applied = [
      {
        liveName: "candidate",
        liveVersion: "20270101000000",
        path: "supabase/migrations/20270101000000_candidate.sql",
        readBackDigest: "3".repeat(64),
        readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
        sha256: "2".repeat(64),
      },
    ]
    const current = structuredClone(previous)
    current.appliedLock.applied[0].readBackDigest = "4".repeat(64)

    const validation = registry.validateRegistrySet({
      ...current,
      previousAppliedLock: previous.appliedLock,
    })

    expect(validation.valid).toBe(false)
    expect(validation.findings).toContainEqual({
      classification: "BLOCKING",
      ruleId: "registry.applied-lock.append-only",
    })
  })

  it("rejects removal of prior applied authority without throwing", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const previous = validRegistries()
    previous.appliedLock.applied = [
      {
        liveName: "candidate",
        liveVersion: "20270101000000",
        path: "supabase/migrations/20270101000000_candidate.sql",
        readBackDigest: "3".repeat(64),
        readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
        sha256: "2".repeat(64),
      },
    ]
    const current = structuredClone(previous)
    current.appliedLock.applied = []

    const validation = registry.validateRegistrySet({
      ...current,
      previousAppliedLock: previous.appliedLock,
    })

    expect(validation.valid).toBe(false)
    expect(validation.findings).toContainEqual({
      classification: "BLOCKING",
      ruleId: "registry.applied-lock.append-only",
    })
  })

  it("rejects duplicate or descending live versions in applied authority", async () => {
    const registry = await loadDatabaseQualityGateModule<RegistryModule>("registries")
    const current = validRegistries()
    const authority = {
      liveName: "candidate",
      liveVersion: "20270101000000",
      path: "supabase/migrations/20270101000000_candidate.sql",
      readBackDigest: "3".repeat(64),
      readBackEvidenceId: "oracle:phase-6-read-back/read-back.json",
      sha256: "2".repeat(64),
    }
    current.appliedLock.applied = [
      authority,
      {
        ...authority,
        path: "supabase/migrations/20261231000000_older.sql",
        liveName: "older",
        liveVersion: "20261231000000",
      },
    ]

    const validation = registry.validateRegistrySet(current)

    expect(validation.valid).toBe(false)
    expect(validation.findings).toContainEqual({
      classification: "BLOCKING",
      ruleId: "registry.applied-lock.schema",
    })
  })
})
