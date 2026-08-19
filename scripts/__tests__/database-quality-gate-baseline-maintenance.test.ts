import { describe, expect, it } from "vitest"

import {
  fixtureWithStaticMetadata,
  repositoryHead,
} from "./database-quality-gate-static-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type MigrationIdentity = {
  path: string
  sha256: string
}

type ConfirmedLiveMigration = MigrationIdentity & {
  liveName: string
  liveVersion: string
}

type BaselineState = {
  checkedAt: string
  confirmedMigrations: ConfirmedLiveMigration[]
  generation: string
  healthy: boolean
  migrationHighWater: string
  recovery?: {
    kind: "catch-up" | "full-refresh"
    runId: string
    targetMigrationHighWater: string
  }
  schemaVersion: 1
  sourceCommit: string
}

type DatabaseObservation = {
  healthy: boolean
  invalidIndexCount: number
  migrationHighWater: string
  migrationRecords: Array<{
    liveName: string
    liveVersion: string
    sqlSha256: string
  }>
  unvalidatedConstraintCount: number
}

type MaintenanceResult = {
  outcome: "INCOMPLETE" | "PASS"
  state: BaselineState
}

type MaintenanceExecutor = {
  acquireLock: (runId: string) => boolean
  applyMigrations: (databaseName: string, migrations: ConfirmedLiveMigration[]) => boolean
  createRefreshDatabase: (databaseName: string) => boolean
  dropDatabase: (databaseName: string) => boolean
  inspectDatabase: (databaseName: string) => DatabaseObservation | undefined
  publishState: (state: BaselineState) => boolean
  readState: () => BaselineState | undefined
  releaseLock: (runId: string) => boolean
  restoreDump: (databaseName: string, dumpPath: string) => boolean
  swapBaseline: (databaseName: string, retiredDatabaseName: string) => boolean
}

type BaselineMaintenanceModule = {
  baselineStateHash: (state: BaselineState) => string
  isBaselineForwardEvidenceReusable: (
    report: {
      baselineMigrationHighWater: string
      inputHashes: Record<string, string>
      outcome: "INCOMPLETE" | "PASS"
    },
    state: BaselineState
  ) => boolean
  runBaselineCatchUp: (input: {
    checkedAt: string
    confirmedMigrations: ConfirmedLiveMigration[]
    executor: MaintenanceExecutor
    repositoryRoot: string
    runId: string
    sourceCommit: string
  }) => MaintenanceResult
  runBaselineFullRefresh: (input: {
    checkedAt: string
    confirmedMigrations: ConfirmedLiveMigration[]
    dumpPath: string
    executor: MaintenanceExecutor
    repositoryRoot: string
    runId: string
    sourceCommit: string
  }) => MaintenanceResult
  runBaselineHealthRecovery: (input: {
    checkedAt: string
    confirmedMigrations: ConfirmedLiveMigration[]
    executor: MaintenanceExecutor
    runId: string
    sourceCommit: string
  }) => MaintenanceResult
}

const migration: ConfirmedLiveMigration = {
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819031200_confirmed_live_change.sql",
  sha256: "17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
}

function confirmedFixture() {
  const repository = fixtureWithStaticMetadata({
    path: migration.path,
    sql: "SELECT 1;\n",
  })

  return {
    repositoryRoot: repository.root,
    sourceCommit: repositoryHead(repository.root),
  }
}

function healthyState(): BaselineState {
  return {
    checkedAt: "2026-08-18T12:00:00Z",
    confirmedMigrations: [],
    generation: "phase4-baseline",
    healthy: true,
    migrationHighWater: "20260816044031",
    schemaVersion: 1,
    sourceCommit: "a".repeat(40),
  }
}

class FakeMaintenanceExecutor implements MaintenanceExecutor {
  currentState: BaselineState | undefined = healthyState()
  failAt?: string
  observations = new Map<string, DatabaseObservation>([
    [
      "qltbyt_test",
      {
        healthy: true,
        invalidIndexCount: 0,
        migrationHighWater: migration.liveVersion,
        migrationRecords: [
          {
            liveName: migration.liveName,
            liveVersion: migration.liveVersion,
            sqlSha256: migration.sha256,
          },
        ],
        unvalidatedConstraintCount: 0,
      },
    ],
    [
      "dq_baseline_refresh_phase5_refresh",
      {
        healthy: true,
        invalidIndexCount: 0,
        migrationHighWater: migration.liveVersion,
        migrationRecords: [
          {
            liveName: migration.liveName,
            liveVersion: migration.liveVersion,
            sqlSha256: migration.sha256,
          },
        ],
        unvalidatedConstraintCount: 0,
      },
    ],
  ])
  operations: string[] = []

  acquireLock(runId: string): boolean {
    return this.record(`acquire-lock:${runId}`)
  }

  releaseLock(runId: string): boolean {
    return this.record(`release-lock:${runId}`)
  }

  readState(): BaselineState | undefined {
    this.operations.push("read-state")
    return this.currentState === undefined ? undefined : structuredClone(this.currentState)
  }

  publishState(state: BaselineState): boolean {
    const status = state.healthy ? "healthy" : "unhealthy"
    if (!this.record(`publish-state:${status}:${state.migrationHighWater}`)) {
      return false
    }
    this.currentState = structuredClone(state)
    return true
  }

  inspectDatabase(databaseName: string): DatabaseObservation | undefined {
    if (!this.record(`inspect:${databaseName}`)) {
      return undefined
    }
    return structuredClone(this.observations.get(databaseName))
  }

  applyMigrations(databaseName: string, migrations: ConfirmedLiveMigration[]): boolean {
    return this.record(
      `apply:${databaseName}:${migrations.map((item) => item.liveVersion).join(",")}`
    )
  }

  createRefreshDatabase(databaseName: string): boolean {
    return this.record(`create-refresh:${databaseName}`)
  }

  restoreDump(databaseName: string, dumpPath: string): boolean {
    return this.record(`restore:${databaseName}:${dumpPath}`)
  }

  swapBaseline(databaseName: string, retiredDatabaseName: string): boolean {
    return this.record(`swap:${databaseName}:${retiredDatabaseName}`)
  }

  dropDatabase(databaseName: string): boolean {
    return this.record(`drop:${databaseName}`)
  }

  private record(operation: string): boolean {
    this.operations.push(operation)
    return this.failAt !== operation
  }
}

describe("database quality gate Phase 5 baseline maintenance", () => {
  it("publishes health and live high-water atomically after confirmed catch-up", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    const fixture = confirmedFixture()

    const result = source.runBaselineCatchUp({
      checkedAt: "2026-08-19T11:00:00Z",
      confirmedMigrations: [migration],
      executor,
      repositoryRoot: fixture.repositoryRoot,
      runId: "phase5-catch-up",
      sourceCommit: fixture.sourceCommit,
    })

    expect(result.outcome).toBe("PASS")
    expect(result.state).toMatchObject({
      confirmedMigrations: [migration],
      healthy: true,
      migrationHighWater: migration.liveVersion,
    })
    expect(executor.operations.indexOf("publish-state:unhealthy:20260816044031")).toBeLessThan(
      executor.operations.indexOf(`apply:qltbyt_test:${migration.liveVersion}`)
    )
    expect(executor.operations.indexOf("inspect:qltbyt_test")).toBeLessThan(
      executor.operations.indexOf(`publish-state:healthy:${migration.liveVersion}`)
    )
    expect(executor.operations.at(-1)).toBe("release-lock:phase5-catch-up")
  })

  it("rejects a catch-up migration that is not confirmed by exact live identity", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    const fixture = confirmedFixture()

    const result = source.runBaselineCatchUp({
      checkedAt: "2026-08-19T11:00:00Z",
      confirmedMigrations: [{ ...migration, sha256: "0".repeat(64) }],
      executor,
      repositoryRoot: fixture.repositoryRoot,
      runId: "phase5-unconfirmed",
      sourceCommit: fixture.sourceCommit,
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(executor.operations).not.toContain(`apply:qltbyt_test:${migration.liveVersion}`)
  })

  it("leaves the baseline unhealthy when catch-up is interrupted", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    const fixture = confirmedFixture()
    executor.failAt = `apply:qltbyt_test:${migration.liveVersion}`

    const result = source.runBaselineCatchUp({
      checkedAt: "2026-08-19T11:00:00Z",
      confirmedMigrations: [migration],
      executor,
      repositoryRoot: fixture.repositoryRoot,
      runId: "phase5-interrupted",
      sourceCommit: fixture.sourceCommit,
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.state.healthy).toBe(false)
    expect(result.state.recovery).toMatchObject({
      kind: "catch-up",
      targetMigrationHighWater: migration.liveVersion,
    })
    expect(executor.operations.at(-1)).toBe("release-lock:phase5-interrupted")
  })

  it("serializes full refresh and never publishes a staging database as healthy", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    const fixture = confirmedFixture()

    const result = source.runBaselineFullRefresh({
      checkedAt: "2026-08-19T11:00:00Z",
      confirmedMigrations: [migration],
      dumpPath: "/opt/supabase-test/backups/20260815T150001Z.dump",
      executor,
      repositoryRoot: fixture.repositoryRoot,
      runId: "phase5-refresh",
      sourceCommit: fixture.sourceCommit,
    })

    expect(result.outcome).toBe("PASS")
    expect(executor.operations[0]).toBe("acquire-lock:phase5-refresh")
    expect(executor.operations.indexOf("publish-state:unhealthy:20260816044031")).toBeLessThan(
      executor.operations.indexOf("create-refresh:dq_baseline_refresh_phase5_refresh")
    )
    expect(
      executor.operations.indexOf(
        "swap:dq_baseline_refresh_phase5_refresh:dq_baseline_retired_phase5_refresh"
      )
    ).toBeLessThan(executor.operations.indexOf(`publish-state:healthy:${migration.liveVersion}`))
    expect(executor.operations.at(-1)).toBe("release-lock:phase5-refresh")
  })

  it("keeps interrupted refresh unhealthy and does not swap the baseline", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    const fixture = confirmedFixture()
    executor.failAt =
      "restore:dq_baseline_refresh_phase5_refresh:/opt/supabase-test/backups/20260815T150001Z.dump"

    const result = source.runBaselineFullRefresh({
      checkedAt: "2026-08-19T11:00:00Z",
      confirmedMigrations: [migration],
      dumpPath: "/opt/supabase-test/backups/20260815T150001Z.dump",
      executor,
      repositoryRoot: fixture.repositoryRoot,
      runId: "phase5-refresh",
      sourceCommit: fixture.sourceCommit,
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.state.healthy).toBe(false)
    expect(executor.operations.some((operation) => operation.startsWith("swap:"))).toBe(false)
  })

  it("recovers only when health evidence matches the confirmed live target", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    executor.currentState = {
      ...healthyState(),
      healthy: false,
      recovery: {
        kind: "catch-up",
        runId: "phase5-interrupted",
        targetMigrationHighWater: migration.liveVersion,
      },
    }
    executor.observations.get("qltbyt_test")!.invalidIndexCount = 1

    const stale = source.runBaselineHealthRecovery({
      checkedAt: "2026-08-19T11:00:00Z",
      confirmedMigrations: [migration],
      executor,
      runId: "phase5-recovery-stale",
      sourceCommit: "f".repeat(40),
    })

    expect(stale.outcome).toBe("INCOMPLETE")
    expect(stale.state.healthy).toBe(false)

    executor.observations.get("qltbyt_test")!.invalidIndexCount = 0
    const recovered = source.runBaselineHealthRecovery({
      checkedAt: "2026-08-19T11:05:00Z",
      confirmedMigrations: [migration],
      executor,
      runId: "phase5-recovery",
      sourceCommit: "f".repeat(40),
    })

    expect(recovered.outcome).toBe("PASS")
    expect(recovered.state.healthy).toBe(true)
    expect(recovered.state.migrationHighWater).toBe(migration.liveVersion)
  })

  it("bootstraps the first healthy snapshot only from confirmed live evidence", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const executor = new FakeMaintenanceExecutor()
    executor.currentState = undefined

    const result = source.runBaselineHealthRecovery({
      checkedAt: "2026-08-19T11:10:00Z",
      confirmedMigrations: [migration],
      executor,
      runId: "phase5-bootstrap",
      sourceCommit: "f".repeat(40),
    })

    expect(result.outcome).toBe("PASS")
    expect(result.state).toMatchObject({
      confirmedMigrations: [migration],
      generation: "phase5-bootstrap",
      healthy: true,
      migrationHighWater: migration.liveVersion,
    })
  })

  it("invalidates baseline-forward evidence when generation or high-water changes", async () => {
    const source =
      await loadDatabaseQualityGateModule<BaselineMaintenanceModule>("baseline-maintenance")
    const state = healthyState()
    const report = {
      baselineMigrationHighWater: state.migrationHighWater,
      inputHashes: {
        baselineState: source.baselineStateHash(state),
      },
      outcome: "PASS" as const,
    }

    expect(source.isBaselineForwardEvidenceReusable(report, state)).toBe(true)
    expect(
      source.isBaselineForwardEvidenceReusable(report, {
        ...state,
        generation: "new-generation",
      })
    ).toBe(false)
    expect(
      source.isBaselineForwardEvidenceReusable(report, {
        ...state,
        migrationHighWater: migration.liveVersion,
      })
    ).toBe(false)
  })
})
