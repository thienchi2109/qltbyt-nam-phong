import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { parseIdentityBaseline } from "./baseline"
import { listFilesAtCommit, readFileAtCommit, resolveGitCommit } from "./git-evidence"
import { migrationContentSha256 } from "./migration-source"
import {
  parseAppliedMigrationLock,
  parseInvariantRegistry,
  parseSqlTestRegistry,
  parseWaiverRegistry,
} from "./registries"
import { stableJsonSha256 } from "./serialization"
import type { IdentityBaseline } from "./baseline"
import type {
  AppliedMigrationLock,
  InvariantRegistry,
  SqlTestRegistry,
  WaiverRegistry,
} from "./registries"

export type JsonAtRef =
  | { status: "invalid" }
  | { status: "missing" }
  | { status: "unavailable" }
  | { status: "value"; value: unknown }

/** Returns the canonical hash of a worktree artifact or an unavailable marker. */
export function artifactHash(repositoryRoot: string, relativePath: string): string {
  const artifactPath = path.join(repositoryRoot, relativePath)

  return existsSync(artifactPath)
    ? migrationContentSha256(readFileSync(artifactPath, "utf8"))
    : "unavailable"
}

/** Reads a worktree JSON artifact without treating malformed content as trustworthy evidence. */
export function readJsonArtifact(
  repositoryRoot: string,
  relativePath: string
): unknown | undefined {
  try {
    return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8")) as unknown
  } catch {
    return undefined
  }
}

/** Parses the identity baseline from the worktree without treating invalid data as evidence. */
export function readIdentityBaselineArtifact(
  repositoryRoot: string,
  relativePath: string
): IdentityBaseline | undefined {
  try {
    return parseIdentityBaseline(
      JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8")) as unknown
    )
  } catch {
    return undefined
  }
}

/** Parses the waiver registry from the worktree without treating invalid data as approval evidence. */
export function readWaiverRegistryArtifact(
  repositoryRoot: string,
  relativePath: string
): WaiverRegistry | undefined {
  try {
    return parseWaiverRegistry(
      JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8")) as unknown
    )
  } catch {
    return undefined
  }
}

/** Parses the applied migration lock from the worktree without trusting malformed history. */
export function readAppliedMigrationLockArtifact(
  repositoryRoot: string,
  relativePath: string
): AppliedMigrationLock | undefined {
  try {
    return parseAppliedMigrationLock(
      JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8")) as unknown
    )
  } catch {
    return undefined
  }
}

/** Parses the committed table-security registry without inferring missing table intent. */
export function readInvariantRegistryArtifact(
  repositoryRoot: string,
  relativePath: string
): InvariantRegistry | undefined {
  const artifact = readJsonArtifact(repositoryRoot, relativePath)
  return artifact === undefined ? undefined : parseInvariantRegistry(artifact)
}

/** Parses the committed SQL-test registry without allowing malformed metadata into selection. */
export function readSqlTestRegistryArtifact(
  repositoryRoot: string,
  relativePath: string
): SqlTestRegistry | undefined {
  const artifact = readJsonArtifact(repositoryRoot, relativePath)
  return artifact === undefined ? undefined : parseSqlTestRegistry(artifact)
}

/** Reads one JSON artifact from a resolved base ref without consulting the worktree. */
export function readJsonArtifactAtRef(
  repositoryRoot: string,
  baseRef: string,
  relativePath: string
): JsonAtRef {
  const baseCommit = resolveGitCommit(repositoryRoot, baseRef)
  if (baseCommit === undefined) {
    return { status: "unavailable" }
  }

  const content = readFileAtCommit(repositoryRoot, baseCommit, relativePath)
  if (content === undefined) {
    return { status: "missing" }
  }

  try {
    return { status: "value", value: JSON.parse(content) as unknown }
  } catch {
    return { status: "invalid" }
  }
}

/** Requires the worktree artifact to equal immutable content committed at the provided SHA. */
export function artifactMatchesCommit(
  repositoryRoot: string,
  commit: string,
  relativePath: string
): boolean {
  const contentAtCommit = readFileAtCommit(repositoryRoot, commit, relativePath)

  return (
    contentAtCommit !== undefined &&
    artifactHash(repositoryRoot, relativePath) === migrationContentSha256(contentAtCommit)
  )
}

function isHarnessSourcePath(relativePath: string): boolean {
  return (
    relativePath.startsWith("scripts/db-quality-gate/") &&
    (relativePath.endsWith(".cjs") || relativePath.endsWith(".ts"))
  )
}

const STATIC_HARNESS_DEPENDENCIES = ["scripts/changed-files.js"] as const

function worktreeHarnessPaths(
  repositoryRoot: string,
  relativeDirectory: string
): string[] | undefined {
  try {
    return readdirSync(path.join(repositoryRoot, relativeDirectory), {
      withFileTypes: true,
    }).flatMap((entry) => {
      const relativePath = path.posix.join(relativeDirectory, entry.name)
      if (entry.isDirectory()) {
        return worktreeHarnessPaths(repositoryRoot, relativePath) ?? []
      }

      return isHarnessSourcePath(relativePath) ? [relativePath] : []
    })
  } catch {
    return undefined
  }
}

/** Binds the local static-gate harness source to the immutable subject commit. */
export function gateHarnessEvidence(
  repositoryRoot: string,
  commit: string
): { hash: string; matchesCommit: boolean } {
  const relativeDirectory = "scripts/db-quality-gate"
  const committedSourcePaths = listFilesAtCommit(repositoryRoot, commit, relativeDirectory)?.filter(
    isHarnessSourcePath
  )
  const worktreeSourcePaths = worktreeHarnessPaths(repositoryRoot, relativeDirectory)
  const committedPaths =
    committedSourcePaths === undefined
      ? undefined
      : [...committedSourcePaths, ...STATIC_HARNESS_DEPENDENCIES].sort()
  const worktreePaths =
    worktreeSourcePaths === undefined
      ? undefined
      : [...worktreeSourcePaths, ...STATIC_HARNESS_DEPENDENCIES].sort()
  const paths = [...new Set([...(committedPaths ?? []), ...(worktreePaths ?? [])])].sort()
  const hash = stableJsonSha256(
    paths.map((relativePath) => [relativePath, artifactHash(repositoryRoot, relativePath)])
  )

  return {
    hash,
    matchesCommit:
      committedPaths !== undefined &&
      worktreePaths !== undefined &&
      committedPaths.length === worktreePaths.length &&
      committedPaths.every(
        (relativePath, index) =>
          relativePath === worktreePaths[index] &&
          artifactMatchesCommit(repositoryRoot, commit, relativePath)
      ),
  }
}
