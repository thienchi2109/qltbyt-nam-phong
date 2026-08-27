import { describe, expect, it } from "vitest"

import {
  fixtureWithStaticMetadata,
  repositoryHead,
} from "./database-quality-gate-static-test-support"
import { loadDatabaseQualityGateModule } from "./database-quality-gate-test-support"

type Migration = {
  liveName: string
  liveVersion: string
  path: string
  sha256: string
}

type Routine = {
  definitionSha256: string
  executeGrantees: string[]
  executionMode: "definer" | "invoker"
  identity: string
  owner: string
  searchPath: string | null
}

type State = {
  catalogSha256: string
  checkedAt: string
  confirmedMigrations: Migration[]
  generation: string
  healthy: boolean
  migrationHighWater: string
  recovery?: {
    kind: "catch-up" | "full-refresh"
    migration: Migration
    phase: "metadata-recorded" | "prepared" | "sql-applied"
    runId: string
    targetMigrationHighWater: string
  }
  schemaVersion: 2
  sourceCommit: string
  technicalConfigurationCatalog: Routine[]
}

type Manifest = {
  catalogSha256: string
  migrations: Migration[]
  schemaVersion: 1
  sourceCommit: string
  targetMigrationHighWater: string
  technicalConfigurationCatalog: Routine[]
}

type Observation = {
  catalogSha256: string
  healthy: true
  invalidIndexCount: number
  migrationHighWater: string
  migrationRecords: Array<{
    liveName: string
    liveVersion: string
    sqlSha256: string
  }>
  postgresHasCreateOnPublic: boolean
  technicalConfigurationCatalog: Routine[]
  unvalidatedConstraintCount: number
}

type MetadataStatus = "conflict" | "exact" | "missing"

class RecoveryExecutor {
  applySucceeds = true
  currentState: State
  metadataStatus: MetadataStatus = "missing"
  observation: Observation
  operations: string[] = []
  recordMetadataSucceeds = true

  constructor(currentState: State, observation: Observation) {
    this.currentState = currentState
    this.observation = observation
  }

  acquireLock(runId: string) {
    return this.record(`acquire-lock:${runId}`)
  }

  releaseLock(runId: string) {
    return this.record(`release-lock:${runId}`)
  }

  readState() {
    return this.currentState
  }

  publishState(state: State) {
    this.currentState = state
    return this.record(`publish:${state.healthy ? "healthy" : state.recovery?.phase}`)
  }

  preflightRoles(databaseName: string) {
    return this.record(`preflight-roles:${databaseName}`)
  }

  inspectMigrationMetadata(_databaseName: string, migration: Migration) {
    this.operations.push(`inspect-metadata:${migration.liveVersion}:${this.metadataStatus}`)
    return this.metadataStatus
  }

  applyMigration(_databaseName: string, migration: Migration & { content: string }) {
    this.operations.push(`apply-sql:${migration.liveVersion}`)
    return this.applySucceeds
  }

  recordMigrationMetadata(_databaseName: string, migration: Migration & { content: string }) {
    this.operations.push(`record-metadata:${migration.liveVersion}`)
    if (this.recordMetadataSucceeds) {
      this.metadataStatus = "exact"
    }
    return this.recordMetadataSucceeds
  }

  cleanupMigrationRole(databaseName: string) {
    return this.record(`cleanup-role:${databaseName}`)
  }

  inspectDatabase(databaseName: string) {
    this.operations.push(`inspect-database:${databaseName}`)
    return this.observation
  }

  createRefreshDatabase() {
    return false
  }

  restoreDump() {
    return false
  }

  swapBaseline() {
    return false
  }

  dropDatabase() {
    return false
  }

  private record(operation: string) {
    this.operations.push(operation)
    return true
  }
}

type MaintenanceModule = {
  runBaselineCatchUp: (input: {
    checkedAt: string
    executor: RecoveryExecutor
    manifest: Manifest
    repositoryRoot: string
    runId: string
  }) => { outcome: "INCOMPLETE" | "PASS"; state: State }
  runBaselineHealthRecovery: (input: {
    checkedAt: string
    executor: RecoveryExecutor
    manifest: Manifest
    repositoryRoot: string
    runId: string
  }) => { outcome: "INCOMPLETE" | "PASS"; state: State }
}

type ManifestModule = {
  technicalConfigurationCatalogSha256: (catalog: Routine[]) => string
}

const currentMigration: Migration = {
  liveName: "current_live_change",
  liveVersion: "20260818000000",
  path: "supabase/migrations/20260818000000_current_live_change.sql",
  sha256: "a".repeat(64),
}

const targetMigration: Migration = {
  liveName: "confirmed_live_change",
  liveVersion: "20260819062043",
  path: "supabase/migrations/20260819062043_confirmed_live_change.sql",
  sha256: "17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a",
}

const currentRoutine: Routine = {
  definitionSha256: "b".repeat(64),
  executeGrantees: ["authenticated"],
  executionMode: "definer",
  identity: "public.technical_configuration_current()",
  owner: "postgres",
  searchPath: "public, pg_temp",
}

const targetRoutine: Routine = {
  definitionSha256: "c".repeat(64),
  executeGrantees: ["authenticated"],
  executionMode: "definer",
  identity: "public.technical_configuration_target()",
  owner: "postgres",
  searchPath: "public, pg_temp",
}

async function fixture() {
  const repository = fixtureWithStaticMetadata({
    path: targetMigration.path,
    sql: "SELECT 1;\n",
  })
  const sourceCommit = repositoryHead(repository.root)
  const manifestSource = await loadDatabaseQualityGateModule<ManifestModule>("baseline-manifest")
  const catalogSha256 = manifestSource.technicalConfigurationCatalogSha256([targetRoutine])
  const currentCatalogSha256 = manifestSource.technicalConfigurationCatalogSha256([currentRoutine])
  const manifest: Manifest = {
    catalogSha256,
    migrations: [targetMigration],
    schemaVersion: 1,
    sourceCommit,
    targetMigrationHighWater: targetMigration.liveVersion,
    technicalConfigurationCatalog: [targetRoutine],
  }
  const currentState: State = {
    catalogSha256: currentCatalogSha256,
    checkedAt: "2026-08-26T00:00:00Z",
    confirmedMigrations: [currentMigration],
    generation: "existing-baseline",
    healthy: true,
    migrationHighWater: currentMigration.liveVersion,
    schemaVersion: 2,
    sourceCommit: "d".repeat(40),
    technicalConfigurationCatalog: [currentRoutine],
  }
  const observation: Observation = {
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
  return { currentState, manifest, observation, repositoryRoot: repository.root }
}

describe("database quality gate Oracle baseline catch-up recovery", () => {
  it("persists sql-applied before metadata and leaves that recovery state on metadata failure", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const executor = new RecoveryExecutor(input.currentState, input.observation)
    executor.recordMetadataSucceeds = false

    const result = source.runBaselineCatchUp({
      checkedAt: "2026-08-27T00:00:00Z",
      executor,
      manifest: input.manifest,
      repositoryRoot: input.repositoryRoot,
      runId: "issue955-catch-up",
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.state.recovery).toMatchObject({
      migration: targetMigration,
      phase: "sql-applied",
    })
    expect(executor.operations).toEqual(
      expect.arrayContaining([
        "preflight-roles:qltbyt_test",
        `apply-sql:${targetMigration.liveVersion}`,
        "publish:sql-applied",
        `record-metadata:${targetMigration.liveVersion}`,
      ])
    )
    expect(executor.operations).not.toContain("publish:healthy")
  })

  it("recovers missing metadata from sql-applied without replaying migration SQL", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const recoveringState: State = {
      ...input.currentState,
      checkedAt: "2026-08-27T00:00:00Z",
      healthy: false,
      recovery: {
        kind: "catch-up",
        migration: targetMigration,
        phase: "sql-applied",
        runId: "interrupted-catch-up",
        targetMigrationHighWater: targetMigration.liveVersion,
      },
      sourceCommit: input.manifest.sourceCommit,
    }
    const executor = new RecoveryExecutor(recoveringState, input.observation)

    const result = source.runBaselineHealthRecovery({
      checkedAt: "2026-08-27T00:05:00Z",
      executor,
      manifest: input.manifest,
      repositoryRoot: input.repositoryRoot,
      runId: "issue955-health",
    })

    expect(result.outcome).toBe("PASS")
    expect(executor.operations).toContain(`record-metadata:${targetMigration.liveVersion}`)
    expect(executor.operations.some((operation) => operation.startsWith("apply-sql:"))).toBe(false)
    expect(executor.operations).toContain("publish:healthy")
  })

  it("cleans leaked role privilege but fails closed from prepared recovery", async () => {
    const source = await loadDatabaseQualityGateModule<MaintenanceModule>("baseline-maintenance")
    const input = await fixture()
    const executor = new RecoveryExecutor(
      {
        ...input.currentState,
        healthy: false,
        recovery: {
          kind: "catch-up",
          migration: targetMigration,
          phase: "prepared",
          runId: "interrupted-catch-up",
          targetMigrationHighWater: targetMigration.liveVersion,
        },
        sourceCommit: input.manifest.sourceCommit,
      },
      input.observation
    )

    const result = source.runBaselineHealthRecovery({
      checkedAt: "2026-08-27T00:05:00Z",
      executor,
      manifest: input.manifest,
      repositoryRoot: input.repositoryRoot,
      runId: "issue955-health",
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(executor.operations).toContain("cleanup-role:qltbyt_test")
    expect(executor.operations.some((operation) => operation.startsWith("apply-sql:"))).toBe(false)
    expect(executor.operations.some((operation) => operation.startsWith("record-metadata:"))).toBe(
      false
    )
  })
})
