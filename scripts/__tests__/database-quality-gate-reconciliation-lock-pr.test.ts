import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { migrationContentSha256 } from "../db-quality-gate/migration-source"
import { stableJsonStringify } from "../db-quality-gate/serialization"
import { FakeEvidenceStore, git } from "./database-quality-gate-pre-live-test-support"
import {
  CAPTURED_AT,
  RECEIVED_AT,
  observation,
} from "./database-quality-gate-read-back-test-support"
import type { ReadBackModule } from "./database-quality-gate-read-back-test-support"
import { commitWorkingTree } from "./database-quality-gate-static-test-support"
import {
  cleanupFixtureRepositories,
  createFixtureRepository,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"

const MIGRATION_PATH = "supabase/migrations/20260823070000_candidate.sql"
const MIGRATION_SQL = "SELECT 1;\n"
const READ_BACK_RUN_ID = "phase-6-lock-read-back"

type PreparationResult =
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

type LockPreparationModule = {
  prepareReconciliationLock: (
    input: {
      readBackDigest: string
      readBackRunId: string
      repositoryRoot: string
      subjectCommit: string
    },
    dependencies: {
      evidenceStore: FakeEvidenceStore
      refreshOriginMain: (repositoryRoot: string) => string | undefined
      runGit?: (repositoryRoot: string, args: string[]) => string
      verifyProtectedMain: () =>
        | { status: "active"; subjectCommit: string }
        | { reason: string; status: "inactive" | "unavailable" }
    }
  ) => PreparationResult
}

function createLockRepository() {
  const repository = createFixtureRepository({
    ".fixture": "database quality gate lock reconciliation fixture\n",
  })
  git(repository.root, "init", "--quiet")
  git(repository.root, "config", "user.email", "db-quality-gate@example.test")
  git(repository.root, "config", "user.name", "Database Quality Gate")
  const cutoverCommit = commitWorkingTree(repository.root, "cutover source")

  mkdirSync(repository.path("supabase", "migrations"), { recursive: true })
  writeFileSync(repository.path(MIGRATION_PATH), MIGRATION_SQL)
  const lockPath = repository.path("supabase", "applied-migrations.lock.json")
  mkdirSync(path.dirname(lockPath), { recursive: true })
  writeFileSync(
    lockPath,
    fixtureJson({
      applied: [],
      cutover: {
        commit: cutoverCommit,
        legacyInventorySha256: sha256("[]"),
        migrationRoot: "supabase/migrations",
      },
      legacy: [],
      schemaVersion: 1,
    })
  )
  const subjectCommit = commitWorkingTree(repository.root, "land migration and applied lock")
  git(repository.root, "branch", "-M", "main")
  git(repository.root, "update-ref", "refs/remotes/origin/main", subjectCommit)

  return { lockPath, repository, subjectCommit }
}

async function verifiedReadBack(repositoryRoot: string, subjectCommit: string) {
  const readBack = await loadDatabaseQualityGateModule<ReadBackModule>("read-back")
  const store = new FakeEvidenceStore()
  const result = readBack.ingestReadBackObservation(
    {
      observation: observation({
        capturedAt: CAPTURED_AT,
        migrationPath: MIGRATION_PATH,
        statements: [MIGRATION_SQL],
      }),
      repositoryRoot,
      runId: READ_BACK_RUN_ID,
      subjectCommit,
    },
    {
      evidenceStore: store,
      now: () => new Date(RECEIVED_AT),
    }
  )
  if (result.status !== "verified" || result.digest === undefined) {
    throw new Error("Expected verified read-back fixture")
  }

  return { digest: result.digest, store }
}

function dependencies(
  store: FakeEvidenceStore,
  subjectCommit: string,
  overrides: Partial<Parameters<LockPreparationModule["prepareReconciliationLock"]>[1]> = {}
) {
  return {
    evidenceStore: store,
    refreshOriginMain: () => subjectCommit,
    verifyProtectedMain: () => ({ status: "active" as const, subjectCommit }),
    ...overrides,
  }
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate lock-only reconciliation preparation", () => {
  it("creates one validated lock-only commit and prints commands without pushing", async () => {
    const workflow =
      await loadDatabaseQualityGateModule<LockPreparationModule>("reconciliation-lock-pr")
    const { lockPath, repository, subjectCommit } = createLockRepository()
    const { digest, store } = await verifiedReadBack(repository.root, subjectCommit)

    const result = workflow.prepareReconciliationLock(
      {
        readBackDigest: digest,
        readBackRunId: READ_BACK_RUN_ID,
        repositoryRoot: repository.root,
        subjectCommit,
      },
      dependencies(store, subjectCommit)
    )

    expect(result).toMatchObject({
      branchName: "db-gate/reconcile-lock-20260823070000",
      status: "prepared",
    })
    expect(result.commands).toEqual([
      "git push -u origin db-gate/reconcile-lock-20260823070000",
      "gh pr create --base main --head db-gate/reconcile-lock-20260823070000",
    ])
    expect(git(repository.root, "branch", "--show-current")).toBe(
      "db-gate/reconcile-lock-20260823070000"
    )
    expect(git(repository.root, "status", "--porcelain")).toBe("")
    expect(git(repository.root, "rev-parse", "origin/main")).toBe(subjectCommit)
    expect(git(repository.root, "show", "--format=", "--name-only", "HEAD")).toBe(
      "supabase/applied-migrations.lock.json"
    )
    expect(
      JSON.parse(git(repository.root, "show", `HEAD:${path.relative(repository.root, lockPath)}`))
    ).toMatchObject({
      applied: [
        {
          liveName: "candidate",
          liveVersion: "20260823070000",
          path: MIGRATION_PATH,
          readBackDigest: digest,
          readBackEvidenceId: `oracle:${READ_BACK_RUN_ID}/read-back.json`,
          sha256: migrationContentSha256(MIGRATION_SQL),
        },
      ],
    })
  })

  it.each([
    ["dirty worktree", "dirty"],
    ["wrong landed HEAD", "wrong-head"],
    ["inactive protected main", "inactive"],
    ["pre-existing target branch", "existing-branch"],
    ["branch creation failure", "branch-failure"],
    ["commit failure", "commit-failure"],
  ])("returns INCOMPLETE with cleanup for %s", async (_name, failure) => {
    const workflow =
      await loadDatabaseQualityGateModule<LockPreparationModule>("reconciliation-lock-pr")
    const { repository, subjectCommit } = createLockRepository()
    const { digest, store } = await verifiedReadBack(repository.root, subjectCommit)
    const originalLock = git(
      repository.root,
      "show",
      `${subjectCommit}:supabase/applied-migrations.lock.json`
    )
    const targetBranch = "db-gate/reconcile-lock-20260823070000"

    if (failure === "dirty") {
      writeFileSync(repository.path("dirty.txt"), "dirty\n")
    }
    if (failure === "existing-branch") {
      git(repository.root, "branch", targetBranch)
    }

    const runGit =
      failure === "branch-failure" || failure === "commit-failure"
        ? (repositoryRoot: string, args: string[]) => {
            if (
              (failure === "branch-failure" && args.join(" ") === `switch -c ${targetBranch}`) ||
              (failure === "commit-failure" && args[0] === "commit")
            ) {
              throw new Error(`injected ${failure}`)
            }
            return git(repositoryRoot, ...args)
          }
        : undefined

    const result = workflow.prepareReconciliationLock(
      {
        readBackDigest: digest,
        readBackRunId: READ_BACK_RUN_ID,
        repositoryRoot: repository.root,
        subjectCommit: failure === "wrong-head" ? "a".repeat(40) : subjectCommit,
      },
      dependencies(store, subjectCommit, {
        ...(runGit === undefined ? {} : { runGit }),
        ...(failure === "inactive"
          ? {
              verifyProtectedMain: () => ({
                reason: "ruleset inactive",
                status: "inactive" as const,
              }),
            }
          : {}),
      })
    )

    expect(result).toMatchObject({ status: "incomplete" })
    expect(git(repository.root, "branch", "--show-current")).toBe("main")
    expect(git(repository.root, "show", "HEAD:supabase/applied-migrations.lock.json")).toBe(
      originalLock
    )
    if (failure !== "dirty" && failure !== "existing-branch") {
      expect(git(repository.root, "status", "--porcelain")).toBe("")
    }
    expect(git(repository.root, "branch", "--list", targetBranch)).toBe(
      failure === "existing-branch" ? targetBranch : ""
    )
  })
})
