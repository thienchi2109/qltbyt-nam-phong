import { z } from "zod"

import { preservesAppliedLockHistory } from "./applied-lock-history"
import { validConfirmation } from "./baseline-state"
import { validateExpectedStateRegistries } from "./expected-state-registry"
import { compareStrings, stableJsonStringify } from "./serialization"
import type { RegistryValidation, ValidationFinding } from "./types"
import type { InvariantRegistry, SqlTestRegistry } from "./expected-state-registry"

export {
  parseInvariantRegistry,
  parseSqlTestRegistry,
  TABLE_CLASSIFICATIONS,
  validateExpectedStateRegistries,
} from "./expected-state-registry"
export type {
  InvariantRegistry,
  ResolvedInvariant,
  SqlTestRegistry,
} from "./expected-state-registry"

const SHA1_PATTERN = /^[a-f0-9]{40}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CANONICAL_MIGRATION_ROOT = "supabase/migrations"
const CANONICAL_MIGRATION_PATH_PATTERN = /^supabase\/migrations\/[^/]+\.sql$/
const ORACLE_READ_BACK_EVIDENCE_PATTERN = /^oracle:[a-z0-9][a-z0-9._-]*\/read-back\.json$/u

const legacyLockEntrySchema = z
  .object({
    path: z.string().regex(CANONICAL_MIGRATION_PATH_PATTERN),
    sha256: z.string().regex(SHA256_PATTERN),
  })
  .strict()

const appliedLockEntrySchema = legacyLockEntrySchema
  .extend({
    liveName: z.string().min(1),
    liveVersion: z.string().regex(/^\d{14}$/u),
    readBackDigest: z.string().regex(SHA256_PATTERN),
    readBackEvidenceId: z.string().regex(ORACLE_READ_BACK_EVIDENCE_PATTERN),
  })
  .strict()
  .refine(
    (entry) => validConfirmation(entry),
    "Applied migration authority must match the canonical migration path"
  )

const appliedLockSchema = z
  .object({
    applied: z.array(appliedLockEntrySchema),
    cutover: z
      .object({
        commit: z.string().regex(SHA1_PATTERN),
        legacyInventorySha256: z.string().regex(SHA256_PATTERN),
        migrationRoot: z.literal(CANONICAL_MIGRATION_ROOT),
      })
      .strict(),
    legacy: z.array(legacyLockEntrySchema),
    schemaVersion: z.literal(1),
  })
  .strict()
  .refine(
    (lock) =>
      lock.applied.every(
        (entry, index) => index === 0 || entry.liveVersion > lock.applied[index - 1].liveVersion
      ),
    "Applied migration authority must be strictly ordered by unique live version"
  )

const waiverApprovalSchema = z
  .object({
    approvalCommit: z.string().regex(SHA1_PATTERN),
    approvedAt: z.string().datetime(),
    approver: z.string().min(1),
    approvalUrl: z.string().url(),
    candidateCommit: z.string().regex(SHA1_PATTERN),
    candidateReportDigest: z.string().regex(SHA256_PATTERN),
    classification: z.literal("DANGEROUS"),
    compensatingControls: z.string().min(1),
    expiresAt: z.string().datetime().optional(),
    findingFingerprint: z.string().regex(SHA256_PATTERN),
    id: z.string().min(1),
    migrationPath: z.string().min(1),
    migrationSha256: z.string().regex(SHA256_PATTERN),
    objectScope: z.string().min(1),
    rationale: z.string().min(1),
    recoveryPlan: z.string().min(1),
    rejectedAlternatives: z.string().min(1),
    reviewEvidence: z.string().min(1),
    riskAndImpact: z.string().min(1),
    revokedAt: z.string().datetime().optional(),
    ruleId: z.string().min(1),
    statementScope: z.string().min(1),
    status: z.enum(["active", "revoked", "superseded"]),
    supersedes: z.string().min(1).optional(),
    validation: z.string().min(1),
  })
  .strict()

const waiversSchema = z
  .object({
    approvals: z.array(waiverApprovalSchema),
    schemaVersion: z.literal(1),
  })
  .strict()

export type AppliedMigrationLock = z.infer<typeof appliedLockSchema>
export type WaiverRegistry = z.infer<typeof waiversSchema>
type RegistryInput = {
  appliedLock: unknown
  invariants: unknown
  previousAppliedLock?: unknown
  previousWaivers?: unknown
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

function hasUniqueLockPaths(lock: AppliedMigrationLock): boolean {
  const paths = [...lock.legacy, ...lock.applied].map((entry) => entry.path)

  return new Set(paths).size === paths.length
}

function hasValidWaiverStatus(approval: WaiverRegistry["approvals"][number]): boolean {
  if (approval.status === "active") {
    return approval.revokedAt === undefined
  }

  if (approval.status === "revoked") {
    return approval.revokedAt !== undefined && approval.supersedes !== undefined
  }

  return approval.revokedAt === undefined && approval.supersedes !== undefined
}

function hasValidWaiverTransitions(waivers: WaiverRegistry): boolean {
  const approvalsById = new Map<string, WaiverRegistry["approvals"][number]>()
  const supersededApprovalIds = new Set<string>()

  return waivers.approvals.every((approval) => {
    if (approvalsById.has(approval.id)) {
      return false
    }

    if (!hasValidWaiverStatus(approval)) {
      return false
    }

    if (approval.supersedes !== undefined) {
      const supersededApproval = approvalsById.get(approval.supersedes)
      if (
        supersededApproval === undefined ||
        supersededApprovalIds.has(approval.supersedes) ||
        approval.candidateCommit !== supersededApproval.candidateCommit ||
        approval.candidateReportDigest !== supersededApproval.candidateReportDigest ||
        approval.findingFingerprint !== supersededApproval.findingFingerprint ||
        approval.migrationPath !== supersededApproval.migrationPath ||
        approval.migrationSha256 !== supersededApproval.migrationSha256 ||
        approval.objectScope !== supersededApproval.objectScope ||
        approval.ruleId !== supersededApproval.ruleId ||
        approval.statementScope !== supersededApproval.statementScope
      ) {
        return false
      }
      supersededApprovalIds.add(approval.supersedes)
    }

    approvalsById.set(approval.id, approval)
    return true
  })
}

/** Keeps waiver evidence additive so an approval can be revoked or superseded only by a new record. */
export function preservesWaiverHistory(previous: WaiverRegistry, current: WaiverRegistry): boolean {
  const currentApprovals = current.approvals.map((approval) => stableJsonStringify(approval))

  return (
    new Set(currentApprovals).size === currentApprovals.length &&
    previous.approvals.every(
      (approval, index) => stableJsonStringify(approval) === currentApprovals[index]
    )
  )
}

/** Parses the strict append-only applied migration lock or returns no result. */
export function parseAppliedMigrationLock(value: unknown): AppliedMigrationLock | undefined {
  const result = appliedLockSchema.safeParse(value)

  return result.success && hasUniqueLockPaths(result.data) ? result.data : undefined
}

/** Parses committed waivers without treating malformed metadata as approval evidence. */
export function parseWaiverRegistry(value: unknown): WaiverRegistry | undefined {
  const result = waiversSchema.safeParse(value)

  return result.success && hasValidWaiverTransitions(result.data) ? result.data : undefined
}

/** Validates all committed registry shapes and append-only lock history. */
export function validateRegistrySet(input: RegistryInput): RegistryValidation {
  const findings: ValidationFinding[] = []
  const appliedLockResult = appliedLockSchema.safeParse(input.appliedLock)
  const expectedStateValidation = validateExpectedStateRegistries(input)
  const waivers = parseWaiverRegistry(input.waivers)
  const appliedLock =
    appliedLockResult.success && hasUniqueLockPaths(appliedLockResult.data)
      ? appliedLockResult.data
      : undefined

  if (appliedLock === undefined) {
    findings.push(
      finding(
        hasSchemaVersion(input.appliedLock, 1)
          ? "registry.applied-lock.schema"
          : "registry.applied-lock.schema-version",
        "BLOCKING"
      )
    )
  }

  if (waivers === undefined) {
    findings.push(
      finding(
        hasSchemaVersion(input.waivers, 1)
          ? "registry.waivers.schema"
          : "registry.waivers.schema-version",
        "BLOCKING"
      )
    )
  }

  if (appliedLock !== undefined && input.previousAppliedLock !== undefined) {
    const previousAppliedLock = parseAppliedMigrationLock(input.previousAppliedLock)

    if (
      previousAppliedLock === undefined ||
      !preservesAppliedLockHistory(previousAppliedLock, appliedLock)
    ) {
      findings.push(finding("registry.applied-lock.append-only", "BLOCKING"))
    }
  }

  if (waivers !== undefined && input.previousWaivers !== undefined) {
    const previousWaivers = parseWaiverRegistry(input.previousWaivers)

    if (previousWaivers === undefined || !preservesWaiverHistory(previousWaivers, waivers)) {
      findings.push(finding("registry.waivers.append-only", "BLOCKING"))
    }
  }

  return {
    findings: [...findings, ...expectedStateValidation.findings].sort((left, right) =>
      compareStrings(left.ruleId, right.ruleId)
    ),
    valid: findings.length === 0 && expectedStateValidation.valid,
  }
}
