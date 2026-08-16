import { afterEach, describe, expect, it } from "vitest"

import {
  cleanupFixtureRepositories,
  createFixtureRepository,
  fixtureJson,
  loadDatabaseQualityGateModule,
  sha256,
} from "./database-quality-gate-test-support"

type RepositoryFinding = {
  classification: "BLOCKING" | "INCOMPLETE"
  ruleId: string
}

type RepositoryInspection = {
  findings: RepositoryFinding[]
  outcome: "FAILED" | "INCOMPLETE" | "PASS"
}

type MigrationRepositoryModule = {
  inspectMigrationRepository: (input: {
    previousAppliedLock?: unknown
    repositoryRoot: string
  }) => RepositoryInspection
}

const LEGACY_PATH = "supabase/migrations/20241220_add_completion_tracking.sql"
const LEGACY_SQL = "CREATE TABLE public.completion_tracking (id bigint PRIMARY KEY);\n"
const PENDING_PATH = "supabase/migrations/20270101000000_add_pending_contract.sql"

function appliedLock(legacyEntries: Array<{ path: string; sha256: string }> = []) {
  return {
    applied: [],
    cutover: {
      commit: "a".repeat(40),
      migrationRoot: "supabase/migrations",
    },
    legacy: legacyEntries,
    schemaVersion: 1,
  }
}

function repositoryWithLock(
  files: Record<string, string>,
  lock = appliedLock([
    {
      path: LEGACY_PATH,
      sha256: sha256(LEGACY_SQL),
    },
  ])
) {
  return createFixtureRepository({
    "supabase/applied-migrations.lock.json": fixtureJson(lock),
    ...files,
  })
}

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
        sha256: sha256(LEGACY_SQL),
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

  it("keeps a post-cutover migration absent from the lock editable before live apply", async () => {
    const source =
      await loadDatabaseQualityGateModule<MigrationRepositoryModule>("migration-repository")
    const repository = repositoryWithLock(
      {
        [PENDING_PATH]: "CREATE TABLE public.pending_contract (id bigint PRIMARY KEY);\n",
      },
      appliedLock()
    )

    const result = source.inspectMigrationRepository({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("PASS")
    expect(result.findings).toEqual([])
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
