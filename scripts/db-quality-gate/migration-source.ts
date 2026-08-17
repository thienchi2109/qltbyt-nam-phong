import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { listFilesAtCommit, readFileAtCommit } from "./git-evidence"
import { compareStrings } from "./serialization"
import { sha256Text } from "./serialization"
import type { MigrationIdentity } from "./types"

type SourceFinding = {
  ruleId: "migration.source-order" | "migration.source-root"
}

type SourceInspection = {
  findings: SourceFinding[]
  migrationIdentities: MigrationIdentity[]
  outcome: "INCOMPLETE" | "PASS"
}

type SourceInspectionInput = {
  migrationRoot?: string
  repositoryRoot: string
}

type ProtectedCutoverBootstrap = {
  migrationIdentities: MigrationIdentity[]
  migrationRoot: string
  status: "PENDING_PROTECTED_MAIN"
}

const DEFAULT_MIGRATION_ROOT = "supabase/migrations"

/** Removes exactly one trailing LF so migration identity is newline-stable. */
export function canonicalizeMigrationContent(content: string): string {
  return content.endsWith("\n") ? content.slice(0, -1) : content
}

/** Hashes migration content after the one-terminal-LF normalization. */
export function migrationContentSha256(content: string): string {
  return sha256Text(canonicalizeMigrationContent(content))
}

function resolveRepositoryPath(repositoryRoot: string, relativePath: string): string | undefined {
  const resolved = path.resolve(repositoryRoot, relativePath)
  const rootPrefix = `${path.resolve(repositoryRoot)}${path.sep}`

  return resolved.startsWith(rootPrefix) ? resolved : undefined
}

function migrationVersion(fileName: string): string | undefined {
  return /^(\d{14})_/.exec(fileName)?.[1]
}

/** Reports whether a repository-relative path is a direct root migration SQL source file. */
export function isCanonicalMigrationPath(
  filePath: string,
  migrationRoot = DEFAULT_MIGRATION_ROOT
): boolean {
  const normalizedRoot = migrationRoot.replaceAll("\\", "/").replace(/\/+$/, "")
  const normalizedPath = filePath.replaceAll("\\", "/")
  const prefix = `${normalizedRoot}/`
  const relativePath = normalizedPath.startsWith(prefix)
    ? normalizedPath.slice(prefix.length)
    : undefined

  return (
    relativePath !== undefined &&
    !relativePath.includes("/") &&
    relativePath.length > ".sql".length &&
    relativePath.endsWith(".sql")
  )
}

/** Inventories the canonical direct-root migration source without guessing nested support-history order. */
export function inspectCanonicalMigrationSource(input: SourceInspectionInput): SourceInspection {
  const migrationRoot = input.migrationRoot ?? DEFAULT_MIGRATION_ROOT
  const sourceDirectory = resolveRepositoryPath(input.repositoryRoot, migrationRoot)

  if (sourceDirectory === undefined) {
    return {
      findings: [{ ruleId: "migration.source-root" }],
      migrationIdentities: [],
      outcome: "INCOMPLETE",
    }
  }

  let fileNames: string[]
  try {
    fileNames = readdirSync(sourceDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort(compareStrings)
  } catch {
    return {
      findings: [{ ruleId: "migration.source-root" }],
      migrationIdentities: [],
      outcome: "INCOMPLETE",
    }
  }

  const versions = new Set<string>()
  const findings: SourceFinding[] = []

  for (const fileName of fileNames) {
    const version = migrationVersion(fileName)

    if (version !== undefined && versions.has(version)) {
      findings.push({ ruleId: "migration.source-order" })
      break
    }

    if (version !== undefined) {
      versions.add(version)
    }
  }

  const migrationIdentities = fileNames.map((fileName) => {
    const relativePath = `${migrationRoot}/${fileName}`
    return {
      path: relativePath,
      sha256: migrationContentSha256(readFileSync(path.join(sourceDirectory, fileName), "utf8")),
    }
  })

  return {
    findings,
    migrationIdentities,
    outcome: findings.length === 0 ? "PASS" : "INCOMPLETE",
  }
}

/** Inventories the immutable direct-root migration source stored at one resolved Git commit. */
export function inspectCanonicalMigrationSourceAtCommit(
  input: SourceInspectionInput & { commit: string }
): SourceInspection {
  const migrationRoot = input.migrationRoot ?? DEFAULT_MIGRATION_ROOT
  const paths = listFilesAtCommit(input.repositoryRoot, input.commit, migrationRoot)
  if (paths === undefined) {
    return {
      findings: [{ ruleId: "migration.source-root" }],
      migrationIdentities: [],
      outcome: "INCOMPLETE",
    }
  }

  const migrationPaths = paths
    .filter((filePath) => isCanonicalMigrationPath(filePath, migrationRoot))
    .sort(compareStrings)
  const versions = new Set<string>()
  const findings: SourceFinding[] = []

  for (const migrationPath of migrationPaths) {
    const version = migrationVersion(path.basename(migrationPath))
    if (version !== undefined && versions.has(version)) {
      findings.push({ ruleId: "migration.source-order" })
      break
    }
    if (version !== undefined) {
      versions.add(version)
    }
  }

  const migrationIdentities: MigrationIdentity[] = []
  for (const migrationPath of migrationPaths) {
    const content = readFileAtCommit(input.repositoryRoot, input.commit, migrationPath)
    if (content === undefined) {
      return {
        findings: [{ ruleId: "migration.source-root" }],
        migrationIdentities: [],
        outcome: "INCOMPLETE",
      }
    }
    migrationIdentities.push({
      path: migrationPath,
      sha256: migrationContentSha256(content),
    })
  }

  return {
    findings,
    migrationIdentities,
    outcome: findings.length === 0 ? "PASS" : "INCOMPLETE",
  }
}

/** Prepares the legacy source snapshot required before a protected-main cutover is recorded. */
export function createProtectedCutoverBootstrap(
  input: SourceInspectionInput
): ProtectedCutoverBootstrap {
  const migrationRoot = input.migrationRoot ?? DEFAULT_MIGRATION_ROOT
  const inspection = inspectCanonicalMigrationSource({
    migrationRoot,
    repositoryRoot: input.repositoryRoot,
  })

  if (inspection.outcome !== "PASS") {
    throw new Error(`Cannot bootstrap protected cutover: ${inspection.findings[0]?.ruleId}`)
  }

  return {
    migrationIdentities: inspection.migrationIdentities,
    migrationRoot,
    status: "PENDING_PROTECTED_MAIN",
  }
}
