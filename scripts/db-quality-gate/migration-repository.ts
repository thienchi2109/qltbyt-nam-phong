import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

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
  previousAppliedLock?: unknown
  repositoryRoot: string
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

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

function preservesLockHistory(
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

function sourceOrderFinding(
  repositoryRoot: string,
  migrationRoot: string,
  hasLockedMigrationInRoot: boolean
): RepositoryFinding | undefined {
  const sourceDirectory = resolveRepositoryPath(repositoryRoot, migrationRoot)

  if (sourceDirectory === undefined || !existsSync(sourceDirectory)) {
    if (hasLockedMigrationInRoot) {
      return undefined
    }

    return {
      classification: "INCOMPLETE",
      ruleId: "migration.source-root",
    }
  }

  const prefixes = new Set<string>()

  for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue
    }

    const match = /^(\d{14})_/.exec(entry.name)
    if (match === null) {
      continue
    }

    if (prefixes.has(match[1])) {
      return {
        classification: "INCOMPLETE",
        ruleId: "migration.source-order",
      }
    }

    prefixes.add(match[1])
  }

  return undefined
}

function outcomeForFindings(findings: RepositoryFinding[]): RepositoryInspection["outcome"] {
  if (findings.some((finding) => finding.classification === "INCOMPLETE")) {
    return "INCOMPLETE"
  }

  return findings.length > 0 ? "FAILED" : "PASS"
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

  if (input.previousAppliedLock !== undefined) {
    const previousAppliedLock = parseAppliedMigrationLock(input.previousAppliedLock)

    if (
      previousAppliedLock === undefined ||
      !preservesLockHistory(previousAppliedLock, currentLock)
    ) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "migration.lock-history",
      })
    }
  }

  for (const legacyEntry of currentLock.legacy) {
    const migrationPath = resolveRepositoryPath(input.repositoryRoot, legacyEntry.path)

    if (migrationPath === undefined || !existsSync(migrationPath)) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "migration.legacy-path",
      })
      continue
    }

    if (sha256(readFileSync(migrationPath, "utf8")) !== legacyEntry.sha256) {
      findings.push({
        classification: "BLOCKING",
        ruleId: "migration.legacy-content",
      })
    }
  }

  const sourceOrder = sourceOrderFinding(
    input.repositoryRoot,
    currentLock.cutover.migrationRoot,
    currentLock.legacy.some((entry) =>
      entry.path.startsWith(`${currentLock.cutover.migrationRoot}/`)
    )
  )
  if (sourceOrder !== undefined) {
    findings.push(sourceOrder)
  }

  return {
    findings: findings.sort((left, right) => compareStrings(left.ruleId, right.ruleId)),
    outcome: outcomeForFindings(findings),
  }
}
