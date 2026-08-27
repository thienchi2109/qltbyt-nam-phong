import {
  applyMigrationWithRecoveryState,
  expectedState,
  readManifestMigrationInputs,
} from "./baseline-maintenance-operations"
import {
  healthyState,
  lockedResult,
  mergeConfirmations,
  recoveryState,
  stateForResult,
} from "./baseline-maintenance-recovery"
import { observationMatches, ORACLE_BASELINE_DATABASE } from "./baseline-state"
import type { MaintenanceResult, RepositoryMaintenanceInput } from "./baseline-maintenance-recovery"

function refreshDatabaseName(kind: "refresh" | "retired", runId: string): string | undefined {
  if (!/^[a-z0-9][a-z0-9_-]*$/u.test(runId)) {
    return undefined
  }
  const value = `dq_baseline_${kind}_${runId.replaceAll("-", "_")}`
  return value.length <= 63 ? value : undefined
}

function validDumpPath(dumpPath: string): boolean {
  return (
    dumpPath.startsWith("/opt/supabase-test/backups/") &&
    !dumpPath.split("/").includes("..") &&
    dumpPath.endsWith(".dump")
  )
}

/** Restores into a disposable database and swaps only after exact target parity. */
export function runBaselineFullRefresh(
  input: RepositoryMaintenanceInput & { dumpPath: string }
): MaintenanceResult {
  return lockedResult(input, () => {
    const current = input.executor.readState()
    const migrations = readManifestMigrationInputs(input)
    const refreshDatabase = refreshDatabaseName("refresh", input.runId)
    const retiredDatabase = refreshDatabaseName("retired", input.runId)
    if (
      current === undefined ||
      migrations === undefined ||
      migrations.length === 0 ||
      refreshDatabase === undefined ||
      retiredDatabase === undefined ||
      !validDumpPath(input.dumpPath) ||
      !input.executor.preflightRoles(ORACLE_BASELINE_DATABASE)
    ) {
      return {
        outcome: "INCOMPLETE",
        state: stateForResult(input, current),
      }
    }
    const confirmations = mergeConfirmations(
      current,
      input.manifest.migrations,
      input.manifest.targetMigrationHighWater
    )
    if (confirmations === undefined) {
      return { outcome: "INCOMPLETE", state: stateForResult(input, current) }
    }
    let recovery = recoveryState(
      input,
      current.confirmedMigrations,
      "full-refresh",
      migrations[0],
      "prepared"
    )
    if (
      !input.executor.publishState(recovery) ||
      !input.executor.createRefreshDatabase(refreshDatabase)
    ) {
      return { outcome: "INCOMPLETE", state: recovery }
    }

    let swapped = false
    try {
      if (
        !input.executor.restoreDump(refreshDatabase, input.dumpPath) ||
        !input.executor.preflightRoles(refreshDatabase)
      ) {
        return { outcome: "INCOMPLETE", state: recovery }
      }
      let progress = [...current.confirmedMigrations]
      for (const migration of migrations) {
        const status = input.executor.inspectMigrationMetadata(refreshDatabase, migration)
        if (status === undefined || status === "conflict") {
          return { outcome: "INCOMPLETE", state: recovery }
        }
        if (status === "exact") {
          progress =
            mergeConfirmations(
              { ...current, confirmedMigrations: progress },
              [migration],
              migration.liveVersion
            ) ?? progress
          continue
        }
        const applied = applyMigrationWithRecoveryState({
          confirmedMigrations: progress,
          databaseName: refreshDatabase,
          kind: "full-refresh",
          maintenance: input,
          migration,
        })
        recovery = applied.state
        if (!applied.success) {
          return { outcome: "INCOMPLETE", state: recovery }
        }
        progress = recovery.confirmedMigrations
      }
      if (
        !observationMatches(
          input.executor.inspectDatabase(refreshDatabase),
          expectedState(input, confirmations)
        ) ||
        !input.executor.swapBaseline(refreshDatabase, retiredDatabase)
      ) {
        return { outcome: "INCOMPLETE", state: recovery }
      }
      swapped = true
      if (
        !observationMatches(
          input.executor.inspectDatabase(ORACLE_BASELINE_DATABASE),
          expectedState(input, confirmations)
        ) ||
        !input.executor.dropDatabase(retiredDatabase)
      ) {
        return { outcome: "INCOMPLETE", state: recovery }
      }
      const healthy = healthyState(input, confirmations)
      if (!input.executor.publishState(healthy)) {
        return { outcome: "INCOMPLETE", state: recovery }
      }
      return { outcome: "PASS", state: healthy }
    } finally {
      if (!swapped) {
        input.executor.dropDatabase(refreshDatabase)
      }
    }
  })
}
