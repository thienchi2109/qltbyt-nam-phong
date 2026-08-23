import { readFileSync } from "node:fs"

import { z } from "zod"

import type { OracleExecutorResult } from "./dynamic-lane-types"
import { readFileAtCommit, resolveGitCommit } from "./git-evidence"
import {
  canonicalizeMigrationContent,
  isCanonicalMigrationPath,
  migrationContentSha256,
} from "./migration-source"
import { ORACLE_READ_BACK_ARTIFACT } from "./oracle-evidence-store"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import { oracleErrorResult } from "./oracle-remote-client"
import { validRunId } from "./oracle-remote-contract"
import { stableJsonSha256, stableJsonStringify } from "./serialization"

const LIVE_PROJECT_REF = "cdthersvldpnlbvpufrr"
const MAXIMUM_AGE_MILLISECONDS = 15 * 60 * 1000
const MAXIMUM_FUTURE_SKEW_MILLISECONDS = 2 * 60 * 1000
const MIGRATION_IDENTITY_PATTERN = /^supabase\/migrations\/(\d{14})_(.+)\.sql$/u
const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SUBJECT_COMMIT_PATTERN = /^[a-f0-9]{40}$/u

const readBackObservationSchema = z
  .object({
    capturedAt: z.string().datetime({ offset: true }),
    liveName: z.string().refine((value) => value.trim().length > 0),
    liveVersion: z.string().regex(/^\d{14}$/u),
    migrationPath: z.string().refine((value) => isCanonicalMigrationPath(value)),
    projectRef: z.literal(LIVE_PROJECT_REF),
    schemaVersion: z.literal(1),
    source: z.literal("supabase-mcp"),
    statements: z.array(z.string().refine((value) => value.trim().length > 0)).min(1),
  })
  .strict()

const readBackRecordBodySchema = z
  .object({
    canonicalBytes: z.number().int().nonnegative(),
    capturedAt: z.string().datetime({ offset: true }),
    liveName: z.string().min(1),
    liveVersion: z.string().regex(/^\d{14}$/u),
    migrationPath: z.string().refine((value) => isCanonicalMigrationPath(value)),
    observedCanonicalSha256: z.string().regex(SHA256_PATTERN),
    projectRef: z.literal(LIVE_PROJECT_REF),
    rawObservationDigest: z.string().regex(SHA256_PATTERN),
    receivedAt: z.string().datetime({ offset: true }),
    schemaVersion: z.literal(1),
    sha256: z.string().regex(SHA256_PATTERN),
    source: z.literal("supabase-mcp"),
    statementCount: z.number().int().positive(),
    subjectCommit: z.string().regex(SUBJECT_COMMIT_PATTERN),
  })
  .strict()

const readBackRecordSchema = readBackRecordBodySchema
  .extend({
    digest: z.string().regex(SHA256_PATTERN),
  })
  .strict()

export type ReadBackObservation = z.infer<typeof readBackObservationSchema>
export type ReadBackRecord = z.infer<typeof readBackRecordSchema>

export type ReadBackBinding = {
  liveName: string
  liveVersion: string
  migrationPath: string
  sha256: string
}

export type ReadBackIngestionResult =
  | {
      binding: ReadBackBinding
      digest: string
      evidenceId: string
      outcome: "PASS"
      record: ReadBackRecord
      status: "verified"
    }
  | {
      outcome: "INCOMPLETE"
      reason: string
      status: "reconciliation-required"
    }

export type ReadBackDependencies = {
  evidenceStore: OracleEvidenceStore
  now: () => Date
}

export type ReadBackInput = {
  observation: unknown
  repositoryRoot: string
  runId: string
  subjectCommit: string
}

function reconciliationRequired(reason: string): ReadBackIngestionResult {
  return {
    outcome: "INCOMPLETE",
    reason,
    status: "reconciliation-required",
  }
}

function migrationName(migrationPath: string): string | undefined {
  return MIGRATION_IDENTITY_PATTERN.exec(migrationPath)?.[2]
}

function freshCapture(capturedAt: string, receivedAt: string): boolean {
  const capturedAtMilliseconds = Date.parse(capturedAt)
  const receivedAtMilliseconds = Date.parse(receivedAt)
  const ageMilliseconds = receivedAtMilliseconds - capturedAtMilliseconds

  return (
    Number.isFinite(capturedAtMilliseconds) &&
    Number.isFinite(receivedAtMilliseconds) &&
    ageMilliseconds <= MAXIMUM_AGE_MILLISECONDS &&
    ageMilliseconds >= -MAXIMUM_FUTURE_SKEW_MILLISECONDS
  )
}

function recordDigest(record: Omit<ReadBackRecord, "digest">): string {
  return stableJsonSha256(record)
}

function recordIsConsistent(record: ReadBackRecord): boolean {
  return (
    migrationName(record.migrationPath) === record.liveName &&
    record.sha256 === record.observedCanonicalSha256 &&
    freshCapture(record.capturedAt, record.receivedAt)
  )
}

/** Reads an operator-exported read-back observation without opening a live database connection. */
export function readReadBackObservationFile(filePath: string): unknown | undefined {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown
  } catch {
    return undefined
  }
}

/** Verifies one MCP read-back observation and publishes authority only after an exact hash match. */
export function ingestReadBackObservation(
  input: ReadBackInput,
  dependencies: ReadBackDependencies
): ReadBackIngestionResult {
  const observationResult = readBackObservationSchema.safeParse(input.observation)
  const receivedAtDate = dependencies.now()
  if (Number.isNaN(receivedAtDate.getTime()) || !validRunId(input.runId)) {
    return reconciliationRequired("Read-back receipt time or Oracle run ID is invalid")
  }
  const receivedAt = receivedAtDate.toISOString()
  if (!observationResult.success || !freshCapture(observationResult.data.capturedAt, receivedAt)) {
    return reconciliationRequired(
      "Read-back observation is missing, malformed, stale, or future-dated"
    )
  }

  const observation = observationResult.data
  if (migrationName(observation.migrationPath) !== observation.liveName) {
    return reconciliationRequired("Read-back migration project, path, version, or name is invalid")
  }

  const subjectCommit = resolveGitCommit(input.repositoryRoot, input.subjectCommit)
  if (subjectCommit === undefined || subjectCommit !== input.subjectCommit) {
    return reconciliationRequired("Read-back subject commit is unavailable or not an exact Git SHA")
  }
  const reviewedContent = readFileAtCommit(
    input.repositoryRoot,
    subjectCommit,
    observation.migrationPath
  )
  if (reviewedContent === undefined) {
    return reconciliationRequired("Reviewed migration source is unavailable at the subject commit")
  }

  const observedContent = observation.statements.join("\n")
  const canonicalSql = canonicalizeMigrationContent(observedContent)
  const observedCanonicalSha256 = migrationContentSha256(observedContent)
  const reviewedSha256 = migrationContentSha256(reviewedContent)
  if (observedCanonicalSha256 !== reviewedSha256) {
    return reconciliationRequired(
      "Observed live canonical SQL hash differs from the reviewed migration source"
    )
  }

  const recordBody: Omit<ReadBackRecord, "digest"> = {
    canonicalBytes: Buffer.byteLength(canonicalSql, "utf8"),
    capturedAt: observation.capturedAt,
    liveName: observation.liveName,
    liveVersion: observation.liveVersion,
    migrationPath: observation.migrationPath,
    observedCanonicalSha256,
    projectRef: observation.projectRef,
    rawObservationDigest: stableJsonSha256(observation),
    receivedAt,
    schemaVersion: 1,
    sha256: reviewedSha256,
    source: observation.source,
    statementCount: observation.statements.length,
    subjectCommit,
  }
  const digest = recordDigest(recordBody)
  const record: ReadBackRecord = { ...recordBody, digest }
  const persisted = dependencies.evidenceStore.persistArtifact({
    artifactName: ORACLE_READ_BACK_ARTIFACT,
    content: `${stableJsonStringify(record)}\n`,
    runId: input.runId,
  })
  if (persisted.status === "error") {
    return reconciliationRequired(`Read-back authority could not be persisted: ${persisted.error}`)
  }

  return {
    binding: {
      liveName: record.liveName,
      liveVersion: record.liveVersion,
      migrationPath: record.migrationPath,
      sha256: record.sha256,
    },
    digest,
    evidenceId: persisted.value.evidenceId,
    outcome: "PASS",
    record,
    status: "verified",
  }
}

/** Reloads and verifies a complete immutable read-back record without the observation file. */
export function loadReadBackRecord(input: {
  evidenceStore: OracleEvidenceStore
  runId: string
}): OracleExecutorResult<ReadBackRecord> {
  const artifact = input.evidenceStore.readArtifact({
    artifactName: ORACLE_READ_BACK_ARTIFACT,
    runId: input.runId,
  })
  if (artifact.status === "error") {
    return artifact
  }

  let value: unknown
  try {
    value = JSON.parse(artifact.value) as unknown
  } catch {
    return oracleErrorResult("unavailable", "Immutable read-back evidence is not valid JSON")
  }

  const parsed = readBackRecordSchema.safeParse(value)
  if (!parsed.success || !recordIsConsistent(parsed.data)) {
    return oracleErrorResult("unavailable", "Immutable read-back evidence is malformed")
  }
  const { digest, ...recordBody } = parsed.data
  if (recordDigest(recordBody) !== digest) {
    return oracleErrorResult("unavailable", "Immutable read-back evidence digest does not match")
  }

  return {
    status: "ok",
    value: parsed.data,
  }
}
