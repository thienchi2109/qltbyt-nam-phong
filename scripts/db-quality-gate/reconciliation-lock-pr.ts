import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"

import { preservesAppliedLockHistory } from "./applied-lock-history"
import { readFileAtCommit, resolveGitCommit } from "./git-evidence"
import { loadReadBackRecord } from "./read-back"
import { parseAppliedMigrationLock } from "./registries"
import { stableJsonStringify } from "./serialization"
import type { OracleEvidenceStore } from "./oracle-evidence-store"
import type { ProtectedMainVerifier } from "./protected-main"

const APPLIED_LOCK_PATH = "supabase/applied-migrations.lock.json"
const MAX_GIT_OUTPUT_BYTES = 4 * 1024 * 1024

type RunGit = (repositoryRoot: string, args: string[]) => string

export type ReconciliationLockInput = {
  readBackDigest: string
  readBackRunId: string
  repositoryRoot: string
  subjectCommit: string
}

export type ReconciliationLockDependencies = {
  evidenceStore: OracleEvidenceStore
  refreshOriginMain: (repositoryRoot: string) => string | undefined
  runGit?: RunGit
  verifyProtectedMain: ProtectedMainVerifier
}

export type ReconciliationLockResult =
  | {
      branchName: string
      commands: string[]
      commit: string
      status: "prepared"
    }
  | {
      reason: string
      status: "incomplete"
    }

function defaultRunGit(repositoryRoot: string, args: string[]): string {
  return execFileSync("git", ["-C", repositoryRoot, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_GIT_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()
}

function incomplete(reason: string): ReconciliationLockResult {
  return { reason, status: "incomplete" }
}

function branchExists(runGit: RunGit, repositoryRoot: string, branchName: string): boolean {
  try {
    return runGit(repositoryRoot, ["branch", "--list", branchName]) !== ""
  } catch {
    return false
  }
}

function cleanupFailedPreparation(
  runGit: RunGit,
  repositoryRoot: string,
  subjectCommit: string,
  branchName: string
): void {
  try {
    runGit(repositoryRoot, ["reset", "--hard", subjectCommit])
  } catch {
    // Best-effort cleanup continues so the original branch can still be restored.
  }
  try {
    runGit(repositoryRoot, ["switch", "main"])
  } catch {
    return
  }
  if (branchExists(runGit, repositoryRoot, branchName)) {
    try {
      runGit(repositoryRoot, ["branch", "-D", branchName])
    } catch {
      // The incomplete result remains fail-closed if cleanup cannot remove the branch.
    }
  }
}

/** Prepares one local lock-only reconciliation commit and never pushes it. */
export function prepareReconciliationLock(
  input: ReconciliationLockInput,
  dependencies: ReconciliationLockDependencies
): ReconciliationLockResult {
  const runGit = dependencies.runGit ?? defaultRunGit
  const subjectCommit = resolveGitCommit(input.repositoryRoot, input.subjectCommit)
  if (subjectCommit === undefined || subjectCommit !== input.subjectCommit) {
    return incomplete("Subject commit is unavailable or is not an exact Git SHA")
  }

  try {
    if (runGit(input.repositoryRoot, ["status", "--porcelain"]) !== "") {
      return incomplete("Lock preparation requires a clean worktree")
    }
    if (
      runGit(input.repositoryRoot, ["branch", "--show-current"]) !== "main" ||
      runGit(input.repositoryRoot, ["rev-parse", "HEAD"]) !== subjectCommit
    ) {
      return incomplete("Lock preparation requires exact landed main at the subject commit")
    }
  } catch {
    return incomplete("Repository state could not be verified")
  }

  const originMain = dependencies.refreshOriginMain(input.repositoryRoot)
  if (originMain !== subjectCommit) {
    return incomplete("Refreshed origin/main does not match the subject commit")
  }
  const protectedMain = dependencies.verifyProtectedMain()
  if (protectedMain.status !== "active" || protectedMain.subjectCommit !== subjectCommit) {
    return incomplete(
      protectedMain.status === "active"
        ? "Protected main is not bound to the subject commit"
        : protectedMain.reason
    )
  }

  const readBack = loadReadBackRecord({
    evidenceStore: dependencies.evidenceStore,
    runId: input.readBackRunId,
  })
  if (readBack.status === "error") {
    return incomplete(readBack.error)
  }
  const record = readBack.value
  const expectedEvidenceId = `oracle:${input.readBackRunId}/read-back.json`
  if (record.digest !== input.readBackDigest || record.subjectCommit !== subjectCommit) {
    return incomplete("Read-back evidence is not bound to the subject commit and digest")
  }

  const previousContent = readFileAtCommit(input.repositoryRoot, subjectCommit, APPLIED_LOCK_PATH)
  if (previousContent === undefined) {
    return incomplete("Applied migration lock is unavailable at the subject commit")
  }

  let previousValue: unknown
  try {
    previousValue = JSON.parse(previousContent) as unknown
  } catch {
    return incomplete("Applied migration lock is not valid JSON")
  }
  const previousLock = parseAppliedMigrationLock(previousValue)
  if (previousLock === undefined) {
    return incomplete("Applied migration lock is malformed")
  }
  if (
    previousLock.applied.some(
      (entry) =>
        entry.path === record.migrationPath ||
        entry.liveVersion === record.liveVersion ||
        entry.readBackEvidenceId === expectedEvidenceId
    )
  ) {
    return incomplete("Read-back migration is already represented in the applied lock")
  }

  const nextLock = parseAppliedMigrationLock({
    ...previousLock,
    applied: [
      ...previousLock.applied,
      {
        liveName: record.liveName,
        liveVersion: record.liveVersion,
        path: record.migrationPath,
        readBackDigest: record.digest,
        readBackEvidenceId: expectedEvidenceId,
        sha256: record.sha256,
      },
    ],
  })
  if (nextLock === undefined || !preservesAppliedLockHistory(previousLock, nextLock)) {
    return incomplete("Prepared applied migration lock is not a valid append-only update")
  }

  const branchName = `db-gate/reconcile-lock-${record.liveVersion}`
  if (branchExists(runGit, input.repositoryRoot, branchName)) {
    return incomplete("Target reconciliation branch already exists")
  }

  let branchCreated = false
  try {
    runGit(input.repositoryRoot, ["switch", "-c", branchName])
    branchCreated = true
    const lockPath = path.join(input.repositoryRoot, APPLIED_LOCK_PATH)
    writeFileSync(lockPath, `${stableJsonStringify(nextLock)}\n`)
    runGit(input.repositoryRoot, ["add", "--", APPLIED_LOCK_PATH])
    if (runGit(input.repositoryRoot, ["diff", "--cached", "--name-only"]) !== APPLIED_LOCK_PATH) {
      throw new Error("Prepared commit is not lock-only")
    }
    runGit(input.repositoryRoot, [
      "commit",
      "-m",
      `chore(db-gate): reconcile applied migration ${record.liveVersion}`,
    ])
    const commit = runGit(input.repositoryRoot, ["rev-parse", "HEAD"])
    if (
      runGit(input.repositoryRoot, ["show", "--format=", "--name-only", "HEAD"]) !==
      APPLIED_LOCK_PATH
    ) {
      throw new Error("Created commit is not lock-only")
    }

    return {
      branchName,
      commands: [
        `git push -u origin ${branchName}`,
        `gh pr create --base main --head ${branchName}`,
      ],
      commit,
      status: "prepared",
    }
  } catch (error) {
    if (branchCreated) {
      cleanupFailedPreparation(runGit, input.repositoryRoot, subjectCommit, branchName)
    }
    return incomplete(error instanceof Error ? error.message : "Lock preparation failed")
  }
}
