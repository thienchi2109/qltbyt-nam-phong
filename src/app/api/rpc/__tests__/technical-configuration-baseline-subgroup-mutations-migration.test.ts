import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations")
const TASKS_PATH = join(
  process.cwd(),
  "openspec",
  "changes",
  "archive",
  "2026-08-14-revise-technical-configuration-baseline-hierarchy",
  "tasks.md"
)
const ALLOWLIST_PATH = join(process.cwd(), "src", "lib", "technical-configuration-baseline-rpcs.ts")
const PHASE_GATE_PATH = join(
  process.cwd(),
  "supabase",
  "tests",
  "technical_configuration_baseline_hierarchy_mutations_phase_gate.sql"
)
const P1D_MIGRATION_FILE = "20260807195507_technical_configuration_baseline_hierarchy_snapshots.sql"
const P1E_MIGRATION_SUFFIXES = [
  "_technical_configuration_baseline_hierarchy_mutation_helpers.sql",
  "_technical_configuration_baseline_subgroup_mutations.sql",
  "_technical_configuration_baseline_hierarchy_criterion_mutations.sql",
] as const

const migrationFiles = readdirSync(MIGRATIONS_DIR).sort()
const p1eMigrationFiles = P1E_MIGRATION_SUFFIXES.map((suffix) =>
  migrationFiles.find((file) => file.endsWith(suffix))
).filter((file): file is string => file !== undefined)
const p1eMigrationSource = p1eMigrationFiles
  .map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n")

function getFunctionBlock(source: string, functionName: string, signature: string) {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(\n${signature}`
  const start = source.indexOf(marker)
  if (start < 0) {
    throw new Error(`Missing function ${functionName}(${signature})`)
  }

  const end = source.indexOf("\n$$;", start)
  if (end < 0) {
    throw new Error(`Unterminated function ${functionName}(${signature})`)
  }

  return source.slice(start, end + 4)
}

const NEW_RPC_SIGNATURES = [
  [
    "technical_configuration_baseline_subgroup_create",
    "  p_group_id UUID,\n  p_name TEXT,\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_subgroup_update",
    "  p_subgroup_id UUID,\n  p_name TEXT,\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_subgroup_delete",
    "  p_subgroup_id UUID,\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_subgroups_reorder",
    "  p_group_id UUID,\n  p_subgroup_ids UUID[],\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_hierarchy_criterion_create",
    "  p_group_id UUID,\n  p_subgroup_id UUID,\n  p_title TEXT,\n  p_requirement_text TEXT,\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_hierarchy_criterion_move",
    "  p_criterion_id UUID,\n  p_target_group_id UUID,\n  p_target_subgroup_id UUID,\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_hierarchy_criteria_reorder",
    "  p_group_id UUID,\n  p_subgroup_id UUID,\n  p_criterion_ids UUID[],\n  p_expected_revision BIGINT",
  ],
] as const

const LEGACY_COMPATIBILITY_SIGNATURES = [
  [
    "technical_configuration_baseline_criterion_create",
    "  p_group_id UUID,\n  p_title TEXT,\n  p_requirement_text TEXT,\n  p_expected_revision BIGINT",
  ],
  [
    "technical_configuration_baseline_criteria_reorder",
    "  p_group_id UUID,\n  p_criterion_ids UUID[],\n  p_expected_revision BIGINT",
  ],
] as const

describe("technical configuration baseline P1E hierarchy mutation migration", () => {
  it("ships ordered helper and RPC migrations plus a non-destructive phase gate", () => {
    expect(p1eMigrationFiles).toHaveLength(P1E_MIGRATION_SUFFIXES.length)
    expect(p1eMigrationFiles.every((file) => file > P1D_MIGRATION_FILE)).toBe(true)

    const phaseGateSource = readFileSync(PHASE_GATE_PATH, "utf8")
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
  })

  const describeP1EMigration =
    p1eMigrationFiles.length === P1E_MIGRATION_SUFFIXES.length ? describe : describe.skip

  describeP1EMigration("guarded hierarchy mutation contracts", () => {
    it("adds internal helpers, legacy compatibility, and seven P1E RPC contracts", () => {
      const functionNames = [
        ...p1eMigrationSource.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/g),
      ].map((match) => match[1])

      expect(functionNames).toEqual([
        "_technical_configuration_baseline_hierarchy_context",
        "_technical_configuration_baseline_normalize_group",
        "_technical_configuration_baseline_subgroup_payload",
        "_technical_configuration_baseline_hierarchy_criterion_payload",
        ...NEW_RPC_SIGNATURES.slice(0, 4).map(([name]) => name),
        ...LEGACY_COMPATIBILITY_SIGNATURES.map(([name]) => name),
        ...NEW_RPC_SIGNATURES.slice(4).map(([name]) => name),
      ])
      expect(p1eMigrationSource).not.toContain("CREATE TABLE")
      expect(p1eMigrationSource).not.toContain("ALTER TABLE")
      expect(p1eMigrationSource).not.toContain("technical_configuration_baseline_group_create(\n")
      expect(p1eMigrationSource).not.toContain(
        "technical_configuration_baseline_criterion_update(\n"
      )
      expect(p1eMigrationSource).not.toContain(
        "technical_configuration_baseline_criterion_delete(\n"
      )
    })

    it("pins every new RPC to the editable draft and expected revision guard", () => {
      for (const [name, signature] of NEW_RPC_SIGNATURES) {
        const block = getFunctionBlock(p1eMigrationSource, name, signature)

        expect(block).toContain("SECURITY DEFINER")
        expect(block).toContain("SET search_path = public, pg_temp")
        expect(block).toContain("p_expected_revision")
        expect(block).toContain("public._technical_configuration_baseline_hierarchy_context(")
      }

      const contextBlock = getFunctionBlock(
        p1eMigrationSource,
        "_technical_configuration_baseline_hierarchy_context",
        "  p_group_id UUID,\n  p_subgroup_id UUID,\n  p_expected_revision BIGINT"
      )
      expect(contextBlock).toContain("public._technical_configuration_require_global_user()")
      expect(contextBlock).toContain(
        "public._technical_configuration_require_editable_baseline_version("
      )
      expect(contextBlock).toContain("s.id = p_subgroup_id")
      expect(contextBlock).toContain("s.group_id = p_group_id")
      expect(contextBlock).toContain("s.baseline_version_id = v_version_id")
      expect(contextBlock).toContain("unsupported_hierarchy_depth")
    })

    it("normalizes direct criteria before complete subgroup blocks", () => {
      const block = getFunctionBlock(
        p1eMigrationSource,
        "_technical_configuration_baseline_normalize_group",
        "  p_group_id UUID,\n  p_user_id BIGINT"
      )

      expect(block).toContain("SET CONSTRAINTS tc_baseline_subgroups_group_sort_key DEFERRED")
      expect(block).toContain(
        "SET CONSTRAINTS technical_configuration_baseline_criteria_group_sort_key DEFERRED"
      )
      expect(block).toContain("c.subgroup_id IS NULL")
      expect(block).toContain("s.sort_order")
      expect(block).toContain("c.sort_order")
      expect(block).toContain("row_number() OVER")

      for (const [name, signature] of NEW_RPC_SIGNATURES) {
        expect(getFunctionBlock(p1eMigrationSource, name, signature)).toContain(
          "public._technical_configuration_baseline_normalize_group("
        )
      }
    })

    it("validates complete subgroup partitions before reorder or delete", () => {
      const reorderBlock = getFunctionBlock(
        p1eMigrationSource,
        "technical_configuration_baseline_subgroups_reorder",
        "  p_group_id UUID,\n  p_subgroup_ids UUID[],\n  p_expected_revision BIGINT"
      )
      expect(reorderBlock).toContain("COUNT(DISTINCT item_id)")
      expect(reorderBlock).toContain("cardinality(p_subgroup_ids)")
      expect(reorderBlock).toContain("id = ANY(p_subgroup_ids)")
      expect(reorderBlock).toContain("WITH ORDINALITY")

      const deleteBlock = getFunctionBlock(
        p1eMigrationSource,
        "technical_configuration_baseline_subgroup_delete",
        "  p_subgroup_id UUID,\n  p_expected_revision BIGINT"
      )
      expect(deleteBlock).toContain("subgroup_not_empty")
      expect(deleteBlock).toContain("technical_configuration_baseline_criteria")
    })

    it("creates and moves criteria without replacing stable identity or code", () => {
      const createBlock = getFunctionBlock(
        p1eMigrationSource,
        "technical_configuration_baseline_hierarchy_criterion_create",
        "  p_group_id UUID,\n  p_subgroup_id UUID,\n  p_title TEXT,\n  p_requirement_text TEXT,\n  p_expected_revision BIGINT"
      )
      expect(createBlock).toContain("next_criterion_number")
      expect(createBlock).toContain("GREATEST(4, length(v_criterion_number::TEXT))")
      expect(createBlock).toContain("subgroup_id")

      const moveBlock = getFunctionBlock(
        p1eMigrationSource,
        "technical_configuration_baseline_hierarchy_criterion_move",
        "  p_criterion_id UUID,\n  p_target_group_id UUID,\n  p_target_subgroup_id UUID,\n  p_expected_revision BIGINT"
      )
      expect(moveBlock).toContain("WHERE id = p_criterion_id")
      expect(moveBlock).toContain("group_id = p_target_group_id")
      expect(moveBlock).toContain("subgroup_id = p_target_subgroup_id")
      expect(moveBlock).not.toMatch(/SET\s+(id|criterion_code)\s*=/)
      expect(moveBlock).toContain("v_source_group_id")
      expect(moveBlock).toContain("v_target_version_id")
    })

    it("reorders exactly one direct or subgroup criterion partition", () => {
      const block = getFunctionBlock(
        p1eMigrationSource,
        "technical_configuration_baseline_hierarchy_criteria_reorder",
        "  p_group_id UUID,\n  p_subgroup_id UUID,\n  p_criterion_ids UUID[],\n  p_expected_revision BIGINT"
      )

      expect(block).toContain("subgroup_id IS NOT DISTINCT FROM p_subgroup_id")
      expect(block).toContain("COUNT(DISTINCT item_id)")
      expect(block).toContain("cardinality(p_criterion_ids)")
      expect(block).toContain("WITH ORDINALITY")
    })

    it("keeps legacy criterion create and reorder canonical on hierarchy drafts", () => {
      for (const [name, signature] of LEGACY_COMPATIBILITY_SIGNATURES) {
        const block = getFunctionBlock(p1eMigrationSource, name, signature)

        expect(block).toContain("public._technical_configuration_baseline_hierarchy_context(")
        expect(block).toContain("public._technical_configuration_baseline_normalize_group(")
      }
    })

    it("keeps the P1E migration ungranted and registers every contract for P6A activation", () => {
      const allowlistSource = readFileSync(ALLOWLIST_PATH, "utf8")

      for (const [name, signature] of NEW_RPC_SIGNATURES) {
        const sqlSignature = signature
          .split("\n")
          .map((line) => line.trim().split(/\s+/)[1]?.replace(/,$/, ""))
          .join(", ")

        expect(p1eMigrationSource).toContain(
          `REVOKE ALL ON FUNCTION public.${name}(${sqlSignature}) FROM PUBLIC, anon, authenticated, service_role;`
        )
        expect(p1eMigrationSource).not.toContain(
          `GRANT EXECUTE ON FUNCTION public.${name}(${sqlSignature})`
        )
        expect(allowlistSource).toContain(name)
      }
    })

    it("ships executable phase-gate coverage for atomic rejection and identity", () => {
      const phaseGateSource = readFileSync(PHASE_GATE_PATH, "utf8")

      for (const marker of [
        "canonical hierarchy mutation ordering failed",
        "criterion move identity failed",
        "subgroup reorder block failed",
        "subgroup delete atomic rejection failed",
        "foreign scope atomic rejection failed",
        "unsupported depth atomic rejection failed",
        "locked version atomic rejection failed",
        "stale revision atomic rejection failed",
        "criterion code width failed",
        "legacy hierarchy canonical ordering failed",
        "direct criterion partition reorder failed",
        "linked criterion records changed during move",
      ]) {
        expect(phaseGateSource).toContain(marker)
      }
      expect(phaseGateSource).toContain("locked_at, locked_by")
      expect(phaseGateSource).toContain("SET CONSTRAINTS ALL IMMEDIATE;")
    })

    it("keeps completed hierarchy phases aligned through P6A verification", () => {
      const tasksSource = readFileSync(TASKS_PATH, "utf8")

      for (const task of [
        "P1E.1",
        "P1E.2",
        "P1E.3",
        "P1E.4",
        "P2A.1",
        "P2A.2",
        "P2A.3",
        "P2A.4",
        "P2B.1",
        "P2B.2",
        "P2B.3",
        "P2B.4",
        "P2B.5",
        "P6A.1",
      ]) {
        expect(tasksSource).toContain(`- [x] ${task}`)
      }
    })
  })
})
