import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { hasAppendedAppliedEntries, preservesAppliedLockHistory } from "./applied-lock-history"
import {
  currentHeadCommit,
  isAncestorCommit,
  readFileAtCommit,
  resolveGitCommit,
} from "./git-evidence"
import {
  inspectCanonicalMigrationSource,
  inspectCanonicalMigrationSourceAtCommit,
  migrationContentSha256,
} from "./migration-source"
import { legacyInventoryDigest } from "./bootstrap"
import { parseAppliedMigrationLock } from "./registries"
import { compareStrings } from "./serialization"
import type { AppliedMigrationLock } from "./registries"

type RepositoryFinding = {
  classification: "BLOCKING" | "INCOMPLETE"
  ruleId: string
}

type RepositoryInspection = {
  findings: RepositoryFinding[]
  outcome: "FAILED" | "INCOMPLETE" | "PASS"
}

type RepositoryInspectionInput = {
  bootstrapBaseRef?: string
  previousAppliedLock?: unknown
  protectedRef?: string
  repositoryRoot: string
}

const DEFAULT_PROTECTED_REF = "origin/main"

function readAppliedLock(repositoryRoot: string): AppliedMigrationLock | undefined {
  const lockPath = path.join(repositoryRoot, "supabase", "applied-migrations.lock.json")

  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as unknown
    return parseAppliedMigrationLock(parsed)
  } catch {
    return undefined
  }
}

function resolveRepositoryPath(repositoryRoot: string, relativePath: string): string | undefined {
  const resolved = path.resolve(repositoryRoot, relativePath)
  const rootPrefix = `${path.resolve(repositoryRoot)}${path.sep}`

  return resolved.startsWith(rootPrefix) ? resolved : undefined
}

function outcomeForFindings(findings: RepositoryFinding[]): RepositoryInspection["outcome"] {
  if (findings.some((finding) => finding.classification === "INCOMPLETE")) {
    return "INCOMPLETE"
  }

  return findings.length > 0 ? "FAILED" : "PASS"
}

function exactEntriesMatch(
  left: AppliedMigrationLock["legacy"],
  right: AppliedMigrationLock["legacy"]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) => entry.path === right[index]?.path && entry.sha256 === right[index]?.sha256
    )
  )
}

/** Inspects migration source and lock history without mutating the repository or database. */
export function inspectMigrationRepository(input: RepositoryInspectionInput): RepositoryInspection {
  const findings: RepositoryFinding[] = []
  const currentLock = readAppliedLock(input.repositoryRoot)

  if (currentLock === undefined) {
    return {
      findings: [
        {
          classification: "INCOMPLETE",
          ruleId: "migration.applied-lock",
        },
      ],
      outcome: "INCOMPLETE",
    }
  }

  if (currentLock.cutover.legacyInventorySha256 !== legacyInventoryDigest(currentLock.legacy)) {
    findings.push({
      classification: "BLOCKING",
      ruleId: "migration.legacy-inventory-digest",
    })
  }

  if (input.previousAppliedLock !== undefined) {
    const previousAppliedLock = parseAppliedMigrationLock(input.previousAppliedLock)

    if (
      previousAppliedLock === undefined ||
      !preservesAppliedLockHistory(previousAppliedLock, currentLock)
    ) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "migration.lock-history",
      })
    } else if (hasAppendedAppliedEntries(previousAppliedLock, currentLock)) {
      findings.push({
        classification: "INCOMPLETE",
        ruleId: "migration.applied-readback",
      })
    }
  }

  const cutoverCommit = resolveGitCommit(input.repositoryRoot, currentLock.cutover.commit)
  const headCommit = currentHeadCommit(input.repositoryRoot)
  let cutoverMigrationHashes: Map<string, string> | undefined
  if (cutoverCommit === undefined) {
    findings.push({
      classification: "INCOMPLETE",
      ruleId: "migration.cutover-commit",
    })
  } else if (
    headCommit === undefined ||
    !isAncestorCommit(input.repositoryRoot, cutoverCommit, headCommit)
  ) {
    findings.push({
      classification: "INCOMPLETE",
      ruleId: "migration.cutover-ancestry",
    })
  } else {
    const protectedMainCommit = resolveGitCommit(
      input.repositoryRoot,
      input.protectedRef ?? DEFAULT_PROTECTED_REF
    )
    if (
      protectedMainCommit === undefined ||
      !isAncestorCommit(input.repositoryRoot, cutoverCommit, protectedMainCommit)
    ) {
      findings.push({
        classification: "INCOMPLETE",
        ruleId: "migration.cutover-protected-ref",
      })
    }

    if (
      input.bootstrapBaseRef !== undefined &&
      resolveGitCommit(input.repositoryRoot, input.bootstrapBaseRef) !== cutoverCommit
    ) {
      findings.push({
        classification: "INCOMPLETE",
        ruleId: "migration.cutover-bootstrap-base",
      })
    }

    const cutoverSource = inspectCanonicalMigrationSourceAtCommit({
      commit: cutoverCommit,
      migrationRoot: currentLock.cutover.migrationRoot,
      repositoryRoot: input.repositoryRoot,
    })
    if (cutoverSource.outcome === "INCOMPLETE") {
      findings.push({
        classification: "INCOMPLETE",
        ruleId: "migration.legacy-cutover-source",
      })
    } else if (!exactEntriesMatch(currentLock.legacy, cutoverSource.migrationIdentities)) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "migration.legacy-cutover-membership",
      })
    } else {
      cutoverMigrationHashes = new Map(
        cutoverSource.migrationIdentities.map((migration) => [migration.path, migration.sha256])
      )
    }
  }

  for (const [entryType, lockedEntry] of [
    ...currentLock.legacy.map((entry) => ["legacy", entry] as const),
    ...currentLock.applied.map((entry) => ["applied", entry] as const),
  ]) {
    const migrationPath = resolveRepositoryPath(input.repositoryRoot, lockedEntry.path)

    if (migrationPath === undefined || !existsSync(migrationPath)) {
      findings.push({
        classification: "BLOCKING",
        ruleId: `migration.${entryType}-path`,
      })
      continue
    }

    if (migrationContentSha256(readFileSync(migrationPath, "utf8")) !== lockedEntry.sha256) {
      findings.push({
        classification: "BLOCKING",
        ruleId: `migration.${entryType}-content`,
      })
    }

    if (entryType === "legacy" && cutoverCommit !== undefined) {
      const cutoverMigrationHash = cutoverMigrationHashes?.get(lockedEntry.path)
      if (cutoverMigrationHash !== undefined) {
        if (cutoverMigrationHash !== lockedEntry.sha256) {
          findings.push({
            classification: "BLOCKING",
            ruleId: "migration.legacy-cutover-content",
          })
        }
      } else {
        const cutoverContent = readFileAtCommit(
          input.repositoryRoot,
          cutoverCommit,
          lockedEntry.path
        )
        if (cutoverContent === undefined) {
          findings.push({
            classification: "BLOCKING",
            ruleId: "migration.legacy-cutover-path",
          })
        } else if (migrationContentSha256(cutoverContent) !== lockedEntry.sha256) {
          findings.push({
            classification: "BLOCKING",
            ruleId: "migration.legacy-cutover-content",
          })
        }
      }
    }
  }

  const sourceInspection = inspectCanonicalMigrationSource({
    migrationRoot: currentLock.cutover.migrationRoot,
    repositoryRoot: input.repositoryRoot,
  })
  for (const finding of sourceInspection.findings) {
    if (
      finding.ruleId === "migration.source-root" &&
      currentLock.legacy.some((entry) =>
        entry.path.startsWith(`${currentLock.cutover.migrationRoot}/`)
      )
    ) {
      continue
    }

    findings.push({
      classification: "INCOMPLETE",
      ruleId: finding.ruleId,
    })
  }

  return {
    findings: findings.sort((left, right) => compareStrings(left.ruleId, right.ruleId)),
    outcome: outcomeForFindings(findings),
  }
}
