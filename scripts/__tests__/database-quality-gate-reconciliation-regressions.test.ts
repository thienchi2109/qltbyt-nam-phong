import { readFileSync, writeFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import { baselineStateHash } from "../db-quality-gate/baseline-state"
import { finalizeReport } from "../db-quality-gate/contract"
import { migrationContentSha256 } from "../db-quality-gate/migration-source"
import { ORACLE_REPORT_ARTIFACT } from "../db-quality-gate/oracle-evidence-store"
import { stableJsonStringify } from "../db-quality-gate/serialization"
import type { BaselineState } from "../db-quality-gate/baseline-state"
import type { AppliedMigrationLock } from "../db-quality-gate/registries"
import type { GateReport } from "../db-quality-gate/types"
import { git } from "./database-quality-gate-pre-live-test-support"
import {
  BASELINE_FORWARD_RUN_ID,
  LIVE_VERSION,
  MIGRATION_PATH,
  MIGRATION_SQL,
  RECONCILIATION_RUN_ID,
  createReconciliationFixture,
  reconciliationInput,
} from "./database-quality-gate-reconciliation-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"
import { cleanupFixtureRepositories, fixtureJson } from "./database-quality-gate-test-support"

type ReconciliationFixture = ReturnType<typeof createReconciliationFixture>

type ReconciliationModule = {
  evaluateReconciliation: (
    input: ReturnType<typeof reconciliationInput>,
    dependencies: {
      clock: () => string
      evidenceStore: ReconciliationFixture["store"]
      refreshOriginMain: () => string | undefined
      verifyProtectedMain: () => { status: "active"; subjectCommit: string }
    }
  ) => GateReport
}

afterEach(cleanupFixtureRepositories)

function activeDependencies(fixture: ReconciliationFixture, subjectCommit: string) {
  return {
    clock: () => "2026-08-23T08:00:00.000Z",
    evidenceStore: fixture.store,
    refreshOriginMain: () => subjectCommit,
    verifyProtectedMain: () => ({
      status: "active" as const,
      subjectCommit,
    }),
  }
}

function readLock(fixture: ReconciliationFixture): AppliedMigrationLock {
  return JSON.parse(
    readFileSync(fixture.repository.path("supabase", "applied-migrations.lock.json"), "utf8")
  ) as AppliedMigrationLock
}

function landReconciliationEvidence(input: {
  fixture: ReconciliationFixture
  lock: AppliedMigrationLock
  reportHighWater: string
  state: BaselineState
}): { baselineReport: GateReport; subjectCommit: string } {
  writeFileSync(
    input.fixture.repository.path("supabase", "applied-migrations.lock.json"),
    fixtureJson(input.lock)
  )
  const subjectCommit = commitWorkingTree(input.fixture.repository.root, "land regression state")
  git(input.fixture.repository.root, "update-ref", "refs/remotes/origin/main", subjectCommit)
  input.fixture.store.baselineStateContent = `${stableJsonStringify(input.state)}\n`
  const baselineReport = finalizeReport({
    baselineMigrationHighWater: input.reportHighWater,
    createdAt: "2026-08-23T07:30:00.000Z",
    digest: "",
    evidenceAvailable: true,
    executorEnvironment: { oracle: "fixture" },
    findings: [],
    inputHashes: { baselineState: baselineStateHash(input.state) },
    lane: "baseline-forward",
    migrationIdentities: input.state.confirmedMigrations.map(({ path, sha256 }) => ({
      path,
      sha256,
    })),
    outcome: "PASS",
    requiredChecksComplete: true,
    runId: BASELINE_FORWARD_RUN_ID,
    schemaVersion: 1,
    subjectCommit,
  })
  input.fixture.store.artifacts.set(
    `${BASELINE_FORWARD_RUN_ID}/${ORACLE_REPORT_ARTIFACT}`,
    `${stableJsonStringify(baselineReport)}\n`
  )
  return { baselineReport, subjectCommit }
}

function ruleIds(report: GateReport): string[] {
  return report.findings.map((finding) => finding.ruleId)
}

describe("database quality gate reconciliation regressions", () => {
  it("targets the newest applied authority instead of an older baseline report", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture()
    const lock = readLock(fixture)
    const newerVersion = "20260824070000"
    lock.applied.push({
      liveName: "newer",
      liveVersion: newerVersion,
      path: `supabase/migrations/${newerVersion}_newer.sql`,
      readBackDigest: "4".repeat(64),
      readBackEvidenceId: "oracle:missing-newer-read-back/read-back.json",
      sha256: "5".repeat(64),
    })
    const landed = landReconciliationEvidence({
      fixture,
      lock,
      reportHighWater: LIVE_VERSION,
      state: fixture.state,
    })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(landed.subjectCommit, landed.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture, landed.subjectCommit)
    )

    expect(report.outcome).not.toBe("PASS")
    expect(report.baselineMigrationHighWater).toBe(newerVersion)
    expect(ruleIds(report)).toEqual(
      expect.arrayContaining([
        "reconciliation/baseline-forward-rerun-required",
        "reconciliation/baseline-incomplete",
        "reconciliation/lock-evidence-unavailable",
      ])
    )
  })

  it("allows a clean cutover whose current high-water is protected by legacy history", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture({ legacyHighWater: true })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture, fixture.subjectCommit)
    )

    expect(report.outcome).toBe("PASS")
    expect(ruleIds(report)).not.toContain("reconciliation/lock-incomplete")
  })

  it("reports lock evidence and baseline failures independently", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture({
      baselineHealthy: false,
      readBackEvidenceIdOverride: "oracle:missing-read-back/read-back.json",
    })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture, fixture.subjectCommit)
    )

    expect(report.outcome).toBe("INCOMPLETE")
    expect(ruleIds(report)).toEqual(
      expect.arrayContaining([
        "reconciliation/baseline-incomplete",
        "reconciliation/lock-evidence-unavailable",
      ])
    )
  })
})
