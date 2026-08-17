import { afterEach, describe, expect, it } from "vitest"

import {
  cleanupFixtureRepositories,
  createFixtureRepository,
  loadDatabaseQualityGateModule,
} from "./database-quality-gate-test-support"

type MigrationIdentity = {
  path: string
  sha256: string
}

type SourceFinding = {
  ruleId: string
}

type SourceInspection = {
  findings: SourceFinding[]
  migrationIdentities: MigrationIdentity[]
  outcome: "INCOMPLETE" | "PASS"
}

type MigrationSourceModule = {
  createProtectedCutoverBootstrap: (input: { migrationRoot?: string; repositoryRoot: string }) => {
    migrationIdentities: MigrationIdentity[]
    migrationRoot: string
    status: "PENDING_PROTECTED_MAIN"
  }
  inspectCanonicalMigrationSource: (input: {
    migrationRoot?: string
    repositoryRoot: string
  }) => SourceInspection
}

afterEach(cleanupFixtureRepositories)

describe("database quality gate canonical migration source", () => {
  it("uses every root SQL file in deterministic lexical order without rejecting legacy duplicate dates", async () => {
    const source = await loadDatabaseQualityGateModule<MigrationSourceModule>("migration-source")
    const repository = createFixtureRepository({
      "supabase/migrations/20241220_alpha.sql": "SELECT 'alpha';\n",
      "supabase/migrations/20241220_beta.sql": "SELECT 'beta';\n",
      "supabase/migrations/202511061200_legacy.sql": "SELECT 'legacy';\n",
      "supabase/migrations/20270101000000_current.sql": "SELECT 'current';\n",
      "supabase/migrations/archive/20200101000000_support.sql": "SELECT 'support';\n",
    })

    const result = source.inspectCanonicalMigrationSource({ repositoryRoot: repository.root })

    expect(result).toMatchObject({
      findings: [],
      migrationIdentities: [
        { path: "supabase/migrations/20241220_alpha.sql" },
        { path: "supabase/migrations/20241220_beta.sql" },
        { path: "supabase/migrations/202511061200_legacy.sql" },
        { path: "supabase/migrations/20270101000000_current.sql" },
      ],
      outcome: "PASS",
    })
  })

  it("fails closed when two canonical fourteen-digit migration versions collide", async () => {
    const source = await loadDatabaseQualityGateModule<MigrationSourceModule>("migration-source")
    const repository = createFixtureRepository({
      "supabase/migrations/20270101000000_first.sql": "SELECT 1;\n",
      "supabase/migrations/20270101000000_second.sql": "SELECT 2;\n",
    })

    const result = source.inspectCanonicalMigrationSource({ repositoryRoot: repository.root })

    expect(result.outcome).toBe("INCOMPLETE")
    expect(result.findings).toContainEqual(
      expect.objectContaining({ ruleId: "migration.source-order" })
    )
  })

  it("prepares a non-activating cutover bootstrap without inventing the protected main SHA", async () => {
    const source = await loadDatabaseQualityGateModule<MigrationSourceModule>("migration-source")
    const repository = createFixtureRepository({
      "supabase/migrations/20241220_legacy.sql": "SELECT 'legacy';\n",
      "supabase/migrations/20270101000000_pending.sql": "SELECT 'pending';\n",
    })

    const bootstrap = source.createProtectedCutoverBootstrap({ repositoryRoot: repository.root })

    expect(bootstrap).toEqual({
      migrationIdentities: [
        expect.objectContaining({ path: "supabase/migrations/20241220_legacy.sql" }),
        expect.objectContaining({ path: "supabase/migrations/20270101000000_pending.sql" }),
      ],
      migrationRoot: "supabase/migrations",
      status: "PENDING_PROTECTED_MAIN",
    })
    expect(bootstrap).not.toHaveProperty("commit")
    expect(bootstrap).not.toHaveProperty("cutover")
  })
})
