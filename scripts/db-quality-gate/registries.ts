import { z } from "zod"

import { compareStrings } from "./serialization"
import type { RegistryValidation, ValidationFinding } from "./types"

const SHA1_PATTERN = /^[a-f0-9]{40}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

const lockEntrySchema = z
  .object({
    path: z.string().min(1),
    sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

const appliedLockSchema = z
  .object({
    applied: z.array(lockEntrySchema),
    cutover: z
      .object({
        commit: z.string().regex(SHA1_PATTERN),
        migrationRoot: z.string().min(1),
      })
      .strict(),
    legacy: z.array(lockEntrySchema),
    schemaVersion: z.literal(1),
  })
  .strict()

const invariantsSchema = z
  .object({
    schemaVersion: z.literal(1),
    tables: z.array(
      z
        .object({
          allowedOperations: z.array(z.string().min(1)).min(1),
          classification: z.string().min(1),
          enforcement: z.string().min(1),
          evidence: z.string().min(1),
          owner: z.string().min(1),
          table: z.string().min(1),
        })
        .strict()
    ),
  })
  .strict()

const sqlTestsSchema = z
  .object({
    schemaVersion: z.literal(1),
    tests: z.array(
      z
        .object({
          evidence: z.string().min(1),
          fixture: z.string().min(1),
          path: z.string().min(1),
          purpose: z.string().min(1),
          runner: z.enum(["psql"]),
          safety: z.enum(["default-safe", "opt-in", "performance", "concurrency", "live-only"]),
          timeoutMs: z.number().int().positive(),
          transaction: z.enum(["rollback-required", "isolated-database"]),
        })
        .strict()
    ),
  })
  .strict()

const waiverApprovalSchema = z
  .object({
    approvalCommit: z.string().regex(SHA1_PATTERN),
    candidateCommit: z.string().regex(SHA1_PATTERN),
    candidateReportDigest: z.string().regex(SHA256_PATTERN),
    expiresAt: z.string().datetime().optional(),
    findingFingerprint: z.string().regex(SHA256_PATTERN),
    id: z.string().min(1),
    migrationSha256: z.string().regex(SHA256_PATTERN),
    reviewEvidence: z.string().min(1),
    revokedAt: z.string().datetime().optional(),
    ruleId: z.string().min(1),
    status: z.enum(["active", "revoked", "superseded"]),
  })
  .strict()

const waiversSchema = z
  .object({
    approvals: z.array(waiverApprovalSchema),
    schemaVersion: z.literal(1),
  })
  .strict()

const TABLE_CLASSIFICATIONS = new Set([
  "app-facing",
  "intentionally-public",
  "rpc-only",
  "server-only",
])

export type AppliedMigrationLock = z.infer<typeof appliedLockSchema>
type RegistryInput = {
  appliedLock: unknown
  invariants: unknown
  previousAppliedLock?: unknown
  sqlTests: unknown
  waivers: unknown
}

function hasSchemaVersion(value: unknown, schemaVersion: number): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "schemaVersion" in value &&
    value.schemaVersion === schemaVersion
  )
}

function finding(
  ruleId: string,
  classification: ValidationFinding["classification"]
): ValidationFinding {
  return { classification, ruleId }
}

function includesAllPreviousEntries(
  previous: AppliedMigrationLock,
  current: AppliedMigrationLock
): boolean {
  const currentEntries = new Map(
    [...current.legacy, ...current.applied].map((entry) => [entry.path, entry.sha256])
  )

  return [...previous.legacy, ...previous.applied].every(
    (entry) => currentEntries.get(entry.path) === entry.sha256
  )
}

/** Parses the strict append-only applied migration lock or returns no result. */
export function parseAppliedMigrationLock(value: unknown): AppliedMigrationLock | undefined {
  const result = appliedLockSchema.safeParse(value)

  return result.success ? result.data : undefined
}

/** Validates all committed registry shapes and append-only lock history. */
export function validateRegistrySet(input: RegistryInput): RegistryValidation {
  const findings: ValidationFinding[] = []
  const appliedLockResult = appliedLockSchema.safeParse(input.appliedLock)
  const invariantsResult = invariantsSchema.safeParse(input.invariants)
  const sqlTestsResult = sqlTestsSchema.safeParse(input.sqlTests)
  const waiversResult = waiversSchema.safeParse(input.waivers)

  if (!appliedLockResult.success) {
    findings.push(
      finding(
        hasSchemaVersion(input.appliedLock, 1)
          ? "registry.applied-lock.schema"
          : "registry.applied-lock.schema-version",
        "BLOCKING"
      )
    )
  }

  if (!invariantsResult.success) {
    findings.push(
      finding(
        hasSchemaVersion(input.invariants, 1)
          ? "registry.invariants.schema"
          : "registry.invariants.schema-version",
        "INCOMPLETE"
      )
    )
  }

  if (!sqlTestsResult.success) {
    findings.push(
      finding(
        hasSchemaVersion(input.sqlTests, 1)
          ? "registry.sql-tests.schema"
          : "registry.sql-tests.schema-version",
        "BLOCKING"
      )
    )
  }

  if (!waiversResult.success) {
    findings.push(
      finding(
        hasSchemaVersion(input.waivers, 1)
          ? "registry.waivers.schema"
          : "registry.waivers.schema-version",
        "BLOCKING"
      )
    )
  }

  if (invariantsResult.success) {
    for (const table of invariantsResult.data.tables) {
      if (!TABLE_CLASSIFICATIONS.has(table.classification)) {
        findings.push(finding("registry.invariants.table-intent", "INCOMPLETE"))
      }
    }
  }

  if (appliedLockResult.success && input.previousAppliedLock !== undefined) {
    const previousAppliedLockResult = appliedLockSchema.safeParse(input.previousAppliedLock)

    if (
      !previousAppliedLockResult.success ||
      !includesAllPreviousEntries(previousAppliedLockResult.data, appliedLockResult.data)
    ) {
      findings.push(finding("registry.applied-lock.append-only", "BLOCKING"))
    }
  }

  return {
    findings: findings.sort((left, right) => compareStrings(left.ruleId, right.ruleId)),
    valid: findings.length === 0,
  }
}
