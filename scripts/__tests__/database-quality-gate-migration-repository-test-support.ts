import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { createFixtureRepository, fixtureJson, sha256 } from "./database-quality-gate-test-support"

export type RepositoryFinding = {
  classification: "BLOCKING" | "INCOMPLETE"
  ruleId: string
}

export type RepositoryInspection = {
  findings: RepositoryFinding[]
  outcome: "FAILED" | "INCOMPLETE" | "PASS"
}

export type MigrationRepositoryModule = {
  inspectMigrationRepository: (input: {
    bootstrapBaseRef?: string
    previousAppliedLock?: unknown
    protectedRef?: string
    repositoryRoot: string
  }) => RepositoryInspection
}

export const LEGACY_PATH = "supabase/migrations/20241220_add_completion_tracking.sql"
export const LEGACY_SQL = "CREATE TABLE public.completion_tracking (id bigint PRIMARY KEY);\n"
export const APPLIED_PATH = "supabase/migrations/20270102000000_already_applied.sql"
export const PENDING_PATH = "supabase/migrations/20270101000000_add_pending_contract.sql"

export function appliedLock(
  legacyEntries: Array<{ path: string; sha256: string }> = [],
  appliedEntries: Array<{ path: string; sha256: string }> = []
) {
  return {
    applied: appliedEntries,
    cutover: {
      commit: "a".repeat(40),
      legacyInventorySha256: sha256(JSON.stringify(legacyEntries)),
      migrationRoot: "supabase/migrations",
    },
    legacy: legacyEntries,
    schemaVersion: 1,
  }
}

export function repositoryWithLock(
  files: Record<string, string>,
  lock = appliedLock([
    {
      path: LEGACY_PATH,
      sha256: sha256(LEGACY_SQL),
    },
  ]),
  preserveCutover = false
) {
  const repository = createFixtureRepository({
    ".fixture": "database quality gate test fixture\n",
    ...files,
  })
  execFileSync("git", ["init", "--quiet"], { cwd: repository.root })
  execFileSync("git", ["config", "user.email", "gate@example.test"], { cwd: repository.root })
  execFileSync("git", ["config", "user.name", "Database Quality Gate"], {
    cwd: repository.root,
  })
  execFileSync("git", ["add", "--all"], { cwd: repository.root })
  execFileSync("git", ["commit", "--quiet", "-m", "cutover source"], { cwd: repository.root })
  const cutoverCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repository.root,
    encoding: "utf8",
  }).trim()

  if (!preserveCutover) {
    lock.cutover.commit = cutoverCommit
  }
  const lockPath = repository.path("supabase", "applied-migrations.lock.json")
  mkdirSync(path.dirname(lockPath), { recursive: true })
  writeFileSync(lockPath, fixtureJson(lock))
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", cutoverCommit], {
    cwd: repository.root,
  })

  return repository
}
