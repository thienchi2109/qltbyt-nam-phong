import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"

import { reportDigest, serializeReport } from "./contract"
import {
  listFilesAtCommit,
  readFileAtCommit,
  resolveGitCommit,
  worktreeIsClean,
} from "./git-evidence"
import { isCanonicalMigrationPath } from "./migration-source"
import { parseGateReport } from "./pre-live-report"
import { artifactMatchesCommit, readJsonArtifact } from "./static-artifacts"
import { sha256Text } from "./serialization"
import type {
  ReviewedMigrationSelector,
  ReviewedMigrationSelectorInput,
  SelectorResult,
} from "./static-lane-types"
import type { GateReport } from "./types"

const SHA1_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/

/** Canonical repository root for immutable candidate static reports. */
export const STATIC_CANDIDATE_EVIDENCE_ROOT = "supabase/db-quality-gate-static-evidence"

/** Returns the one canonical committed path for a candidate static report. */
export function candidateStaticEvidencePath(candidateCommit: string): string | undefined {
  return SHA1_PATTERN.test(candidateCommit)
    ? `${STATIC_CANDIDATE_EVIDENCE_ROOT}/${candidateCommit}.json`
    : undefined
}

/** Includes candidate static reports in local and landed static-gate triggers. */
export function isCandidateStaticEvidencePath(filePath: string): boolean {
  return filePath.startsWith(`${STATIC_CANDIDATE_EVIDENCE_ROOT}/`) && filePath.endsWith(".json")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

function isWithinDirectory(directory: string, target: string): boolean {
  const relative = path.relative(directory, target)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}

function incompleteSelector(reason: string): SelectorResult {
  return { ok: false, outcome: "INCOMPLETE", reason }
}

/** Validates exact subject, tracked migration paths, and raw file bytes for reviewed static evidence. */
export function validateReviewedMigrationSelector(
  input: ReviewedMigrationSelectorInput
): SelectorResult {
  if (!isRecord(input.selector) || !exactKeys(input.selector, ["subjectCommit", "migrations"])) {
    return incompleteSelector(
      "Reviewed migration selector must contain subjectCommit and migrations"
    )
  }

  const subjectCommit = input.selector.subjectCommit
  const migrations = input.selector.migrations
  if (
    typeof subjectCommit !== "string" ||
    !SHA1_PATTERN.test(subjectCommit) ||
    subjectCommit !== input.subjectCommit
  ) {
    return incompleteSelector(
      "Reviewed migration selector subjectCommit does not match the subject"
    )
  }
  if (!Array.isArray(migrations) || migrations.length === 0) {
    return incompleteSelector("Reviewed migration selector migrations must be non-empty")
  }
  if (resolveGitCommit(input.repositoryRoot, input.subjectCommit) !== input.subjectCommit) {
    return incompleteSelector("Reviewed migration selector subject commit is unavailable")
  }

  const trackedPaths = listFilesAtCommit(
    input.repositoryRoot,
    input.subjectCommit,
    "supabase/migrations"
  )
  if (trackedPaths === undefined) {
    return incompleteSelector("Reviewed migration selector source tree is unavailable")
  }
  const trackedMigrationPaths = new Set(
    trackedPaths.filter((filePath) => isCanonicalMigrationPath(filePath))
  )
  const seenPaths = new Set<string>()
  let repositoryDirectory: string
  let migrationDirectory: string
  try {
    repositoryDirectory = realpathSync(input.repositoryRoot)
    migrationDirectory = realpathSync(path.join(input.repositoryRoot, "supabase/migrations"))
  } catch {
    return incompleteSelector("Reviewed migration selector checkout is unavailable")
  }

  const validatedMigrations: ReviewedMigrationSelector["migrations"] = []
  for (const migration of migrations) {
    if (!isRecord(migration) || !exactKeys(migration, ["path", "sha256"])) {
      return incompleteSelector("Reviewed migration selector entry is malformed")
    }

    const migrationPath = migration.path
    const expectedSha256 = migration.sha256
    if (
      typeof migrationPath !== "string" ||
      migrationPath.includes("\\") ||
      path.posix.normalize(migrationPath) !== migrationPath ||
      !isCanonicalMigrationPath(migrationPath) ||
      !trackedMigrationPaths.has(migrationPath)
    ) {
      return incompleteSelector(
        `Reviewed migration selector path is not tracked: ${String(migrationPath)}`
      )
    }
    if (seenPaths.has(migrationPath)) {
      return incompleteSelector(`Reviewed migration selector path is duplicated: ${migrationPath}`)
    }
    if (typeof expectedSha256 !== "string" || !SHA256_PATTERN.test(expectedSha256)) {
      return incompleteSelector(
        `Reviewed migration selector SHA-256 is malformed: ${migrationPath}`
      )
    }
    seenPaths.add(migrationPath)

    const committedContent = readFileAtCommit(
      input.repositoryRoot,
      input.subjectCommit,
      migrationPath
    )
    if (committedContent === undefined) {
      return incompleteSelector(
        `Reviewed migration selector source is unreadable: ${migrationPath}`
      )
    }
    const committedSha256 = sha256Text(committedContent)
    if (committedSha256 !== expectedSha256) {
      return incompleteSelector(
        `Reviewed migration selector SHA-256 mismatches commit: ${migrationPath}`
      )
    }

    const worktreePath = path.resolve(input.repositoryRoot, migrationPath)
    let resolvedWorktreePath: string
    let worktreeContent: string
    try {
      resolvedWorktreePath = realpathSync(worktreePath)
      if (
        !isWithinDirectory(repositoryDirectory, resolvedWorktreePath) ||
        !isWithinDirectory(migrationDirectory, resolvedWorktreePath) ||
        (!lstatSync(worktreePath).isFile() && !lstatSync(worktreePath).isSymbolicLink())
      ) {
        return incompleteSelector(
          `Reviewed migration selector path escapes checkout: ${migrationPath}`
        )
      }
      worktreeContent = readFileSync(worktreePath, "utf8")
    } catch {
      return incompleteSelector(
        `Reviewed migration selector source is unreadable: ${migrationPath}`
      )
    }
    if (sha256Text(worktreeContent) !== expectedSha256) {
      return incompleteSelector(
        `Reviewed migration selector SHA-256 mismatches worktree: ${migrationPath}`
      )
    }

    validatedMigrations.push({ path: migrationPath, sha256: expectedSha256 })
  }

  return {
    ok: true,
    selector: {
      subjectCommit,
      migrations: validatedMigrations,
    },
  }
}

/** Reads a complete candidate report only when it is immutable at the final commit. */
export function readCandidateStaticEvidence(input: {
  candidateCommit: string
  finalCommit: string
  repositoryRoot: string
}): GateReport | undefined {
  const evidencePath = candidateStaticEvidencePath(input.candidateCommit)
  if (
    evidencePath === undefined ||
    !artifactMatchesCommit(input.repositoryRoot, input.finalCommit, evidencePath)
  ) {
    return undefined
  }

  const report = parseGateReport(readJsonArtifact(input.repositoryRoot, evidencePath))
  if (
    report === undefined ||
    report.lane !== "static" ||
    report.subjectCommit !== input.candidateCommit ||
    report.requiredChecksComplete !== true ||
    report.evidenceAvailable !== true ||
    report.digest !== reportDigest(report) ||
    report.findings.some((finding) => finding.classification === "BLOCKING")
  ) {
    return undefined
  }

  return report
}

/** Persists one immutable candidate report for later maintainer approval. */
export function persistCandidateStaticEvidence(
  repositoryRoot: string,
  report: GateReport
): string | undefined {
  const evidencePath = candidateStaticEvidencePath(report.subjectCommit)
  if (
    !worktreeIsClean(repositoryRoot) ||
    evidencePath === undefined ||
    report.lane !== "static" ||
    report.outcome !== "FAILED" ||
    report.requiredChecksComplete !== true ||
    report.evidenceAvailable !== true ||
    report.digest !== reportDigest(report) ||
    !report.findings.some((finding) => finding.classification === "DANGEROUS") ||
    report.findings.some((finding) => finding.classification === "BLOCKING")
  ) {
    return undefined
  }

  const absolutePath = path.join(repositoryRoot, evidencePath)
  const content = serializeReport(report)
  if (existsSync(absolutePath)) {
    return readFileSync(absolutePath, "utf8") === content ? evidencePath : undefined
  }

  mkdirSync(path.dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content, { flag: "wx" })
  return evidencePath
}
