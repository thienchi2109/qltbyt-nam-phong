import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  cleanupFixtureRepositories,
  createFixtureRepository,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"
import {
  APPLIED_PATH,
  LEGACY_PATH,
  LEGACY_SQL,
  PENDING_PATH,
  appliedLock,
  MigrationRepositoryModule,
  repositoryWithLock,
} from "./database-quality-gate-migration-repository-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate migration repository edge cases", () => {
  it("returns INCOMPLETE instead of throwing for a malformed applied lock", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = createFixtureRepository({
      "supabase/applied-migrations.lock.json": fixtureJson({
        applied: [],
        cutover: {
          migrationRoot: "supabase/migrations",
        },
        legacy: [{}],
        schemaVersion: 1,
      }),
    })

    expect(() =>
      source.inspectMigrationRepository({ repositoryRoot: repository.root })
    ).not.toThrow()
    expect(source.inspectMigrationRepository({ repositoryRoot: repository.root })).toEqual({
      findings: [
        {
          classification: "INCOMPLETE",
          ruleId: "migration.applied-lock",
        },
      ],
      outcome: "INCOMPLETE",
    })
  })

  it("does not trust an unresolved bootstrap cutover SHA", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL }, appliedLock(), true)

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "INCOMPLETE",
        ruleId: "migration.cutover-commit",
      })
    )
  })

  it("rejects a cutover that predates the exact protected bootstrap base", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL })
    writeFileSync(repository.path(".fixture"), "protected main advanced after the stale cutover\n")
    execFileSync("git", ["add", "--all"], { cwd: repository.root })
    execFileSync("git", ["commit", "--quiet", "-m", "advance protected main"], {
      cwd: repository.root,
    })

    const result = source.inspectMigrationRepository({
      bootstrapBaseRef: "HEAD",
      protectedRef: "HEAD",
      repositoryRoot: repository.root,
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.cutover-bootstrap-base" })
    )
  })

  it("blocks a legacy hash snapshot that does not match the resolved cutover commit", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = createFixtureRepository({
      [LEGACY_PATH]: LEGACY_SQL,
    })
    execFileSync("git", ["init", "--quiet"], { cwd: repository.root })
    execFileSync("git", ["config", "user.email", "gate@example.test"], { cwd: repository.root })
    execFileSync("git", ["config", "user.name", "Database Quality Gate"], {
      cwd: repository.root,
    })
    execFileSync("git", ["add", "--all"], { cwd: repository.root })
    execFileSync("git", ["commit", "--quiet", "-m", "protected cutover"], {
      cwd: repository.root,
    })
    const cutoverCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repository.root,
      encoding: "utf8",
    }).trim()
    execFileSync("git", ["update-ref", "refs/remotes/origin/main", cutoverCommit], {
      cwd: repository.root,
    })
    const editedLegacySql =
      "CREATE TABLE public.completion_tracking (id bigint PRIMARY KEY, note text);\n"
    writeFileSync(repository.path(LEGACY_PATH), editedLegacySql)
    const lock = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(editedLegacySql),
      },
    ])
    lock.cutover.commit = cutoverCommit
    writeFileSync(repository.path("supabase", "applied-migrations.lock.json"), fixtureJson(lock))

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.legacy-cutover-content" })
    )
  })

  it("keeps a post-cutover migration absent from the lock editable before live apply", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock({}, appliedLock())
    mkdirSync(path.dirname(repository.path(PENDING_PATH)), { recursive: true })
    writeFileSync(
      repository.path(PENDING_PATH),
      "CREATE TABLE public.pending_contract (id bigint PRIMARY KEY);\n"
    )

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("PASS")
    expect(result.findings).toEqual([])
  })

  it("blocks a future applied migration whose canonical content changes", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock(
      {
        [APPLIED_PATH]: "SELECT 2;",
      },
      appliedLock([], [{ path: APPLIED_PATH, sha256: sha256("SELECT 1;") }])
    )

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.applied-content",
      })
    )
  })

  it("marks an appended applied migration incomplete until live read-back evidence exists", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const currentLock = appliedLock([], [{ path: APPLIED_PATH, sha256: sha256("SELECT 1;") }])
    const repository = repositoryWithLock(
      {
        [APPLIED_PATH]: "SELECT 1;",
      },
      currentLock
    )
    const previousLock = appliedLock()
    previousLock.cutover = { ...currentLock.cutover }

    const result = source.inspectMigrationRepository({
      previousAppliedLock: previousLock,
      repositoryRoot: repository.root,
    })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "INCOMPLETE",
        ruleId: "migration.applied-readback",
      })
    )
  })

  it("returns INCOMPLETE instead of guessing an ambiguous root migration order", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock(
      {
        "supabase/migrations/20270101000000_first.sql": "SELECT 1;\n",
        "supabase/migrations/20270101000000_second.sql": "SELECT 2;\n",
      },
      appliedLock()
    )

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "INCOMPLETE",
        ruleId: "migration.source-order",
      })
    )
  })
})
