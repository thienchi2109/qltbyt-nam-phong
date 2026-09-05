import path from "node:path"
import { reviewedLiveSqlIdentity } from "./live-sql-identity"

import {
  parseTechnicalConfigurationCatalog,
  technicalConfigurationCatalogSha256,
} from "./baseline-catalog"
import { compareStrings, stableJsonSha256 } from "./serialization"
import type { TechnicalConfigurationRoutine } from "./baseline-catalog"
import type { MigrationIdentity } from "./types"

/** Version of the persisted Oracle baseline state contract. */
export const BASELINE_STATE_SCHEMA_VERSION = 2 as const
/** Legacy state version accepted only as explicit full-refresh upgrade input. */
export const LEGACY_BASELINE_STATE_SCHEMA_VERSION = 1 as const
/** Persistent Oracle database used as the baseline-forward source. */
export const ORACLE_BASELINE_DATABASE = "qltbyt_test"

export type ConfirmedLiveMigration = MigrationIdentity & {
  liveName: string
  liveVersion: string
}

export type BaselineRecovery = {
  kind: "catch-up" | "full-refresh"
  migration: ConfirmedLiveMigration
  phase: "metadata-recorded" | "prepared" | "sql-applied"
  runId: string
  targetMigrationHighWater: string
}

export type BaselineState = {
  catalogSha256: string
  checkedAt: string
  confirmedMigrations: ConfirmedLiveMigration[]
  generation: string
  healthy: boolean
  migrationHighWater: string
  recovery?: BaselineRecovery
  schemaVersion: typeof BASELINE_STATE_SCHEMA_VERSION
  sourceCommit: string
  technicalConfigurationCatalog: TechnicalConfigurationRoutine[]
}

export type LegacyBaselineState = {
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
  schemaVersion: typeof LEGACY_BASELINE_STATE_SCHEMA_VERSION
  sourceCommit: string
}

export type PersistedBaselineState = BaselineState | LegacyBaselineState

export type DatabaseObservation = {
  catalogSha256: string
  healthy: boolean
  invalidIndexCount: number
  migrationHighWater: string
  migrationRecords: Array<{
    liveName: string
    liveVersion: string
    sqlSha256: string
  }>
  postgresHasCreateOnPublic: boolean
  technicalConfigurationCatalog: TechnicalConfigurationRoutine[]
  unvalidatedConstraintCount: number
}

/** Orders confirmed migrations by their live migration version. */
export function compareConfirmedMigrations(
  left: ConfirmedLiveMigration,
  right: ConfirmedLiveMigration
): number {
  return (
    compareStrings(left.liveVersion, right.liveVersion) ||
    compareStrings(left.path, right.path) ||
    compareStrings(left.sha256, right.sha256)
  )
}

function normalizedState(state: BaselineState): BaselineState {
  const technicalConfigurationCatalog =
    parseTechnicalConfigurationCatalog(state.technicalConfigurationCatalog) ?? []
  const normalized: BaselineState = {
    ...state,
    catalogSha256: technicalConfigurationCatalogSha256(technicalConfigurationCatalog),
    confirmedMigrations: [...state.confirmedMigrations].sort(compareConfirmedMigrations),
    technicalConfigurationCatalog,
  }
  if (normalized.recovery === undefined) {
    delete normalized.recovery
  }
  return normalized
}

/** Hashes the atomic baseline snapshot used to invalidate reusable dynamic evidence. */
export function baselineStateHash(state: BaselineState): string {
  return stableJsonSha256(normalizedState(state))
}

/** Allows reuse only when both high-water and the complete atomic baseline snapshot still match. */
export function isBaselineForwardEvidenceReusable(
  report: {
    baselineMigrationHighWater: string
    inputHashes: Record<string, string>
    outcome: "INCOMPLETE" | "PASS"
  },
  state: BaselineState
): boolean {
  return (
    report.outcome === "PASS" &&
    report.baselineMigrationHighWater === state.migrationHighWater &&
    report.inputHashes.baselineState === baselineStateHash(state)
  )
}

function migrationName(filePath: string): string | undefined {
  return /^\d{14}_(.+)\.sql$/u.exec(path.posix.basename(filePath))?.[1]
}

/** Checks that a live migration confirmation has a complete, safe identity. */
export function validConfirmation(confirmation: ConfirmedLiveMigration): boolean {
  return (
    /^\d{14}$/u.test(confirmation.liveVersion) &&
    /^[a-z0-9_]+$/u.test(confirmation.liveName) &&
    /^[a-f0-9]{64}$/u.test(confirmation.sha256) &&
    /^supabase\/migrations\/\d{14}_.+\.sql$/u.test(confirmation.path) &&
    (migrationName(confirmation.path) === confirmation.liveName ||
      reviewedLiveSqlIdentity(confirmation) !== undefined)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseConfirmation(value: unknown): ConfirmedLiveMigration | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const confirmation = {
    liveName: value.liveName,
    liveVersion: value.liveVersion,
    path: value.path,
    sha256: value.sha256,
  }
  return typeof confirmation.liveName === "string" &&
    typeof confirmation.liveVersion === "string" &&
    typeof confirmation.path === "string" &&
    typeof confirmation.sha256 === "string" &&
    validConfirmation(confirmation as ConfirmedLiveMigration)
    ? (confirmation as ConfirmedLiveMigration)
    : undefined
}

function parseRecovery(value: unknown): BaselineRecovery | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const migration = parseConfirmation(value.migration)
  return (value.kind === "catch-up" || value.kind === "full-refresh") &&
    migration !== undefined &&
    (value.phase === "prepared" ||
      value.phase === "sql-applied" ||
      value.phase === "metadata-recorded") &&
    typeof value.runId === "string" &&
    /^[a-z0-9][a-z0-9_-]*$/u.test(value.runId) &&
    typeof value.targetMigrationHighWater === "string" &&
    /^\d{14}$/u.test(value.targetMigrationHighWater)
    ? {
        kind: value.kind,
        migration,
        phase: value.phase,
        runId: value.runId,
        targetMigrationHighWater: value.targetMigrationHighWater,
      }
    : undefined
}

function parseLegacyBaselineState(value: unknown): LegacyBaselineState | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== LEGACY_BASELINE_STATE_SCHEMA_VERSION ||
    !Array.isArray(value.confirmedMigrations)
  ) {
    return undefined
  }
  const confirmations = value.confirmedMigrations.map(parseConfirmation)
  const recovery = value.recovery
  const parsedRecovery: LegacyBaselineState["recovery"] =
    recovery === undefined
      ? undefined
      : isRecord(recovery) &&
          (recovery.kind === "catch-up" || recovery.kind === "full-refresh") &&
          typeof recovery.runId === "string" &&
          /^[a-z0-9][a-z0-9_-]*$/u.test(recovery.runId) &&
          typeof recovery.targetMigrationHighWater === "string" &&
          /^\d{14}$/u.test(recovery.targetMigrationHighWater)
        ? {
            kind: recovery.kind as "catch-up" | "full-refresh",
            runId: recovery.runId,
            targetMigrationHighWater: recovery.targetMigrationHighWater,
          }
        : undefined
  if (
    confirmations.some((confirmation) => confirmation === undefined) ||
    (recovery !== undefined && parsedRecovery === undefined) ||
    typeof value.checkedAt !== "string" ||
    Number.isNaN(Date.parse(value.checkedAt)) ||
    typeof value.generation !== "string" ||
    !/^[a-z0-9][a-z0-9_-]*$/u.test(value.generation) ||
    typeof value.healthy !== "boolean" ||
    typeof value.migrationHighWater !== "string" ||
    !/^(?:\d{14}|unavailable)$/u.test(value.migrationHighWater) ||
    typeof value.sourceCommit !== "string" ||
    !/^[a-f0-9]{40}$/u.test(value.sourceCommit)
  ) {
    return undefined
  }
  return {
    checkedAt: value.checkedAt,
    confirmedMigrations: (confirmations as ConfirmedLiveMigration[]).sort(
      compareConfirmedMigrations
    ),
    generation: value.generation,
    healthy: value.healthy,
    migrationHighWater: value.migrationHighWater,
    recovery: parsedRecovery,
    schemaVersion: LEGACY_BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: value.sourceCommit,
  }
}

/** Parses the one atomic baseline snapshot and rejects contradictory or stale shapes. */
export function parseBaselineState(value: unknown): BaselineState | undefined {
  if (!isRecord(value) || !Array.isArray(value.confirmedMigrations)) {
    return undefined
  }
  const confirmations = value.confirmedMigrations.map(parseConfirmation)
  if (confirmations.some((confirmation) => confirmation === undefined)) {
    return undefined
  }
  const recovery = value.recovery
  const parsedRecovery = recovery === undefined ? undefined : parseRecovery(recovery)
  const technicalConfigurationCatalog = parseTechnicalConfigurationCatalog(
    value.technicalConfigurationCatalog
  )
  if (recovery !== undefined && parsedRecovery === undefined) {
    return undefined
  }
  if (
    value.schemaVersion !== BASELINE_STATE_SCHEMA_VERSION ||
    typeof value.catalogSha256 !== "string" ||
    !/^[a-f0-9]{64}$/u.test(value.catalogSha256) ||
    technicalConfigurationCatalog === undefined ||
    technicalConfigurationCatalogSha256(technicalConfigurationCatalog) !== value.catalogSha256 ||
    typeof value.checkedAt !== "string" ||
    Number.isNaN(Date.parse(value.checkedAt)) ||
    typeof value.generation !== "string" ||
    !/^[a-z0-9][a-z0-9_-]*$/u.test(value.generation) ||
    typeof value.healthy !== "boolean" ||
    typeof value.migrationHighWater !== "string" ||
    !/^(?:\d{14}|unavailable)$/u.test(value.migrationHighWater) ||
    typeof value.sourceCommit !== "string" ||
    !/^[a-f0-9]{40}$/u.test(value.sourceCommit) ||
    (value.healthy && parsedRecovery !== undefined) ||
    (!value.healthy && value.migrationHighWater === "unavailable" && parsedRecovery === undefined)
  ) {
    return undefined
  }
  const confirmedMigrations = confirmations as ConfirmedLiveMigration[]
  if (
    value.healthy &&
    (confirmedMigrations.length === 0 ||
      confirmedMigrations.sort(compareConfirmedMigrations).at(-1)?.liveVersion !==
        value.migrationHighWater)
  ) {
    return undefined
  }

  return normalizedState({
    catalogSha256: value.catalogSha256,
    checkedAt: value.checkedAt,
    confirmedMigrations,
    generation: value.generation,
    healthy: value.healthy,
    migrationHighWater: value.migrationHighWater,
    recovery: parsedRecovery,
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: value.sourceCommit,
    technicalConfigurationCatalog,
  })
}

/** Reads legacy v1 state only so explicit maintenance can replace it with state v2. */
export function parsePersistedBaselineState(value: unknown): PersistedBaselineState | undefined {
  return parseBaselineState(value) ?? parseLegacyBaselineState(value)
}

export { observationMatches, parseDatabaseObservation } from "./baseline-observation"
export { technicalConfigurationCatalogSha256 } from "./baseline-catalog"
export type { TechnicalConfigurationRoutine } from "./baseline-catalog"
