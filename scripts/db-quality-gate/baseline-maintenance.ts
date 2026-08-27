import {
  applyMigrationWithRecoveryState,
  expectedState,
  metadataPreflight,
  readManifestMigrationInputs,
  validatedManifest,
} from "./baseline-maintenance-operations"
import {
  healthyState,
  lockedResult,
  mergeConfirmations,
  recoveryState,
  stateForResult,
} from "./baseline-maintenance-recovery"
import {
  BASELINE_STATE_SCHEMA_VERSION,
  observationMatches,
  ORACLE_BASELINE_DATABASE,
} from "./baseline-state"
import type {
  MaintenanceInput,
  MaintenanceResult,
  RepositoryMaintenanceInput,
} from "./baseline-maintenance-recovery"

export { baselineStateHash, isBaselineForwardEvidenceReusable } from "./baseline-state"
export { runBaselineFullRefresh } from "./baseline-maintenance-refresh"
export type {
  BaselineMaintenanceExecutor,
  ConfirmedMigrationInput,
} from "./baseline-maintenance-recovery"
export type { BaselineState, ConfirmedLiveMigration } from "./baseline-state"

/** Applies exact live-confirmed migrations while keeping SQL and metadata recovery separable. */
export function runBaselineCatchUp(input: RepositoryMaintenanceInput): MaintenanceResult {
  return lockedResult(input, () => {
    const current = input.executor.readState()
    const migrations = readManifestMigrationInputs(input)
    if (
      current?.schemaVersion !== BASELINE_STATE_SCHEMA_VERSION ||
      !current.healthy ||
      migrations === undefined
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
    const pending = migrations.filter(
      (migration) => migration.liveVersion > current.migrationHighWater
    )
    if (
      confirmations === undefined ||
      pending.length === 0 ||
      !metadataPreflight(
        input.executor,
        ORACLE_BASELINE_DATABASE,
        migrations,
        current.migrationHighWater
      )
    ) {
      return { outcome: "INCOMPLETE", state: current }
    }

    let progress = [...current.confirmedMigrations]
    let recovery = current
    for (const migration of pending) {
      const applied = applyMigrationWithRecoveryState({
        confirmedMigrations: progress,
        databaseName: ORACLE_BASELINE_DATABASE,
        kind: "catch-up",
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
        input.executor.inspectDatabase(ORACLE_BASELINE_DATABASE),
        expectedState(input, confirmations)
      )
    ) {
      return { outcome: "INCOMPLETE", state: recovery }
    }
    const healthy = healthyState(input, confirmations)
    return input.executor.publishState(healthy)
      ? { outcome: "PASS", state: healthy }
      : { outcome: "INCOMPLETE", state: recovery }
  })
}

/** Repairs metadata only when state proves that the exact catch-up SQL already completed. */
export function runBaselineHealthRecovery(input: MaintenanceInput): MaintenanceResult {
  return lockedResult(input, () => {
    const current = input.executor.readState()
    const manifest = validatedManifest(input)
    if (
      current?.schemaVersion !== BASELINE_STATE_SCHEMA_VERSION ||
      current.healthy ||
      current.recovery?.kind !== "catch-up" ||
      manifest === undefined ||
      current.sourceCommit !== manifest.sourceCommit ||
      current.recovery.targetMigrationHighWater !== manifest.targetMigrationHighWater ||
      !input.executor.cleanupMigrationRole(ORACLE_BASELINE_DATABASE)
    ) {
      return {
        outcome: "INCOMPLETE",
        state: stateForResult(input, current),
      }
    }
    const recoveryMigration = manifest.migrations.find(
      (migration) =>
        migration.liveVersion === current.recovery?.migration.liveVersion &&
        migration.path === current.recovery?.migration.path &&
        migration.sha256 === current.recovery?.migration.sha256
    )
    if (recoveryMigration === undefined || current.recovery.phase === "prepared") {
      return { outcome: "INCOMPLETE", state: current }
    }
    const migration = readManifestMigrationInputs(input)?.find(
      (candidate) => candidate.liveVersion === recoveryMigration.liveVersion
    )
    if (migration === undefined) {
      return { outcome: "INCOMPLETE", state: current }
    }

    let metadataStatus = input.executor.inspectMigrationMetadata(
      ORACLE_BASELINE_DATABASE,
      migration
    )
    if (metadataStatus === "missing" && current.recovery.phase === "sql-applied") {
      if (!input.executor.recordMigrationMetadata(ORACLE_BASELINE_DATABASE, migration)) {
        return { outcome: "INCOMPLETE", state: current }
      }
      metadataStatus = input.executor.inspectMigrationMetadata(ORACLE_BASELINE_DATABASE, migration)
    }
    if (metadataStatus !== "exact") {
      return { outcome: "INCOMPLETE", state: current }
    }

    const confirmations = mergeConfirmations(
      current,
      manifest.migrations,
      manifest.targetMigrationHighWater
    )
    if (confirmations === undefined) {
      return { outcome: "INCOMPLETE", state: current }
    }
    const metadataRecorded = recoveryState(
      input,
      confirmations,
      "catch-up",
      migration,
      "metadata-recorded"
    )
    if (!input.executor.publishState(metadataRecorded)) {
      return { outcome: "INCOMPLETE", state: current }
    }
    if (
      !observationMatches(
        input.executor.inspectDatabase(ORACLE_BASELINE_DATABASE),
        expectedState(input, confirmations)
      )
    ) {
      return { outcome: "INCOMPLETE", state: metadataRecorded }
    }
    const healthy = healthyState(input, confirmations)
    return input.executor.publishState(healthy)
      ? { outcome: "PASS", state: healthy }
      : { outcome: "INCOMPLETE", state: metadataRecorded }
  })
}
