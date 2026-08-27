import { parseBaselineManifest } from "./baseline-manifest"
import { mergeConfirmations, recoveryState } from "./baseline-maintenance-recovery"
import { readFileAtCommit } from "./git-evidence"
import { canonicalizeMigrationContent, migrationContentSha256 } from "./migration-source"
import type { BaselineManifest } from "./baseline-manifest"
import type {
  BaselineMaintenanceExecutor,
  ConfirmedMigrationInput,
  MaintenanceInput,
} from "./baseline-maintenance-recovery"
import type { BaselineState } from "./baseline-state"

/** Re-parses the caller manifest so maintenance never trusts an unchecked object. */
export function validatedManifest(input: MaintenanceInput): BaselineManifest | undefined {
  return parseBaselineManifest(input.manifest)
}

/** Reads and hash-verifies every manifest migration from its exact source commit. */
export function readManifestMigrationInputs(
  input: MaintenanceInput
): ConfirmedMigrationInput[] | undefined {
  const manifest = validatedManifest(input)
  if (manifest === undefined) {
    return undefined
  }
  const migrations: ConfirmedMigrationInput[] = []
  for (const migration of manifest.migrations) {
    const content = readFileAtCommit(input.repositoryRoot, manifest.sourceCommit, migration.path)
    if (content === undefined || migrationContentSha256(content) !== migration.sha256) {
      return undefined
    }
    migrations.push({
      ...migration,
      content: canonicalizeMigrationContent(content),
    })
  }
  return migrations
}

/** Builds the catalog-bound observation target for one maintenance result. */
export function expectedState(
  input: MaintenanceInput,
  confirmedMigrations: BaselineState["confirmedMigrations"]
) {
  return {
    catalogSha256: input.manifest.catalogSha256,
    confirmedMigrations,
    technicalConfigurationCatalog: input.manifest.technicalConfigurationCatalog,
  }
}

/** Verifies role capabilities and exact metadata status before any state mutation. */
export function metadataPreflight(
  executor: BaselineMaintenanceExecutor,
  databaseName: string,
  migrations: ConfirmedMigrationInput[],
  currentHighWater: string
): boolean {
  if (!executor.preflightRoles(databaseName)) {
    return false
  }
  return migrations.every((migration) => {
    const status = executor.inspectMigrationMetadata(databaseName, migration)
    return migration.liveVersion <= currentHighWater ? status === "exact" : status === "missing"
  })
}

/** Applies one migration while atomically publishing each recoverable phase. */
export function applyMigrationWithRecoveryState(input: {
  confirmedMigrations: BaselineState["confirmedMigrations"]
  databaseName: string
  kind: "catch-up" | "full-refresh"
  maintenance: MaintenanceInput
  migration: ConfirmedMigrationInput
}): { state: BaselineState; success: boolean } {
  const { maintenance, migration } = input
  const prepared = recoveryState(
    maintenance,
    input.confirmedMigrations,
    input.kind,
    migration,
    "prepared"
  )
  if (!maintenance.executor.publishState(prepared)) {
    return { state: prepared, success: false }
  }
  if (!maintenance.executor.applyMigration(input.databaseName, migration)) {
    return { state: prepared, success: false }
  }

  const sqlApplied = recoveryState(
    maintenance,
    input.confirmedMigrations,
    input.kind,
    migration,
    "sql-applied"
  )
  if (!maintenance.executor.publishState(sqlApplied)) {
    return { state: prepared, success: false }
  }
  if (
    !maintenance.executor.recordMigrationMetadata(input.databaseName, migration) ||
    maintenance.executor.inspectMigrationMetadata(input.databaseName, migration) !== "exact"
  ) {
    return { state: sqlApplied, success: false }
  }

  const confirmedMigrations = mergeConfirmations(
    {
      ...sqlApplied,
      confirmedMigrations: input.confirmedMigrations,
    },
    [migration],
    migration.liveVersion
  )
  if (confirmedMigrations === undefined) {
    return { state: sqlApplied, success: false }
  }
  const metadataRecorded = recoveryState(
    maintenance,
    confirmedMigrations,
    input.kind,
    migration,
    "metadata-recorded"
  )
  return maintenance.executor.publishState(metadataRecorded)
    ? { state: metadataRecorded, success: true }
    : { state: sqlApplied, success: false }
}
