import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  cleanupFixtureRepositories,
  createFixtureRepository,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"

type RepositoryInspection = {
  findings: Array<{ classification: "BLOCKING" | "INCOMPLETE"; ruleId: string }>
  outcome: "FAILED" | "INCOMPLETE" | "PASS"
}

type MigrationRepositoryModule = {
  inspectMigrationRepository: (input: { repositoryRoot: string }) => RepositoryInspection
}

const LEGACY_PATH = "supabase/migrations/20241220_add_completion_tracking.sql"
const LEGACY_SQL = "CREATE TABLE public.completion_tracking (id bigint PRIMARY KEY);\n"

function repositoryWithLock(files: Record<string, string>) {
  const repository = createFixtureRepository({
    ".fixture": "database quality gate cutover fixture\n",
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
  const lockPath = repository.path("supabase", "applied-migrations.lock.json")
  mkdirSync(path.dirname(lockPath), { recursive: true })
  const legacy = [{ path: LEGACY_PATH, sha256: sha256(LEGACY_SQL) }]
  writeFileSync(
    lockPath,
    fixtureJson({
      applied: [],
      cutover: {
        commit: cutoverCommit,
        legacyInventorySha256: sha256(JSON.stringify(legacy)),
        migrationRoot: "supabase/migrations",
      },
      legacy,
      schemaVersion: 1,
    })
  )
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", cutoverCommit], {
    cwd: repository.root,
  })

  return repository
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate protected cutover", () => {
  it("blocks a lock that omits a root migration from the protected cutover snapshot", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const omittedPath = "supabase/migrations/20241221_omitted_from_lock.sql"
    const repository = repositoryWithLock({
      [LEGACY_PATH]: LEGACY_SQL,
      [omittedPath]: "CREATE TABLE public.omitted_from_lock (id bigint PRIMARY KEY);\n",
    })

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.legacy-cutover-membership" })
    )
  })

  it("requires the cutover to be reachable from the protected main ref", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL })
    writeFileSync(repository.path("feature-only.txt"), "feature-only cutover\n")
    execFileSync("git", ["add", "--all"], { cwd: repository.root })
    execFileSync("git", ["commit", "--quiet", "-m", "feature-only commit"], {
      cwd: repository.root,
    })
    const cutoverCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repository.root,
      encoding: "utf8",
    }).trim()
    const lockPath = repository.path("supabase", "applied-migrations.lock.json")
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown>
    lock.cutover = {
      ...(lock.cutover as Record<string, unknown>),
      commit: cutoverCommit,
    }
    writeFileSync(lockPath, fixtureJson(lock))

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.cutover-protected-ref" })
    )
  })

  it("rejects a lock that points the protected migration root outside the canonical source", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL })
    const lockPath = repository.path("supabase", "applied-migrations.lock.json")
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as Record<string, unknown>
    lock.cutover = {
      commit: (lock.cutover as { commit: string }).commit,
      legacyInventorySha256: (lock.cutover as { legacyInventorySha256: string })
        .legacyInventorySha256,
      migrationRoot: "supabase/other-migrations",
    }
    writeFileSync(lockPath, fixtureJson(lock))

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.applied-lock" })
    )
  })
})
