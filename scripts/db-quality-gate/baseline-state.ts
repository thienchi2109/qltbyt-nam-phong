import path from "node:path"

import { compareStrings, stableJsonSha256 } from "./serialization"
import type { MigrationIdentity } from "./types"

/** Version of the persisted Oracle baseline state contract. */
export const BASELINE_STATE_SCHEMA_VERSION = 1 as const
/** Persistent Oracle database used as the baseline-forward source. */
export const ORACLE_BASELINE_DATABASE = "qltbyt_test"

export type ConfirmedLiveMigration = MigrationIdentity & {
  liveName: string
  liveVersion: string
}

export type BaselineRecovery = {
  kind: "catch-up" | "full-refresh"
  runId: string
  targetMigrationHighWater: string
}

export type BaselineState = {
  checkedAt: string
  confirmedMigrations: ConfirmedLiveMigration[]
  generation: string
  healthy: boolean
  migrationHighWater: string
  recovery?: BaselineRecovery
  schemaVersion: typeof BASELINE_STATE_SCHEMA_VERSION
  sourceCommit: string
}

export type DatabaseObservation = {
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

/** Parses database health facts without trusting remote JSON shape. */
export function parseDatabaseObservation(value: unknown): DatabaseObservation | undefined {
  if (
    !isRecord(value) ||
    value.healthy !== true ||
    !Number.isSafeInteger(value.invalidIndexCount) ||
    typeof value.migrationHighWater !== "string" ||
    !/^(?:\d{14}|unavailable)$/u.test(value.migrationHighWater) ||
    !Array.isArray(value.migrationRecords) ||
    !Number.isSafeInteger(value.unvalidatedConstraintCount)
  ) {
    return undefined
  }
  const migrationRecords: DatabaseObservation["migrationRecords"] = []
  for (const record of value.migrationRecords) {
    if (
      !isRecord(record) ||
      typeof record.liveName !== "string" ||
      typeof record.liveVersion !== "string" ||
      !/^\d{14}$/u.test(record.liveVersion) ||
      typeof record.sqlSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(record.sqlSha256)
    ) {
      return undefined
    }
    migrationRecords.push({
      liveName: record.liveName,
      liveVersion: record.liveVersion,
      sqlSha256: record.sqlSha256,
    })
  }

  return {
    healthy: true,
    invalidIndexCount: value.invalidIndexCount as number,
    migrationHighWater: value.migrationHighWater,
    migrationRecords,
    unvalidatedConstraintCount: value.unvalidatedConstraintCount as number,
  }
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
  const normalized: BaselineState = {
    ...state,
    confirmedMigrations: [...state.confirmedMigrations].sort(compareConfirmedMigrations),
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
    migrationName(confirmation.path) === confirmation.liveName
  )
}

/** Checks whether an Oracle database observation matches confirmed migration state. */
export function observationMatches(
  observation: DatabaseObservation | undefined,
  confirmations: ConfirmedLiveMigration[]
): boolean {
  if (
    observation === undefined ||
    !observation.healthy ||
    observation.invalidIndexCount !== 0 ||
    observation.unvalidatedConstraintCount !== 0 ||
    observation.migrationHighWater !== confirmations.at(-1)?.liveVersion
  ) {
    return false
  }
  const records = new Map(
    observation.migrationRecords.map((record) => [record.liveVersion, record])
  )

  return confirmations.every((confirmation) => {
    const record = records.get(confirmation.liveVersion)
    return record?.liveName === confirmation.liveName && record.sqlSha256 === confirmation.sha256
  })
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
  const parsedRecovery: BaselineRecovery | undefined =
    recovery === undefined
      ? undefined
      : isRecord(recovery) &&
          (recovery.kind === "catch-up" || recovery.kind === "full-refresh") &&
          typeof recovery.runId === "string" &&
          /^[a-z0-9][a-z0-9_-]*$/u.test(recovery.runId) &&
          typeof recovery.targetMigrationHighWater === "string" &&
          /^\d{14}$/u.test(recovery.targetMigrationHighWater)
        ? {
            kind: recovery.kind,
            runId: recovery.runId,
            targetMigrationHighWater: recovery.targetMigrationHighWater,
          }
        : undefined
  if (recovery !== undefined && parsedRecovery === undefined) {
    return undefined
  }
  if (
    value.schemaVersion !== BASELINE_STATE_SCHEMA_VERSION ||
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
    checkedAt: value.checkedAt,
    confirmedMigrations,
    generation: value.generation,
    healthy: value.healthy,
    migrationHighWater: value.migrationHighWater,
    recovery: parsedRecovery,
    schemaVersion: BASELINE_STATE_SCHEMA_VERSION,
    sourceCommit: value.sourceCommit,
  })
}
