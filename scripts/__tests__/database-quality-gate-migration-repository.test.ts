import { afterEach, describe, expect, it } from "vitest"

import {
  cleanupFixtureRepositories,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"
import {
  LEGACY_PATH,
  LEGACY_SQL,
  MigrationRepositoryModule,
  appliedLock,
  repositoryWithLock,
} from "./database-quality-gate-migration-repository-test-support"

afterEach(cleanupFixtureRepositories)

describe("database quality gate migration repository inspection", () => {
  it("blocks a legacy migration whose canonical content changed", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock({
      [LEGACY_PATH]:
        "CREATE TABLE public.completion_tracking (id bigint PRIMARY KEY, note text);\n",
    })

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.legacy-content",
      })
    )
  })

  it("blocks a renamed or deleted legacy migration path", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const renamedRepository = repositoryWithLock({
      "supabase/migrations/20241220_completion_tracking_renamed.sql": LEGACY_SQL,
    })
    const deletedRepository = repositoryWithLock({})

    const renamedResult = source.inspectMigrationRepository({
      repositoryRoot: renamedRepository.root,
    })
    const deletedResult = source.inspectMigrationRepository({
      repositoryRoot: deletedRepository.root,
    })

    expect(renamedResult.outcome).toBe("FAILED")
    expect(deletedResult.outcome).toBe("FAILED")
    expect(renamedResult.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.legacy-path",
      })
    )
    expect(deletedResult.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.legacy-path",
      })
    )
  })

  it("blocks a lock history mutation even when the migration file is unchanged", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const previousLock = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(LEGACY_SQL.slice(0, -1)),
      },
    ])
    const currentLock = appliedLock([])
    const repository = repositoryWithLock(
      {
        [LEGACY_PATH]: LEGACY_SQL,
      },
      currentLock
    )

    const result = source.inspectMigrationRepository({
      previousAppliedLock: previousLock,
      repositoryRoot: repository.root,
    })

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.lock-history",
      })
    )
  })

  it("blocks a legacy inventory digest that no longer matches the locked entries", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const lock = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(LEGACY_SQL.slice(0, -1)),
      },
    ])
    lock.cutover.legacyInventorySha256 = sha256("stale legacy inventory")
    const repository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL }, lock)

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("FAILED")
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        classification: "BLOCKING",
        ruleId: "migration.legacy-inventory-digest",
      })
    )
  })

  it("blocks a changed cutover commit and rejects a noncanonical migration root", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const previousLock = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(LEGACY_SQL),
      },
    ])
    const changedCommit = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(LEGACY_SQL),
      },
    ])
    const changedRoot = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(LEGACY_SQL),
      },
    ])
    changedCommit.cutover.commit = "b".repeat(40)
    changedRoot.cutover.migrationRoot = "supabase/renamed-migrations"
    const commitRepository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL }, changedCommit)
    const rootRepository = repositoryWithLock({ [LEGACY_PATH]: LEGACY_SQL }, changedRoot)

    const commitResult = source.inspectMigrationRepository({
      previousAppliedLock: previousLock,
      repositoryRoot: commitRepository.root,
    })
    const rootResult = source.inspectMigrationRepository({
      previousAppliedLock: previousLock,
      repositoryRoot: rootRepository.root,
    })

    expect(commitResult.outcome).toBe("FAILED")
    expect(rootResult.outcome).toBe("INCOMPLETE")
    expect(commitResult.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.lock-history" })
    )
    expect(rootResult.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.applied-lock" })
    )
  })

  it("blocks moving or reordering protected history between lock sections", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const secondLegacyPath = "supabase/migrations/20241221_second_protected_legacy.sql"
    const secondLegacySql = "CREATE TABLE public.second_protected_legacy (id bigint PRIMARY KEY);\n"
    const previousLock = appliedLock([
      {
        path: LEGACY_PATH,
        sha256: sha256(LEGACY_SQL),
      },
      {
        path: secondLegacyPath,
        sha256: sha256(secondLegacySql),
      },
    ])
    const movedRepository = repositoryWithLock(
      {
        [LEGACY_PATH]: LEGACY_SQL,
        [secondLegacyPath]: secondLegacySql,
      },
      appliedLock(
        [
          {
            path: secondLegacyPath,
            sha256: sha256(secondLegacySql),
          },
        ],
        [
          {
            path: LEGACY_PATH,
            sha256: sha256(LEGACY_SQL),
          },
        ]
      )
    )
    const reorderedRepository = repositoryWithLock(
      {
        [LEGACY_PATH]: LEGACY_SQL,
        [secondLegacyPath]: secondLegacySql,
      },
      appliedLock([
        {
          path: secondLegacyPath,
          sha256: sha256(secondLegacySql),
        },
        {
          path: LEGACY_PATH,
          sha256: sha256(LEGACY_SQL),
        },
      ])
    )

    const moved = source.inspectMigrationRepository({
      previousAppliedLock: previousLock,
      repositoryRoot: movedRepository.root,
    })
    const reordered = source.inspectMigrationRepository({
      previousAppliedLock: previousLock,
      repositoryRoot: reorderedRepository.root,
    })

    expect(moved.outcome).toBe("FAILED")
    expect(reordered.outcome).toBe("FAILED")
    expect(moved.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.lock-history" })
    )
    expect(reordered.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.lock-history" })
    )
  })
})
