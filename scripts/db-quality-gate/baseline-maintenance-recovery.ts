import { BASELINE_STATE_SCHEMA_VERSION, compareConfirmedMigrations } from "./baseline-state"
import type { BaselineManifest } from "./baseline-manifest"
import type {
  BaselineRecovery,
  BaselineState,
  ConfirmedLiveMigration,
  DatabaseObservation,
  PersistedBaselineState,
} from "./baseline-state"

export type ConfirmedMigrationInput = ConfirmedLiveMigration & {
  content: string
}

export type MigrationMetadataStatus = "conflict" | "exact" | "missing"

export type BaselineMaintenanceExecutor = {
  acquireLock: (runId: string) => boolean
  applyMigration: (databaseName: string, migration: ConfirmedMigrationInput) => boolean
  applyMigrations: (databaseName: string, migrations: ConfirmedMigrationInput[]) => boolean
  cleanupMigrationRole: (databaseName: string) => boolean
  createRefreshDatabase: (databaseName: string) => boolean
  dropDatabase: (databaseName: string) => boolean
  inspectDatabase: (databaseName: string) => DatabaseObservation | undefined
  inspectMigrationMetadata: (
    databaseName: string,
    migration: ConfirmedMigrationInput
  ) => MigrationMetadataStatus | undefined
  preflightRoles: (databaseName: string) => boolean
  publishState: (state: BaselineState) => boolean
  readState: () => PersistedBaselineState | undefined
  recordMigrationMetadata: (databaseName: string, migration: ConfirmedMigrationInput) => boolean
  releaseLock: (runId: string) => boolean
  restoreDump: (databaseName: string, dumpPath: string) => boolean
  swapBaseline: (databaseName: string, retiredDatabaseName: string) => boolean
}

export type MaintenanceInput = {
  checkedAt: string
  executor: BaselineMaintenanceExecutor
  manifest: BaselineManifest
  repositoryRoot: string
  runId: string
}

export type RepositoryMaintenanceInput = MaintenanceInput

export type MaintenanceResult = {
  outcome: "INCOMPLETE" | "PASS"
  state: BaselineState
}

/** Creates a fail-closed result state when persisted baseline evidence is unavailable. */
export function unavailableState(input: MaintenanceInput): BaselineState {
  return {
    catalogSha256: input.manifest.catalogSha256,
    checkedAt: input.checkedAt,
    confirmedMigrations: [],
    generation: input.runId,
    healthy: false,
    migrationHighWater: "unavailable",
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: input.manifest.sourceCommit,
    technicalConfigurationCatalog: input.manifest.technicalConfigurationCatalog,
  }
}

/** Returns a valid v2 result state without upgrading legacy evidence implicitly. */
export function stateForResult(
  input: MaintenanceInput,
  state: PersistedBaselineState | undefined
): BaselineState {
  return state?.schemaVersion === BASELINE_STATE_SCHEMA_VERSION ? state : unavailableState(input)
}

/** Merges exact migration identities and rejects path, version, or target conflicts. */
export function mergeConfirmations(
  current: PersistedBaselineState,
  additions: ConfirmedLiveMigration[],
  targetMigrationHighWater: string
): ConfirmedLiveMigration[] | undefined {
  const byPath = new Map(current.confirmedMigrations.map((item) => [item.path, item]))
  const byVersion = new Map(current.confirmedMigrations.map((item) => [item.liveVersion, item]))
  for (const addition of additions) {
    const pathMatch = byPath.get(addition.path)
    const versionMatch = byVersion.get(addition.liveVersion)
    if (
      (pathMatch !== undefined &&
        (pathMatch.sha256 !== addition.sha256 ||
          pathMatch.liveName !== addition.liveName ||
          pathMatch.liveVersion !== addition.liveVersion)) ||
      (versionMatch !== undefined &&
        (versionMatch.sha256 !== addition.sha256 ||
          versionMatch.liveName !== addition.liveName ||
          versionMatch.path !== addition.path))
    ) {
      return undefined
    }
    byPath.set(addition.path, addition)
    byVersion.set(addition.liveVersion, addition)
  }

  const confirmations = [...byPath.values()].sort(compareConfirmedMigrations)
  return confirmations.at(-1)?.liveVersion === targetMigrationHighWater ? confirmations : undefined
}

/** Creates one unhealthy, phase-specific state snapshot for deterministic recovery. */
export function recoveryState(
  input: MaintenanceInput,
  confirmedMigrations: ConfirmedLiveMigration[],
  kind: BaselineRecovery["kind"],
  migration: ConfirmedLiveMigration,
  phase: BaselineRecovery["phase"]
): BaselineState {
  const ordered = [...confirmedMigrations].sort(compareConfirmedMigrations)
  return {
    catalogSha256: input.manifest.catalogSha256,
    checkedAt: input.checkedAt,
    confirmedMigrations: ordered,
    generation: input.runId,
    healthy: false,
    migrationHighWater: ordered.at(-1)?.liveVersion ?? "unavailable",
    recovery: {
      kind,
      migration,
      phase,
      runId: input.runId,
      targetMigrationHighWater: input.manifest.targetMigrationHighWater,
    },
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: input.manifest.sourceCommit,
    technicalConfigurationCatalog: input.manifest.technicalConfigurationCatalog,
  }
}

/** Creates the final healthy state bound to the complete target manifest. */
export function healthyState(
  input: MaintenanceInput,
  confirmedMigrations: ConfirmedLiveMigration[]
): BaselineState {
  return {
    catalogSha256: input.manifest.catalogSha256,
    checkedAt: input.checkedAt,
    confirmedMigrations: [...confirmedMigrations].sort(compareConfirmedMigrations),
    generation: input.runId,
    healthy: true,
    migrationHighWater: input.manifest.targetMigrationHighWater,
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: input.manifest.sourceCommit,
    technicalConfigurationCatalog: input.manifest.technicalConfigurationCatalog,
  }
}

/** Runs one maintenance operation under the global lease and fail-closes on errors. */
export function lockedResult(
  input: MaintenanceInput,
  operation: () => MaintenanceResult
): MaintenanceResult {
  if (!input.executor.acquireLock(input.runId)) {
    return {
      outcome: "INCOMPLETE",
      state: stateForResult(input, input.executor.readState()),
    }
  }

  let result: MaintenanceResult
  try {
    result = operation()
  } catch {
    result = {
      outcome: "INCOMPLETE",
      state: stateForResult(input, input.executor.readState()),
    }
  }

  if (!input.executor.releaseLock(input.runId)) {
    return { outcome: "INCOMPLETE", state: result.state }
  }
  return result
}
