import {
  BASELINE_STATE_SCHEMA_VERSION,
  compareConfirmedMigrations,
  observationMatches,
  ORACLE_BASELINE_DATABASE,
  validConfirmation,
} from "./baseline-state"
import type {
  BaselineRecovery,
  BaselineState,
  ConfirmedLiveMigration,
  DatabaseObservation,
} from "./baseline-state"
import { readFileAtCommit } from "./git-evidence"
import { canonicalizeMigrationContent, migrationContentSha256 } from "./migration-source"
export { baselineStateHash, isBaselineForwardEvidenceReusable } from "./baseline-state"
export type { BaselineState, ConfirmedLiveMigration } from "./baseline-state"

export type ConfirmedMigrationInput = ConfirmedLiveMigration & {
  content: string
}

export type BaselineMaintenanceExecutor = {
  acquireLock: (runId: string) => boolean
  applyMigrations: (databaseName: string, migrations: ConfirmedMigrationInput[]) => boolean
  createRefreshDatabase: (databaseName: string) => boolean
  dropDatabase: (databaseName: string) => boolean
  inspectDatabase: (databaseName: string) => DatabaseObservation | undefined
  publishState: (state: BaselineState) => boolean
  readState: () => BaselineState | undefined
  releaseLock: (runId: string) => boolean
  restoreDump: (databaseName: string, dumpPath: string) => boolean
  swapBaseline: (databaseName: string, retiredDatabaseName: string) => boolean
}

type MaintenanceResult = {
  outcome: "INCOMPLETE" | "PASS"
  state: BaselineState
}

type MaintenanceInput = {
  checkedAt: string
  confirmedMigrations: ConfirmedLiveMigration[]
  executor: BaselineMaintenanceExecutor
  runId: string
  sourceCommit: string
}

type RepositoryMaintenanceInput = MaintenanceInput & {
  repositoryRoot: string
}

function unavailableState(input: MaintenanceInput): BaselineState {
  return {
    checkedAt: input.checkedAt,
    confirmedMigrations: [],
    generation: input.runId,
    healthy: false,
    migrationHighWater: "unavailable",
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: input.sourceCommit,
  }
}

function unhealthyState(
  current: BaselineState,
  input: MaintenanceInput,
  kind: BaselineRecovery["kind"],
  targetMigrationHighWater: string
): BaselineState {
  return {
    ...current,
    checkedAt: input.checkedAt,
    healthy: false,
    recovery: {
      kind,
      runId: input.runId,
      targetMigrationHighWater,
    },
    sourceCommit: input.sourceCommit,
  }
}

function healthyState(
  input: MaintenanceInput,
  confirmedMigrations: ConfirmedLiveMigration[]
): BaselineState {
  return {
    checkedAt: input.checkedAt,
    confirmedMigrations: [...confirmedMigrations].sort(compareConfirmedMigrations),
    generation: input.runId,
    healthy: true,
    migrationHighWater: confirmedMigrations.at(-1)?.liveVersion ?? "unavailable",
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: input.sourceCommit,
  }
}

function readConfirmedMigrationInputs(
  input: RepositoryMaintenanceInput
): ConfirmedMigrationInput[] | undefined {
  const ordered = [...input.confirmedMigrations].sort(compareConfirmedMigrations)
  const versions = new Set<string>()
  const paths = new Set<string>()
  const migrations: ConfirmedMigrationInput[] = []

  for (const confirmation of ordered) {
    if (
      !validConfirmation(confirmation) ||
      versions.has(confirmation.liveVersion) ||
      paths.has(confirmation.path)
    ) {
      return undefined
    }
    const content = readFileAtCommit(input.repositoryRoot, input.sourceCommit, confirmation.path)
    if (content === undefined || migrationContentSha256(content) !== confirmation.sha256) {
      return undefined
    }
    versions.add(confirmation.liveVersion)
    paths.add(confirmation.path)
    migrations.push({
      ...confirmation,
      content: canonicalizeMigrationContent(content),
    })
  }

  return migrations
}

function mergedConfirmations(
  current: BaselineState,
  additions: ConfirmedLiveMigration[]
): ConfirmedLiveMigration[] | undefined {
  const byPath = new Map(current.confirmedMigrations.map((item) => [item.path, item]))
  for (const addition of additions) {
    const existing = byPath.get(addition.path)
    if (
      existing !== undefined &&
      (existing.sha256 !== addition.sha256 ||
        existing.liveName !== addition.liveName ||
        existing.liveVersion !== addition.liveVersion)
    ) {
      return undefined
    }
    byPath.set(addition.path, addition)
  }

  return [...byPath.values()].sort(compareConfirmedMigrations)
}

function lockedResult(
  input: MaintenanceInput,
  operation: () => MaintenanceResult
): MaintenanceResult {
  if (!input.executor.acquireLock(input.runId)) {
    return {
      outcome: "INCOMPLETE",
      state: input.executor.readState() ?? unavailableState(input),
    }
  }

  let result: MaintenanceResult
  try {
    result = operation()
  } catch {
    result = {
      outcome: "INCOMPLETE",
      state: input.executor.readState() ?? unavailableState(input),
    }
  }

  if (!input.executor.releaseLock(input.runId)) {
    return {
      outcome: "INCOMPLETE",
      state: result.state,
    }
  }
  return result
}

/** Applies only exact local identities that were independently confirmed as applied live. */
export function runBaselineCatchUp(input: RepositoryMaintenanceInput): MaintenanceResult {
  return lockedResult(input, () => {
    const current = input.executor.readState()
    const migrations = readConfirmedMigrationInputs(input)
    if (current === undefined || !current.healthy || migrations === undefined) {
      return {
        outcome: "INCOMPLETE",
        state: current ?? unavailableState(input),
      }
    }
    const confirmations = mergedConfirmations(current, migrations)
    if (
      confirmations === undefined ||
      migrations.some((migration) => migration.liveVersion <= current.migrationHighWater)
    ) {
      return { outcome: "INCOMPLETE", state: current }
    }

    const targetHighWater = confirmations.at(-1)?.liveVersion ?? "unavailable"
    const unhealthy = unhealthyState(current, input, "catch-up", targetHighWater)
    if (!input.executor.publishState(unhealthy)) {
      return { outcome: "INCOMPLETE", state: current }
    }
    if (
      !input.executor.applyMigrations(ORACLE_BASELINE_DATABASE, migrations) ||
      !observationMatches(input.executor.inspectDatabase(ORACLE_BASELINE_DATABASE), confirmations)
    ) {
      return { outcome: "INCOMPLETE", state: unhealthy }
    }

    const healthy = healthyState(input, confirmations)
    return input.executor.publishState(healthy)
      ? { outcome: "PASS", state: healthy }
      : { outcome: "INCOMPLETE", state: unhealthy }
  })
}

function refreshDatabaseName(kind: "refresh" | "retired", runId: string): string | undefined {
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(runId)) {
    return undefined
  }
  const normalized = runId.replaceAll("-", "_")
  const value = `dq_baseline_${kind}_${normalized}`
  return value.length <= 63 ? value : undefined
}

function validDumpPath(dumpPath: string): boolean {
  return (
    dumpPath.startsWith("/opt/supabase-test/backups/") &&
    !dumpPath.split("/").includes("..") &&
    dumpPath.endsWith(".dump")
  )
}

/** Restores into a disposable database and swaps it in only after complete health verification. */
export function runBaselineFullRefresh(
  input: RepositoryMaintenanceInput & { dumpPath: string }
): MaintenanceResult {
  return lockedResult(input, () => {
    const current = input.executor.readState()
    const migrations = readConfirmedMigrationInputs(input)
    const refreshDatabase = refreshDatabaseName("refresh", input.runId)
    const retiredDatabase = refreshDatabaseName("retired", input.runId)
    if (
      current === undefined ||
      migrations === undefined ||
      refreshDatabase === undefined ||
      retiredDatabase === undefined ||
      !validDumpPath(input.dumpPath)
    ) {
      return {
        outcome: "INCOMPLETE",
        state: current ?? unavailableState(input),
      }
    }

    const confirmations = [...migrations].sort(compareConfirmedMigrations)
    const targetHighWater = confirmations.at(-1)?.liveVersion ?? "unavailable"
    const unhealthy = unhealthyState(current, input, "full-refresh", targetHighWater)
    if (
      !input.executor.publishState(unhealthy) ||
      !input.executor.createRefreshDatabase(refreshDatabase)
    ) {
      return { outcome: "INCOMPLETE", state: unhealthy }
    }

    let swapped = false
    try {
      if (
        !input.executor.restoreDump(refreshDatabase, input.dumpPath) ||
        !input.executor.applyMigrations(refreshDatabase, migrations) ||
        !observationMatches(input.executor.inspectDatabase(refreshDatabase), confirmations) ||
        !input.executor.swapBaseline(refreshDatabase, retiredDatabase)
      ) {
        return { outcome: "INCOMPLETE", state: unhealthy }
      }
      swapped = true
      if (
        !observationMatches(input.executor.inspectDatabase(ORACLE_BASELINE_DATABASE), confirmations)
      ) {
        return { outcome: "INCOMPLETE", state: unhealthy }
      }
      const healthy = healthyState(input, confirmations)
      if (!input.executor.publishState(healthy)) {
        return { outcome: "INCOMPLETE", state: unhealthy }
      }
      input.executor.dropDatabase(retiredDatabase)
      return { outcome: "PASS", state: healthy }
    } finally {
      if (!swapped) {
        input.executor.dropDatabase(refreshDatabase)
      }
    }
  })
}

/** Republishes healthy state only after current Oracle facts match exact live confirmations. */
export function runBaselineHealthRecovery(input: MaintenanceInput): MaintenanceResult {
  return lockedResult(input, () => {
    const current = input.executor.readState()
    const confirmations = [...input.confirmedMigrations].sort(compareConfirmedMigrations)
    if (
      current?.healthy ||
      confirmations.length === 0 ||
      confirmations.some((confirmation) => !validConfirmation(confirmation)) ||
      !observationMatches(input.executor.inspectDatabase(ORACLE_BASELINE_DATABASE), confirmations)
    ) {
      return {
        outcome: "INCOMPLETE",
        state: current ?? unavailableState(input),
      }
    }

    const healthy = healthyState(input, confirmations)
    return input.executor.publishState(healthy)
      ? { outcome: "PASS", state: healthy }
      : { outcome: "INCOMPLETE", state: current ?? unavailableState(input) }
  })
}
