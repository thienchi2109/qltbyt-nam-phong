import {
  parseTechnicalConfigurationCatalog,
  technicalConfigurationCatalogSha256,
} from "./baseline-catalog"
import { stableJsonSha256 } from "./serialization"
import { confirmedLiveSqlSha256 } from "./live-sql-identity"
import type { BaselineState, DatabaseObservation } from "./baseline-state"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
    typeof value.postgresHasCreateOnPublic !== "boolean" ||
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
  const technicalConfigurationCatalog = parseTechnicalConfigurationCatalog(
    value.technicalConfigurationCatalog
  )
  if (technicalConfigurationCatalog === undefined) {
    return undefined
  }

  return {
    catalogSha256: technicalConfigurationCatalogSha256(technicalConfigurationCatalog),
    healthy: true,
    invalidIndexCount: value.invalidIndexCount as number,
    migrationHighWater: value.migrationHighWater,
    migrationRecords,
    postgresHasCreateOnPublic: value.postgresHasCreateOnPublic,
    technicalConfigurationCatalog,
    unvalidatedConstraintCount: value.unvalidatedConstraintCount as number,
  }
}

/** Checks whether an Oracle database observation matches confirmed migration state. */
export function observationMatches(
  observation: DatabaseObservation | undefined,
  expected: Pick<
    BaselineState,
    "catalogSha256" | "confirmedMigrations" | "technicalConfigurationCatalog"
  >
): boolean {
  const confirmations = expected.confirmedMigrations
  if (
    observation === undefined ||
    !observation.healthy ||
    observation.invalidIndexCount !== 0 ||
    observation.postgresHasCreateOnPublic ||
    observation.unvalidatedConstraintCount !== 0 ||
    observation.migrationHighWater !== confirmations.at(-1)?.liveVersion ||
    observation.catalogSha256 !== expected.catalogSha256 ||
    stableJsonSha256(observation.technicalConfigurationCatalog) !==
      stableJsonSha256(expected.technicalConfigurationCatalog)
  ) {
    return false
  }
  const records = new Map(
    observation.migrationRecords.map((record) => [record.liveVersion, record])
  )

  return confirmations.every((confirmation) => {
    const record = records.get(confirmation.liveVersion)
    return (
      record?.liveName === confirmation.liveName &&
      record.sqlSha256 === confirmedLiveSqlSha256(confirmation)
    )
  })
}
