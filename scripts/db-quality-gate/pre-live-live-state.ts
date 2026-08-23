import { readFileSync } from "node:fs"

import { z } from "zod"

import { stableJsonSha256 } from "./serialization"
import type { BaselineState } from "./baseline-state"
import type { AppliedMigrationLock } from "./registries"

const LIVE_PROJECT_REF = "cdthersvldpnlbvpufrr"
const MAXIMUM_AGE_MILLISECONDS = 15 * 60 * 1000
const MAXIMUM_FUTURE_SKEW_MILLISECONDS = 2 * 60 * 1000
const MIGRATION_PATH_PATTERN = /^supabase\/migrations\/(\d{14})_(.+)\.sql$/u

const liveMigrationObservationSchema = z
  .object({
    capturedAt: z.string().datetime({ offset: true }),
    migrations: z.array(
      z
        .object({
          name: z.string().min(1),
          version: z.string().regex(/^\d{14}$/u),
        })
        .strict()
    ),
    projectRef: z.literal(LIVE_PROJECT_REF),
    schemaVersion: z.literal(1),
    source: z.literal("supabase-mcp"),
  })
  .strict()

export type LiveMigrationObservation = z.infer<typeof liveMigrationObservationSchema>

export type ParsedLiveMigrationObservation = LiveMigrationObservation & {
  inputHash: string
}

export type LiveMigrationStateEvaluation =
  | {
      inputHash: string
      liveMigrationHighWater: string
      status: "baseline-behind" | "valid"
    }
  | {
      reason: string
      status: "invalid"
    }

function versionsStrictlyAscending(observation: LiveMigrationObservation): boolean {
  return observation.migrations.every(
    (migration, index) =>
      index === 0 || migration.version > observation.migrations[index - 1].version
  )
}

/** Parses a fresh, project-bound observation produced by a read-only Supabase MCP session. */
export function parseLiveMigrationObservation(
  value: unknown,
  createdAt: string
): ParsedLiveMigrationObservation | undefined {
  const result = liveMigrationObservationSchema.safeParse(value)
  const createdAtMilliseconds = Date.parse(createdAt)
  if (!result.success || !Number.isFinite(createdAtMilliseconds)) {
    return undefined
  }

  const capturedAtMilliseconds = Date.parse(result.data.capturedAt)
  const ageMilliseconds = createdAtMilliseconds - capturedAtMilliseconds
  if (
    !Number.isFinite(capturedAtMilliseconds) ||
    ageMilliseconds > MAXIMUM_AGE_MILLISECONDS ||
    ageMilliseconds < -MAXIMUM_FUTURE_SKEW_MILLISECONDS ||
    !versionsStrictlyAscending(result.data)
  ) {
    return undefined
  }

  return {
    ...result.data,
    inputHash: stableJsonSha256(result.data),
  }
}

/** Reads an operator-exported observation without opening any live database connection. */
export function readLiveMigrationObservationFile(filePath: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown
  } catch {
    return undefined
  }
}

function appliedEntryIdentity(
  entry: AppliedMigrationLock["applied"][number]
): { name: string; version: string } | undefined {
  const match = MIGRATION_PATH_PATTERN.exec(entry.path)
  return match === null ? undefined : { name: match[2], version: match[1] }
}

/** Compares committed applied-lock intent and Oracle baseline high-water with live read-only evidence. */
export function evaluateLiveMigrationState(input: {
  appliedLock: AppliedMigrationLock | undefined
  baselineState: BaselineState
  observation: ParsedLiveMigrationObservation | undefined
}): LiveMigrationStateEvaluation {
  if (input.appliedLock === undefined || input.observation === undefined) {
    return {
      reason: "Live observation or committed applied lock is unavailable",
      status: "invalid",
    }
  }

  const liveByVersion = new Map(
    input.observation.migrations.map((migration) => [migration.version, migration.name])
  )
  for (const entry of input.appliedLock.applied) {
    const identity = appliedEntryIdentity(entry)
    if (identity === undefined || liveByVersion.get(identity.version) !== identity.name) {
      return {
        reason: "Committed applied-lock entries do not exactly match live migration evidence",
        status: "invalid",
      }
    }
  }

  const liveMigrationHighWater = input.observation.migrations.at(-1)?.version ?? "unavailable"
  if (liveMigrationHighWater > input.baselineState.migrationHighWater) {
    return {
      inputHash: input.observation.inputHash,
      liveMigrationHighWater,
      status: "baseline-behind",
    }
  }
  if (liveMigrationHighWater !== input.baselineState.migrationHighWater) {
    return {
      reason: "Published Oracle baseline high-water does not match live migration evidence",
      status: "invalid",
    }
  }

  return {
    inputHash: input.observation.inputHash,
    liveMigrationHighWater,
    status: "valid",
  }
}
