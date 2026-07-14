import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_locking_phase_gate.sql"
)
const LOCKING_MIGRATION_SUFFIX = "_technical_configuration_baseline_locking.sql"
const BASELINE_MUTATION_FUNCTIONS = [
  "technical_configuration_baseline_group_create",
  "technical_configuration_baseline_group_update",
  "technical_configuration_baseline_group_delete",
  "technical_configuration_baseline_groups_reorder",
  "technical_configuration_baseline_criterion_create",
  "technical_configuration_baseline_criterion_update",
  "technical_configuration_baseline_criterion_delete",
  "technical_configuration_baseline_criteria_reorder",
  "technical_configuration_baseline_bulk_preview",
] as const

function getLockingMigrationSource(): string {
  const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((file) =>
    file.endsWith(LOCKING_MIGRATION_SUFFIX)
  )

  expect(migrationFiles).toHaveLength(1)
  return readFileSync(path.join(MIGRATIONS_DIR, migrationFiles[0] ?? ""), "utf8")
}

function getBaselineMigrationSource(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.includes("technical_configuration_baseline_") && file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
    .join("\n")
}

function getFunctionBlock(migrationSource: string, functionName: string): string {
  const start = migrationSource.indexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)

  const end = migrationSource.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)
  return migrationSource.slice(start, end + 4)
}

describe("technical configuration baseline P4 locking migration", () => {
  const migrationSource = getLockingMigrationSource()

  it("adds immutable lifecycle metadata and indexed lineage", () => {
    expect(migrationSource).toContain("source_baseline_version_id UUID")
    expect(migrationSource).toContain("locked_at TIMESTAMPTZ")
    expect(migrationSource).toContain("locked_by BIGINT")
    expect(migrationSource).toContain("technical_configuration_baseline_versions_lock_state_check")
    expect(migrationSource).toContain("technical_configuration_baseline_versions_source_idx")
    expect(migrationSource).toContain("technical_configuration_baseline_criteria_source_idx")
    expect(migrationSource).toMatch(
      /FOREIGN KEY \(source_baseline_version_id, dossier_id\)[\s\S]*REFERENCES public\.technical_configuration_baseline_versions \(id, dossier_id\)/
    )
  })

  it("extends snapshots with source and lock metadata", () => {
    const block = getFunctionBlock(migrationSource, "_technical_configuration_baseline_snapshot")

    expect(block).toContain("'source_baseline_version_id'")
    expect(block).toContain("'locked_at'")
    expect(block).toContain("'locked_by'")
  })

  it("allocates the next sequential blank draft version under the dossier lock", () => {
    const block = getFunctionBlock(migrationSource, "technical_configuration_baseline_draft_create")

    expect(block).toContain("_technical_configuration_require_editable_dossier")
    expect(block).toMatch(/COALESCE\(MAX\(v\.version_number\), 0\) \+ 1/)
    expect(block).toContain("draft_already_exists")
    expect(block).toMatch(/revision = revision \+ 1/)
  })

  it("lists paginated complete version snapshots in newest-first order", () => {
    const block = getFunctionBlock(
      migrationSource,
      "technical_configuration_baseline_versions_list"
    )

    expect(block).toContain("_technical_configuration_require_global_user")
    expect(block).toContain("_technical_configuration_baseline_snapshot")
    expect(block).toContain("p_page_size")
    expect(block).toContain("BETWEEN 1 AND 100")
    expect(block).toContain("ORDER BY v.version_number DESC")
    expect(block).toContain("'total'")
    expect(block).toContain("'page_size'")
  })

  it("locks only complete current drafts and records actor and time", () => {
    const block = getFunctionBlock(migrationSource, "technical_configuration_baseline_lock")

    expect(block).toContain("_technical_configuration_require_editable_baseline_version")
    expect(block).toContain("p_expected_revision")
    expect(block).toMatch(/COUNT\(\*\)[\s\S]*technical_configuration_baseline_groups/)
    expect(block).toMatch(/COUNT\(\*\)[\s\S]*technical_configuration_baseline_criteria/)
    expect(block).toContain("COUNT(DISTINCT c.criterion_code)")
    expect(block).toContain("validation_error")
    expect(block).toContain("status = 'locked'")
    expect(block).toContain("locked_at = now()")
    expect(block).toContain("locked_by = v_user_id")
    expect(block).toMatch(/revision = revision \+ 1/)
  })

  it("copies one locked P4 aggregate atomically with fresh IDs and complete lineage", () => {
    const block = getFunctionBlock(migrationSource, "technical_configuration_baseline_copy")
    const insertedTables = [
      ...block.matchAll(/INSERT INTO public\.(technical_configuration_[a-z0-9_]+)/g),
    ].map((match) => match[1])

    expect(block).toContain("_technical_configuration_require_global_user")
    expect(block).toContain("p_expected_revision")
    expect(block).toContain("draft_already_exists")
    expect(block).toContain("source_baseline_version_id")
    expect(block).toContain("source_criterion_id")
    expect(block).toContain("gen_random_uuid()")
    expect(block).toMatch(/COALESCE\(MAX\(v\.version_number\), 0\) \+ 1/)
    expect(new Set(insertedTables)).toEqual(
      new Set([
        "technical_configuration_baseline_versions",
        "technical_configuration_baseline_groups",
        "technical_configuration_baseline_criteria",
      ])
    )
  })

  it("keeps every current baseline-owned mutation behind the editable-version guard", () => {
    const baselineSource = getBaselineMigrationSource()

    for (const functionName of BASELINE_MUTATION_FUNCTIONS) {
      expect(getFunctionBlock(baselineSource, functionName)).toContain(
        "_technical_configuration_require_editable_baseline_version"
      )
    }
  })

  it("exposes only the three P4 lifecycle RPCs to authenticated users", () => {
    const signatures = [
      "technical_configuration_baseline_versions_list(UUID, INTEGER, INTEGER)",
      "technical_configuration_baseline_lock(UUID, BIGINT)",
      "technical_configuration_baseline_copy(UUID, BIGINT)",
    ]

    for (const signature of signatures) {
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`
      )
    }
  })

  it("ships a rollback-safe phase gate for claims, locking, mutation, copy, and history", () => {
    const phaseGateSource = readFileSync(PHASE_GATE_PATH, "utf8")

    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("pg_temp.set_claims('admin'")
    expect(phaseGateSource).toContain("pg_temp.set_claims('global'")
    expect(phaseGateSource).toContain("missing claims fail closed")
    expect(phaseGateSource).toContain("non-global role denied")
    expect(phaseGateSource).toContain("lock requires baseline content")
    expect(phaseGateSource).toContain("lock rejects a stale revision")
    expect(phaseGateSource).toContain("copy rejects a stale locked revision")
    expect(phaseGateSource).toContain("blank creation rejects an existing draft")
    expect(phaseGateSource).toContain("copy rejects an existing draft")
    expect(phaseGateSource).toContain("historical read after newer version is locked")
    expect(phaseGateSource).toContain("source_baseline_version_id")
    expect(phaseGateSource).toContain("source_criterion_id")
    expect(phaseGateSource).toContain("technical_configuration_baseline_versions_list")

    for (const functionName of BASELINE_MUTATION_FUNCTIONS) {
      expect(phaseGateSource).toContain(functionName)
    }
  })
})
