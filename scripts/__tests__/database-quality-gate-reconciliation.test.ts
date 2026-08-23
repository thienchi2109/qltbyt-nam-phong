import { afterEach, describe, expect, it, vi } from "vitest"

import type { BaselineMaintenanceExecutor } from "../db-quality-gate/baseline-maintenance"
import type { BaselineState, ConfirmedLiveMigration } from "../db-quality-gate/baseline-state"
import type { GateReport } from "../db-quality-gate/types"
import { cleanupFixtureRepositories } from "./database-quality-gate-test-support"
import {
  LIVE_NAME,
  LIVE_VERSION,
  MIGRATION_PATH,
  createReconciliationFixture,
  reconciliationInput,
} from "./database-quality-gate-reconciliation-test-support"
import { migrationContentSha256 } from "../db-quality-gate/migration-source"
import { MIGRATION_SQL } from "./database-quality-gate-reconciliation-test-support"

type ReconciliationModule = {
  evaluateReconciliation: (
    input: ReturnType<typeof reconciliationInput>,
    dependencies: {
      clock: () => string
      evidenceStore: ReturnType<typeof createReconciliationFixture>["store"]
      refreshOriginMain: (repositoryRoot: string) => string | undefined
      verifyProtectedMain: () =>
        | { status: "active"; subjectCommit: string }
        | { reason: string; status: "inactive" | "unavailable" }
    }
  ) => GateReport
  runBaselineReconciliation: (
    input: {
      checkedAt: string
      confirmedMigrations: ConfirmedLiveMigration[]
      executor: BaselineMaintenanceExecutor
      repositoryRoot: string
      runId: string
      sourceCommit: string
    },
    dependencies?: {
      runCatchUp?: () => { outcome: "INCOMPLETE" | "PASS"; state: BaselineState }
      runHealthRecovery?: () => {
        outcome: "INCOMPLETE" | "PASS"
        state: BaselineState
      }
    }
  ) => { outcome: "INCOMPLETE" | "PASS"; state: BaselineState }
}

afterEach(() => {
  cleanupFixtureRepositories()
  vi.restoreAllMocks()
})

function ruleIds(report: GateReport): string[] {
  return report.findings.map((finding) => finding.ruleId)
}

function activeDependencies(fixture: ReturnType<typeof createReconciliationFixture>) {
  return {
    clock: () => "2026-08-23T08:00:00.000Z",
    evidenceStore: fixture.store,
    refreshOriginMain: () => fixture.subjectCommit,
    verifyProtectedMain: () => ({
      status: "active" as const,
      subjectCommit: fixture.subjectCommit,
    }),
  }
}

describe("database quality gate reconciliation state machine", () => {
  it("passes only after lock, baseline health, and baseline-forward rerun complete", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture()

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture)
    )

    expect(report).toMatchObject({
      baselineMigrationHighWater: LIVE_VERSION,
      findings: [],
      lane: "reconciliation",
      outcome: "PASS",
      subjectCommit: fixture.subjectCommit,
    })
  })

  it("keeps the lock branch incomplete when its push or merge did not land", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture({ includeLockEntry: false })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture)
    )

    expect(report.outcome).toBe("FAILED")
    expect(ruleIds(report)).toContain("reconciliation/lock-incomplete")
    expect(ruleIds(report)).not.toContain("reconciliation/baseline-incomplete")
  })

  it("keeps baseline reconciliation independent when catch-up or health fails", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture({ baselineHealthy: false })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture)
    )

    expect(report.outcome).toBe("FAILED")
    expect(ruleIds(report)).not.toContain("reconciliation/lock-incomplete")
    expect(ruleIds(report)).toEqual(
      expect.arrayContaining([
        "reconciliation/baseline-forward-rerun-required",
        "reconciliation/baseline-incomplete",
      ])
    )
  })

  it("rejects a rewritten read-back evidence pointer without weakening baseline status", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture({
      readBackEvidenceIdOverride: "oracle:missing-read-back/read-back.json",
    })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture)
    )

    expect(report.outcome).toBe("INCOMPLETE")
    expect(ruleIds(report)).toContain("reconciliation/lock-evidence-unavailable")
  })

  it("fails closed when protected main is inactive", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture()

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      {
        ...activeDependencies(fixture),
        verifyProtectedMain: () => ({
          reason: "ruleset inactive",
          status: "inactive" as const,
        }),
      }
    )

    expect(report.outcome).toBe("INCOMPLETE")
    expect(ruleIds(report)).toContain("reconciliation/protected-main-unavailable")
  })

  it("blocks the Phase 5 bootstrap state until the evidence-bound lock lands", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const fixture = createReconciliationFixture({ includeLockEntry: false })

    const report = source.evaluateReconciliation(
      {
        ...reconciliationInput(fixture.subjectCommit, fixture.baselineReport.digest),
        repositoryRoot: fixture.repository.root,
      },
      activeDependencies(fixture)
    )

    expect(report.outcome).toBe("FAILED")
    expect(ruleIds(report)).toEqual(["reconciliation/lock-incomplete"])
  })
})

describe("database quality gate Oracle baseline reconciliation orchestration", () => {
  const confirmation: ConfirmedLiveMigration = {
    liveName: LIVE_NAME,
    liveVersion: LIVE_VERSION,
    path: MIGRATION_PATH,
    sha256: migrationContentSha256(MIGRATION_SQL),
  }

  function executor(state: BaselineState): BaselineMaintenanceExecutor {
    return {
      acquireLock: () => false,
      applyMigrations: () => false,
      createRefreshDatabase: () => false,
      dropDatabase: () => false,
      inspectDatabase: () => undefined,
      publishState: () => false,
      readState: () => state,
      releaseLock: () => false,
      restoreDump: () => false,
      swapBaseline: () => false,
    }
  }

  function input(state: BaselineState) {
    return {
      checkedAt: "2026-08-23T08:00:00.000Z",
      confirmedMigrations: [confirmation],
      executor: executor(state),
      repositoryRoot: "/fixture",
      runId: "phase6-baseline-reconcile",
      sourceCommit: "a".repeat(40),
    }
  }

  it("selects catch-up for a healthy baseline behind confirmed live", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const state: BaselineState = {
      checkedAt: "2026-08-23T07:00:00.000Z",
      confirmedMigrations: [],
      generation: "previous",
      healthy: true,
      migrationHighWater: "20260822070000",
      schemaVersion: 1,
      sourceCommit: "b".repeat(40),
    }
    const runCatchUp = vi.fn(() => ({ outcome: "PASS" as const, state }))
    const runHealthRecovery = vi.fn(() => ({ outcome: "PASS" as const, state }))

    source.runBaselineReconciliation(input(state), { runCatchUp, runHealthRecovery })

    expect(runCatchUp).toHaveBeenCalledOnce()
    expect(runHealthRecovery).not.toHaveBeenCalled()
  })

  it("selects health recovery for an unhealthy published catch-up state", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const state: BaselineState = {
      checkedAt: "2026-08-23T07:00:00.000Z",
      confirmedMigrations: [],
      generation: "failed-catch-up",
      healthy: false,
      migrationHighWater: "unavailable",
      recovery: {
        kind: "catch-up",
        runId: "failed-catch-up",
        targetMigrationHighWater: LIVE_VERSION,
      },
      schemaVersion: 1,
      sourceCommit: "b".repeat(40),
    }
    const runCatchUp = vi.fn(() => ({ outcome: "PASS" as const, state }))
    const runHealthRecovery = vi.fn(() => ({ outcome: "INCOMPLETE" as const, state }))

    const result = source.runBaselineReconciliation(input(state), {
      runCatchUp,
      runHealthRecovery,
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(runCatchUp).not.toHaveBeenCalled()
    expect(runHealthRecovery).toHaveBeenCalledOnce()
  })

  it("treats requested confirmations as an idempotent subset at the current high-water", async () => {
    const source = (await import("../db-quality-gate/reconciliation")) as ReconciliationModule
    const state: BaselineState = {
      checkedAt: "2026-08-23T07:00:00.000Z",
      confirmedMigrations: [
        {
          liveName: "prior",
          liveVersion: "20260822070000",
          path: "supabase/migrations/20260822070000_prior.sql",
          sha256: "1".repeat(64),
        },
        confirmation,
      ],
      generation: "current",
      healthy: true,
      migrationHighWater: LIVE_VERSION,
      schemaVersion: 1,
      sourceCommit: "b".repeat(40),
    }
    const runCatchUp = vi.fn(() => ({ outcome: "PASS" as const, state }))
    const runHealthRecovery = vi.fn(() => ({ outcome: "PASS" as const, state }))

    const result = source.runBaselineReconciliation(input(state), {
      runCatchUp,
      runHealthRecovery,
    })

    expect(result).toEqual({ outcome: "PASS", state })
    expect(runCatchUp).not.toHaveBeenCalled()
    expect(runHealthRecovery).not.toHaveBeenCalled()
  })
})
