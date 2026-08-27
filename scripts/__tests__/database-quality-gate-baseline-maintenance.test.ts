import { describe, expect, it } from "vitest"

import {
  fixtureWithStaticMetadata,
  repositoryHead,
} from "./database-quality-gate-static-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

const currentMigration = {
  liveName: "current_live_change",
  liveVersion: "20260818000000",
  path: "supabase/migrations/20260818000000_current_live_change.sql",
  sha256: "a".repeat(64),
}

const targetMigration = {
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819062043_confirmed_live_change.sql",
  sha256: "17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
}

const targetRoutine = {
  definitionSha256: "b".repeat(64),
  executeGrantees: ["authenticated"],
  executionMode: "definer" as const,
  identity: "public.technical_configuration_target()",
  owner: "postgres",
  searchPath: "public, pg_temp",
}

type State = {
  catalogSha256: string
  checkedAt: string
  confirmedMigrations: (typeof targetMigration)[]
  generation: string
  healthy: boolean
  migrationHighWater: string
  recovery?: { phase: string }
  schemaVersion: 2
  sourceCommit: string
  technicalConfigurationCatalog: (typeof targetRoutine)[]
}

type Manifest = {
  catalogSha256: string
  migrations: (typeof targetMigration)[]
  schemaVersion: 1
  sourceCommit: string
  targetMigrationHighWater: string
  technicalConfigurationCatalog: (typeof targetRoutine)[]
}

class RefreshExecutor {
  applySucceeds = true
  currentState:
    | State
    | {
        checkedAt: string
        confirmedMigrations: (typeof currentMigration)[]
        generation: string
        healthy: boolean
        migrationHighWater: string
        schemaVersion: 1
        sourceCommit: string
      }
  metadataStatus: "exact" | "missing" = "missing"
  operations: string[] = []
  observation: Record<string, unknown>
  retiredDropSucceeds = true

  constructor(observation: Record<string, unknown>) {
    this.observation = observation
    this.currentState = {
      checkedAt: "2026-08-26T00:00:00Z",
      confirmedMigrations: [currentMigration],
      generation: "legacy-baseline",
      healthy: true,
      migrationHighWater: currentMigration.liveVersion,
      schemaVersion: 1,
      sourceCommit: "c".repeat(40),
    }
  }

  acquireLock(runId: string) {
    return this.record(`acquire:${runId}`)
  }

  releaseLock(runId: string) {
    return this.record(`release:${runId}`)
  }

  readState() {
    return this.currentState
  }

  publishState(state: State) {
    this.currentState = state
    return this.record(`publish:${state.healthy ? "healthy" : state.recovery?.phase}`)
  }

  preflightRoles(databaseName: string) {
    return this.record(`preflight:${databaseName}`)
  }

  createRefreshDatabase(databaseName: string) {
    return this.record(`create:${databaseName}`)
  }

  restoreDump(databaseName: string, dumpPath: string) {
    return this.record(`restore:${databaseName}:${dumpPath}`)
  }

  inspectMigrationMetadata(databaseName: string) {
    this.operations.push(`metadata:${databaseName}:${this.metadataStatus}`)
    return this.metadataStatus
  }

  applyMigration(databaseName: string) {
    this.operations.push(`apply:${databaseName}`)
    return this.applySucceeds
  }

  applyMigrations() {
    return false
  }

  recordMigrationMetadata(databaseName: string) {
    this.operations.push(`record:${databaseName}`)
    this.metadataStatus = "exact"
    return true
  }

  cleanupMigrationRole() {
    return true
  }

  inspectDatabase(databaseName: string) {
    this.operations.push(`inspect:${databaseName}`)
    return this.observation
  }

  swapBaseline(databaseName: string, retiredDatabaseName: string) {
    return this.record(`swap:${databaseName}:${retiredDatabaseName}`)
  }

  dropDatabase(databaseName: string) {
    this.operations.push(`drop:${databaseName}`)
    return databaseName.startsWith("dq_baseline_retired_") ? this.retiredDropSucceeds : true
  }

  private record(operation: string) {
    this.operations.push(operation)
    return true
  }
}

type MaintenanceModule = {
  baselineStateHash: (state: State) => string
  isBaselineForwardEvidenceReusable: (
    report: {
      baselineMigrationHighWater: string
      inputHashes: Record<string, string>
      outcome: "INCOMPLETE" | "PASS"
    },
    state: State
  ) => boolean
  runBaselineFullRefresh: (input: {
    checkedAt: string
    dumpPath: string
    executor: RefreshExecutor
    manifest: Manifest
    repositoryRoot: string
    runId: string
  }) => { outcome: "INCOMPLETE" | "PASS"; state: State }
}

type ManifestModule = {
  technicalConfigurationCatalogSha256: (catalog: (typeof targetRoutine)[]) => string
}

async function fixture() {
  const repository = fixtureWithStaticMetadata({
    path: targetMigration.path,
    sql: "SELECT 1;\n",
  })
  const sourceCommit = repositoryHead(repository.root)
  const catalogSource = await loadDatabaseQualityGateModule<ManifestModule>("baseline-manifest")
  const catalogSha256 = catalogSource.technicalConfigurationCatalogSha256([targetRoutine])
  const manifest: Manifest = {
    catalogSha256,
    migrations: [targetMigration],
    schemaVersion: 1,
    sourceCommit,
    targetMigrationHighWater: targetMigration.liveVersion,
    technicalConfigurationCatalog: [targetRoutine],
  }
  const observation = {
    catalogSha256,
    healthy: true,
    invalidIndexCount: 0,
    migrationHighWater: targetMigration.liveVersion,
    migrationRecords: [currentMigration, targetMigration].map((migration) => ({
      liveName: migration.liveName,
      liveVersion: migration.liveVersion,
      sqlSha256: migration.sha256,
    })),
    postgresHasCreateOnPublic: false,
    technicalConfigurationCatalog: [targetRoutine],
    unvalidatedConstraintCount: 0,
  }
  return { manifest, observation, repositoryRoot: repository.root }
}

describe("database quality gate Oracle baseline maintenance", () => {
  it("upgrades v1 state through role-safe full refresh before swapping the baseline", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const executor = new RefreshExecutor(input.observation)

    const result = source.runBaselineFullRefresh({
      checkedAt: "2026-08-27T00:00:00Z",
      dumpPath: "/opt/supabase-test/backups/verified.dump",
      executor,
      manifest: input.manifest,
      repositoryRoot: input.repositoryRoot,
      runId: "issue955-refresh",
    })

    expect(result.outcome).toBe("PASS")
    expect(result.state).toMatchObject({
      catalogSha256: input.manifest.catalogSha256,
      healthy: true,
      schemaVersion: 2,
    })
    expect(executor.operations).toContain(
      "swap:dq_baseline_refresh_issue955_refresh:dq_baseline_retired_issue955_refresh"
    )
    expect(executor.operations.indexOf("publish:prepared")).toBeLessThan(
      executor.operations.findIndex((operation) => operation.startsWith("apply:"))
    )
  })

  it("keeps full refresh unhealthy and drops staging when migration SQL fails", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const executor = new RefreshExecutor(input.observation)
    executor.applySucceeds = false

    const result = source.runBaselineFullRefresh({
      checkedAt: "2026-08-27T00:00:00Z",
      dumpPath: "/opt/supabase-test/backups/verified.dump",
      executor,
      manifest: input.manifest,
      repositoryRoot: input.repositoryRoot,
      runId: "issue955-interrupted",
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.state).toMatchObject({
      healthy: false,
      recovery: { phase: "prepared" },
    })
    expect(executor.operations.some((operation) => operation.startsWith("swap:"))).toBe(false)
    expect(executor.operations).toContain("drop:dq_baseline_refresh_issue955_interrupted")
  })

  it("fails closed before publishing healthy when retired database cleanup fails", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const executor = new RefreshExecutor(input.observation)
    executor.retiredDropSucceeds = false

    const result = source.runBaselineFullRefresh({
      checkedAt: "2026-08-27T00:00:00Z",
      dumpPath: "/opt/supabase-test/backups/verified.dump",
      executor,
      manifest: input.manifest,
      repositoryRoot: input.repositoryRoot,
      runId: "issue955-retired-cleanup",
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.state).toMatchObject({
      healthy: false,
      recovery: { phase: "metadata-recorded" },
    })
    expect(executor.operations).toContain("drop:dq_baseline_retired_issue955_retired_cleanup")
    expect(executor.operations).not.toContain("publish:healthy")
  })

  it("invalidates reusable evidence when the catalog-bound state changes", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const state: State = {
      catalogSha256: input.manifest.catalogSha256,
      checkedAt: "2026-08-27T00:00:00Z",
      confirmedMigrations: [targetMigration],
      generation: "issue955-refresh",
      healthy: true,
      migrationHighWater: targetMigration.liveVersion,
      schemaVersion: 2,
      sourceCommit: input.manifest.sourceCommit,
      technicalConfigurationCatalog: [targetRoutine],
    }
    const report = {
      baselineMigrationHighWater: state.migrationHighWater,
      inputHashes: { baselineState: source.baselineStateHash(state) },
      outcome: "PASS" as const,
    }

    expect(source.isBaselineForwardEvidenceReusable(report, state)).toBe(true)
    expect(
      source.isBaselineForwardEvidenceReusable(report, {
        ...state,
        generation: "issue955-health",
      })
    ).toBe(false)
  })
})
