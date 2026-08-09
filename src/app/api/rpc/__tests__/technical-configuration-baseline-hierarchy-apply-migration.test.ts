import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const APPLY_PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_hierarchy_import_apply_phase_gate.sql"
)
const SECURITY_PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_hierarchy_import_apply_security_phase_gate.sql"
)
const BASELINE_HOOK_PATH = path.resolve(
  process.cwd(),
  "src/app/(app)/technical-configurations/_hooks/useTechnicalConfigurationBaseline.ts"
)
const LATEST_P2A_MIGRATION =
  "20260809001300_technical_configuration_baseline_hierarchy_import_preview.sql"
const APPLY_SUFFIX = "_technical_configuration_baseline_hierarchy_import_apply.sql"
const LEGACY_IMPORT_SUFFIX = "_technical_configuration_baseline_import.sql"
const INTERNAL_APPLY_FUNCTION = "_technical_configuration_baseline_import_apply_v2"
const PUBLIC_APPLY_FUNCTION = "technical_configuration_baseline_import_apply_v2"
const LEGACY_PREVIEW_FUNCTION = "technical_configuration_baseline_import_preview"
const LEGACY_APPLY_FUNCTION = "technical_configuration_baseline_import_apply"

function readSingleMigration(suffix: string): { file: string; source: string } {
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith(suffix))
  expect(files).toHaveLength(1)
  const file = files[0]
  if (!file) {
    throw new Error(`Missing migration ending in ${suffix}`)
  }
  return {
    file,
    source: readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"),
  }
}

function getFunctionBlock(source: string, functionName: string): string {
  const start = source.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = source.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end + 4)
}

function functionBodyHash(block: string): string {
  const bodyStart = block.indexOf("AS $$")
  const bodyEnd = block.lastIndexOf("\n$$;")
  expect(bodyStart).toBeGreaterThanOrEqual(0)
  expect(bodyEnd).toBeGreaterThan(bodyStart)
  return createHash("md5")
    .update(block.slice(bodyStart + "AS $$".length, bodyEnd + 1))
    .digest("hex")
}

function expectSecuredFunction(block: string) {
  expect(block).toContain("SECURITY DEFINER")
  expect(block).toContain("SET search_path = public, pg_temp")
}

describe("technical configuration baseline P2B hierarchy apply migration", () => {
  it("sorts after P2A and defines separate internal capability and guarded RPC signatures", () => {
    const migration = readSingleMigration(APPLY_SUFFIX)

    expect(migration.file.localeCompare(LATEST_P2A_MIGRATION)).toBeGreaterThan(0)
    for (const functionName of [INTERNAL_APPLY_FUNCTION, PUBLIC_APPLY_FUNCTION]) {
      expect(migration.source).toContain(
        `CREATE OR REPLACE FUNCTION public.${functionName}(\n  p_baseline_version_id UUID,\n  p_template_metadata JSONB,\n  p_rows JSONB,\n  p_expected_revision BIGINT`
      )
    }
  })

  it("revalidates under the editable-version lock before any hierarchical mutation", () => {
    const apply = getFunctionBlock(
      readSingleMigration(APPLY_SUFFIX).source,
      INTERNAL_APPLY_FUNCTION
    )
    expectSecuredFunction(apply)

    const lockIndex = apply.indexOf("_technical_configuration_require_editable_baseline_version")
    const validateIndex = apply.indexOf("_technical_configuration_baseline_import_validate_v2")
    const firstMutationIndex = Math.min(
      ...["INSERT INTO public.", "UPDATE public.", "DELETE FROM public."].map((token) =>
        apply.indexOf(token)
      )
    )

    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(validateIndex).toBeGreaterThan(lockIndex)
    expect(firstMutationIndex).toBeGreaterThan(validateIndex)
    expect(apply).toContain("v_errors := v_validation->'row_errors'")
    expect(apply).toContain(
      "RAISE EXCEPTION 'validation_error'\n      USING ERRCODE = 'PT422', DETAIL = v_errors::TEXT;"
    )
  })

  it("reconciles the complete hierarchy in dependency-safe order", () => {
    const apply = getFunctionBlock(
      readSingleMigration(APPLY_SUFFIX).source,
      INTERNAL_APPLY_FUNCTION
    )

    for (const contract of [
      "v_group_map",
      "v_subgroup_map",
      "target_group_order",
      "target_subgroup_order",
      "target_criterion_order",
      "technical_configuration_baseline_groups_version_sort_key",
      "tc_baseline_subgroups_group_sort_key",
      "technical_configuration_baseline_criteria_group_sort_key",
      "tc_baseline_criteria_subgroup_scope_fkey",
    ]) {
      expect(apply).toContain(contract)
    }

    const orderedMutations = [
      "UPDATE public.technical_configuration_baseline_groups",
      "INSERT INTO public.technical_configuration_baseline_groups",
      "UPDATE public.technical_configuration_baseline_subgroups",
      "INSERT INTO public.technical_configuration_baseline_subgroups",
      "UPDATE public.technical_configuration_baseline_criteria",
      "INSERT INTO public.technical_configuration_baseline_criteria",
      "DELETE FROM public.technical_configuration_baseline_criteria",
      "DELETE FROM public.technical_configuration_baseline_subgroups",
      "DELETE FROM public.technical_configuration_baseline_groups",
      "UPDATE public.technical_configuration_baseline_versions",
    ].map((token) => apply.indexOf(token))

    expect(orderedMutations.every((index) => index >= 0)).toBe(true)
    expect(orderedMutations).toEqual([...orderedMutations].sort((left, right) => left - right))
  })

  it("preserves compatible criterion identity and advances counters only for creates", () => {
    const apply = getFunctionBlock(
      readSingleMigration(APPLY_SUFFIX).source,
      INTERNAL_APPLY_FUNCTION
    )

    expect(apply).toContain("WHERE c.id = i.criterion_id")
    expect(apply).toContain("i.criterion_code")
    expect(apply).not.toMatch(
      /UPDATE public\.technical_configuration_baseline_criteria[\s\S]*?SET[\s\S]*?criterion_code\s*=/
    )
    expect(apply).toContain(
      "v_new_criterion_count := (v_validation->'effects'->'criteria'->>'create')::BIGINT;"
    )
    expect(apply).toContain("next_criterion_number = next_criterion_number + v_new_criterion_count")
    expect(apply).toContain("revision = revision + 1")
    expect(
      apply.match(/UPDATE public\.technical_configuration_baseline_versions/g) ?? []
    ).toHaveLength(1)
  })

  it("returns the exact validated preview contract alongside the resulting snapshot", () => {
    const apply = getFunctionBlock(
      readSingleMigration(APPLY_SUFFIX).source,
      INTERNAL_APPLY_FUNCTION
    )

    expect(apply).toContain("'preview', jsonb_build_object(")
    for (const projection of [
      "'metadata', v_validation->'metadata'",
      "'rows', v_validation->'normalized_rows'",
      "'counts', v_validation->'counts'",
      "'effects', v_validation->'effects'",
    ]) {
      expect(apply).toContain(projection)
    }
    expect(apply).toContain(
      "'data', public._technical_configuration_baseline_snapshot(p_baseline_version_id)"
    )
  })

  it("keeps v2 apply unreachable before P6A while preserving legacy import byte contracts", () => {
    const migration = readSingleMigration(APPLY_SUFFIX).source
    const guardedApply = getFunctionBlock(migration, PUBLIC_APPLY_FUNCTION)
    const legacy = readSingleMigration(LEGACY_IMPORT_SUFFIX).source

    expectSecuredFunction(guardedApply)
    expect(guardedApply).toContain(
      "RAISE EXCEPTION 'hierarchical_import_apply_not_activated' USING ERRCODE = 'PT409';"
    )
    expect(guardedApply).not.toContain(INTERNAL_APPLY_FUNCTION)
    expect(migration).not.toContain(`CREATE OR REPLACE FUNCTION public.${LEGACY_PREVIEW_FUNCTION}(`)
    expect(migration).not.toContain(`CREATE OR REPLACE FUNCTION public.${LEGACY_APPLY_FUNCTION}(`)
    expect(functionBodyHash(getFunctionBlock(legacy, LEGACY_PREVIEW_FUNCTION))).toBe(
      "936ffdff03e507329bc4360e7a70ddec"
    )
    expect(functionBodyHash(getFunctionBlock(legacy, LEGACY_APPLY_FUNCTION))).toBe(
      "d6f450804e30c25ce7ae00b85008edef"
    )
  })

  it("locks internal/public privileges and registers only the guarded v2 RPC", () => {
    const migration = readSingleMigration(APPLY_SUFFIX).source
    const signature = "(UUID, JSONB, JSONB, BIGINT)"

    expect(migration).toContain(
      `REVOKE ALL ON FUNCTION public.${INTERNAL_APPLY_FUNCTION}${signature} FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(migration).not.toContain(
      `GRANT EXECUTE ON FUNCTION public.${INTERNAL_APPLY_FUNCTION}${signature}`
    )
    expect(migration).toContain(
      `REVOKE ALL ON FUNCTION public.${PUBLIC_APPLY_FUNCTION}${signature} FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(migration).toContain(
      `GRANT EXECUTE ON FUNCTION public.${PUBLIC_APPLY_FUNCTION}${signature} TO authenticated;`
    )
    expect(BASELINE_RPC_FUNCTIONS.applyImport).toBe(LEGACY_APPLY_FUNCTION)
    expect(BASELINE_RPC_FUNCTIONS.applyHierarchyImport).toBe(PUBLIC_APPLY_FUNCTION)
    expect(readFileSync(BASELINE_HOOK_PATH, "utf8")).not.toContain("applyHierarchyImport")
  })

  it("ships rollback-only functional and security phase gates for every P2B failure mode", () => {
    const phaseGate = readFileSync(APPLY_PHASE_GATE_PATH, "utf8")
    const securityPhaseGate = readFileSync(SECURITY_PHASE_GATE_PATH, "utf8")

    for (const source of [phaseGate, securityPhaseGate]) {
      expect(source).toContain("BEGIN;")
      expect(source).toContain("ROLLBACK;")
    }
    for (const scenario of [
      "complete hierarchy reconciliation",
      "preview apply parity",
      "preserves compatible identities and codes",
      "advances next criterion only for creates",
      "increments revision exactly once",
      "empty tree replacement",
      "stale revision rollback",
      "tampered identity rollback",
      "validation error rollback",
      "injected failure rollback",
      "fixture tree snapshot",
      "deferred constraint commit check",
      "expected effect counts",
      "section hierarchy contract",
      "subgroup hierarchy contract",
      "existing subgroup reorder contract",
      "existing criterion reorder contract",
      "new criterion membership contract",
    ]) {
      expect(phaseGate).toContain(scenario)
    }
    expect(phaseGate).toMatch(/\(v_criterion_a_id,[\s\S]*?'Alpha requirement', 2,/)
    expect(phaseGate).toMatch(
      /\(v_criterion_subgroup_delete_id,[\s\S]*?'Delete subgroup requirement', 3,/
    )
    expect(phaseGate.match(/SET CONSTRAINTS ALL IMMEDIATE;/g) ?? []).toHaveLength(2)
    for (const scenario of [
      "public v2 apply not activated",
      "legacy apply privilege contract",
      "public v2 apply privilege contract",
      "internal apply privilege contract",
      "legacy function hash contract",
      "has_function_privilege",
    ]) {
      expect(securityPhaseGate).toContain(scenario)
    }
  })

  it("keeps each P2B SQL artifact below the hard file ceiling", () => {
    const paths = [
      path.join(MIGRATIONS_DIR, readSingleMigration(APPLY_SUFFIX).file),
      APPLY_PHASE_GATE_PATH,
      SECURITY_PHASE_GATE_PATH,
    ]

    for (const filePath of paths) {
      expect(readFileSync(filePath, "utf8").split("\n").length).toBeLessThanOrEqual(450)
    }
  })
})
