import {
  parseTechnicalConfigurationCatalog,
  technicalConfigurationCatalogSha256,
} from "./baseline-catalog"
import { compareConfirmedMigrations, validConfirmation } from "./baseline-state"
import type { TechnicalConfigurationRoutine } from "./baseline-catalog"
import type { ConfirmedLiveMigration } from "./baseline-state"

/** Version of the immutable live-derived baseline maintenance manifest. */
export const BASELINE_MANIFEST_SCHEMA_VERSION = 1 as const

export type BaselineManifest = {
  catalogSha256: string
  migrations: ConfirmedLiveMigration[]
  schemaVersion: typeof BASELINE_MANIFEST_SCHEMA_VERSION
  sourceCommit: string
  targetMigrationHighWater: string
  technicalConfigurationCatalog: TechnicalConfigurationRoutine[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseMigration(value: unknown): ConfirmedLiveMigration | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const migration = {
    liveName: value.liveName,
    liveVersion: value.liveVersion,
    path: value.path,
    sha256: value.sha256,
  }
  return typeof migration.liveName === "string" &&
    typeof migration.liveVersion === "string" &&
    typeof migration.path === "string" &&
    typeof migration.sha256 === "string" &&
    validConfirmation(migration as ConfirmedLiveMigration)
    ? (migration as ConfirmedLiveMigration)
    : undefined
}

/** Parses the immutable live manifest used by all Oracle baseline maintenance operations. */
export function parseBaselineManifest(value: unknown): BaselineManifest | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== BASELINE_MANIFEST_SCHEMA_VERSION ||
    typeof value.catalogSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.catalogSha256) ||
    !Array.isArray(value.migrations) ||
    typeof value.sourceCommit !== "string" ||
    !/^[a-f0-9]{40}$/u.test(value.sourceCommit) ||
    typeof value.targetMigrationHighWater !== "string" ||
    !/^\d{14}$/u.test(value.targetMigrationHighWater)
  ) {
    return undefined
  }

  const migrations = value.migrations.map(parseMigration)
  const catalog = parseTechnicalConfigurationCatalog(value.technicalConfigurationCatalog)
  if (
    migrations.length === 0 ||
    migrations.some((migration) => migration === undefined) ||
    catalog === undefined
  ) {
    return undefined
  }
  const normalizedMigrations = (migrations as ConfirmedLiveMigration[]).sort(
    compareConfirmedMigrations
  )
  if (
    new Set(normalizedMigrations.map((migration) => migration.liveVersion)).size !==
      normalizedMigrations.length ||
    new Set(normalizedMigrations.map((migration) => migration.path)).size !==
      normalizedMigrations.length ||
    normalizedMigrations.at(-1)?.liveVersion !== value.targetMigrationHighWater ||
    technicalConfigurationCatalogSha256(catalog) !== value.catalogSha256
  ) {
    return undefined
  }

  return {
    catalogSha256: value.catalogSha256,
    migrations: normalizedMigrations,
    schemaVersion: BASELINE_MANIFEST_SCHEMA_VERSION,
    sourceCommit: value.sourceCommit,
    targetMigrationHighWater: value.targetMigrationHighWater,
    technicalConfigurationCatalog: catalog,
  }
}

export { technicalConfigurationCatalogSha256 } from "./baseline-catalog"
export type { TechnicalConfigurationRoutine } from "./baseline-catalog"
