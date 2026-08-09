import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_hierarchy_import_preview_phase_gate.sql"
)
const SECURITY_PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_hierarchy_import_preview_security_phase_gate.sql"
)
const LATEST_P1E_MIGRATION =
  "20260808030200_technical_configuration_baseline_hierarchy_criterion_mutations.sql"
const METADATA_SUFFIX = "_technical_configuration_baseline_hierarchy_import_metadata.sql"
const VALIDATION_SUFFIX = "_technical_configuration_baseline_hierarchy_import_validation.sql"
const PREVIEW_SUFFIX = "_technical_configuration_baseline_hierarchy_import_preview.sql"
const METADATA_FUNCTION = "_technical_configuration_baseline_import_validate_metadata_v2"
const VALIDATOR_FUNCTION = "_technical_configuration_baseline_import_validate_v2"
const PREVIEW_FUNCTION = "technical_configuration_baseline_import_preview_v2"

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

function expectStableSecuredFunction(block: string) {
  expect(block).toContain("SECURITY DEFINER")
  expect(block).toContain("SET search_path = public, pg_temp")
  expect(block).toMatch(/\nSTABLE\n/)
}

function expectReadOnlyWithoutLocks(block: string) {
  expect(block).not.toMatch(
    /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE)\s+public\./i
  )
  expect(block).not.toMatch(/\bFOR\s+(?:UPDATE|NO\s+KEY\s+UPDATE|SHARE|KEY\s+SHARE)\b/i)
}

describe("technical configuration baseline P2A hierarchy preview migrations", () => {
  it("sorts after P1E and defines separate v2 validator and preview signatures", () => {
    const metadata = readSingleMigration(METADATA_SUFFIX)
    const validation = readSingleMigration(VALIDATION_SUFFIX)
    const preview = readSingleMigration(PREVIEW_SUFFIX)

    expect(metadata.file.localeCompare(LATEST_P1E_MIGRATION)).toBeGreaterThan(0)
    expect(validation.file.localeCompare(metadata.file)).toBeGreaterThan(0)
    expect(preview.file.localeCompare(validation.file)).toBeGreaterThan(0)
    expect(metadata.source).toContain(
      `CREATE OR REPLACE FUNCTION public.${METADATA_FUNCTION}(\n  p_baseline_version_id UUID,\n  p_template_metadata JSONB,\n  p_expected_revision BIGINT`
    )
    expect(validation.source).toContain(
      `CREATE OR REPLACE FUNCTION public.${VALIDATOR_FUNCTION}(\n  p_baseline_version_id UUID,\n  p_template_metadata JSONB,\n  p_rows JSONB,\n  p_expected_revision BIGINT`
    )
    expect(preview.source).toContain(
      `CREATE OR REPLACE FUNCTION public.${PREVIEW_FUNCTION}(\n  p_baseline_version_id UUID,\n  p_template_metadata JSONB,\n  p_rows JSONB,\n  p_expected_revision BIGINT`
    )
  })

  it("locks the strict v2 metadata and raw worksheet row contract", () => {
    const metadata = getFunctionBlock(
      readSingleMigration(METADATA_SUFFIX).source,
      METADATA_FUNCTION
    )
    const validator = getFunctionBlock(
      readSingleMigration(VALIDATION_SUFFIX).source,
      VALIDATOR_FUNCTION
    )

    for (const key of [
      "template_kind",
      "template_version",
      "dossier_id",
      "baseline_version_id",
      "baseline_revision",
      "generated_at",
    ]) {
      expect(metadata).toContain(key)
    }
    for (const key of [
      "row",
      "stt",
      "content",
      "group_id",
      "subgroup_id",
      "criterion_id",
      "criterion_code",
    ]) {
      expect(validator).toContain(key)
    }

    expect(metadata).toContain("technical_configuration_baseline")
    expect(metadata).toMatch(/template_version'[^]*?2/)
    expect(validator).toContain("invalid_row_shape")
    expect(validator).toContain("unsupported_marker")
    expect(validator).toContain("content_before_section")
    expect(validator).toContain("empty_content")
    expect(validator).toContain("row_errors")
    expect(validator).toContain("normalized_rows")
    expect(validator).toMatch(/\^\[1-9\]\[0-9\]\*\$/)
    expect(validator).toContain("CM|CD|D?C{0,3}")
    expect(validator).toContain("XC|XL|L?X{0,3}")
    expect(validator).toContain("IX|IV|V?I{0,3}")
  })

  it("defines explicit hidden-identity rejection and create-delete fallback", () => {
    const validator = getFunctionBlock(
      readSingleMigration(VALIDATION_SUFFIX).source,
      VALIDATOR_FUNCTION
    )

    for (const code of [
      "partial_identity",
      "wrong_identity_kind",
      "foreign_identity",
      "duplicate_identity",
      "changed_criterion_code",
    ]) {
      expect(validator).toContain(code)
    }
    expect(validator).toContain("identity_fallback")
    expect(validator).toContain("existing_title")
    expect(validator).toContain("original_group_id")
    expect(validator).toContain("original_subgroup_id")
    expect(validator).toContain("target_group_order")
    expect(validator).toContain("target_subgroup_order")
    expect(validator).toContain("TC-")
    expect(validator).toContain("GREATEST(4, length")
  })

  it("loads current identity set-wise and returns normalized counts and effects", () => {
    const validator = getFunctionBlock(
      readSingleMigration(VALIDATION_SUFFIX).source,
      VALIDATOR_FUNCTION
    )
    const preview = getFunctionBlock(readSingleMigration(PREVIEW_SUFFIX).source, PREVIEW_FUNCTION)

    expect(validator).toContain("current_groups")
    expect(validator).toContain("current_subgroups")
    expect(validator).toContain("current_criteria")
    expect(validator).toContain("normalized_rows")
    expect(validator).toContain("effects")
    expect(validator).toContain("create")
    expect(validator).toContain("update")
    expect(validator).toContain("move")
    expect(validator).toContain("delete")
    expect(validator).toContain("IF jsonb_array_length(v_errors) = 0 THEN")
    expect(preview).toContain("'counts'")
    expect(validator).toContain("'groups'")
    expect(validator).toContain("'subgroups'")
    expect(validator).toContain("'criteria'")
    expect(preview).toContain("'effects'")
    expect(preview).toContain("'errors'")
  })

  it("keeps validator and preview stable, read-only, and lock-free", () => {
    const metadata = getFunctionBlock(
      readSingleMigration(METADATA_SUFFIX).source,
      METADATA_FUNCTION
    )
    const validator = getFunctionBlock(
      readSingleMigration(VALIDATION_SUFFIX).source,
      VALIDATOR_FUNCTION
    )
    const preview = getFunctionBlock(readSingleMigration(PREVIEW_SUFFIX).source, PREVIEW_FUNCTION)

    expectStableSecuredFunction(metadata)
    expectStableSecuredFunction(validator)
    expectStableSecuredFunction(preview)
    expectReadOnlyWithoutLocks(metadata)
    expectReadOnlyWithoutLocks(validator)
    expectReadOnlyWithoutLocks(preview)
    expect(metadata).not.toContain("_technical_configuration_require_global_user")
    expect(metadata).toContain("current_setting('request.jwt.claims'")
    expect(metadata).toContain("FROM public.nhan_vien")
    expect(metadata).not.toContain("_technical_configuration_require_editable_baseline_version")
    expect(validator).toContain(METADATA_FUNCTION)
    expect(preview).toContain(VALIDATOR_FUNCTION)
    expect(preview).not.toContain("_technical_configuration_require_editable_baseline_version")
    expect(preview).not.toMatch(/FROM\s+public\.technical_configuration_baseline_/)
  })

  it("keeps helper closed and exposes only v2 preview to authenticated", () => {
    const source = [
      readSingleMigration(METADATA_SUFFIX).source,
      readSingleMigration(VALIDATION_SUFFIX).source,
      readSingleMigration(PREVIEW_SUFFIX).source,
    ].join("\n")
    const metadataSignature = `${METADATA_FUNCTION}(UUID, JSONB, BIGINT)`
    const validatorSignature = `${VALIDATOR_FUNCTION}(UUID, JSONB, JSONB, BIGINT)`
    const previewSignature = `${PREVIEW_FUNCTION}(UUID, JSONB, JSONB, BIGINT)`

    for (const signature of [metadataSignature, validatorSignature]) {
      expect(source).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(source).not.toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`
      )
    }
    expect(source).toContain(
      `REVOKE ALL ON FUNCTION public.${validatorSignature} FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(source).not.toContain(
      `GRANT EXECUTE ON FUNCTION public.${validatorSignature} TO authenticated;`
    )
    expect(source).toContain(
      `REVOKE ALL ON FUNCTION public.${previewSignature} FROM PUBLIC, anon, authenticated, service_role;`
    )
    expect(source).toContain(
      `GRANT EXECUTE ON FUNCTION public.${previewSignature} TO authenticated;`
    )
  })

  it("does not redefine legacy import or introduce hierarchical apply", () => {
    const source = [
      readSingleMigration(METADATA_SUFFIX).source,
      readSingleMigration(VALIDATION_SUFFIX).source,
      readSingleMigration(PREVIEW_SUFFIX).source,
    ].join("\n")

    expect(source).not.toContain(
      "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_preview("
    )
    expect(source).not.toContain(
      "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_import_apply("
    )
    expect(source).not.toContain("technical_configuration_baseline_import_apply_v2")
  })

  it("registers only the new preview RPC and ships the behavioral phase gate first", () => {
    expect(BASELINE_RPC_FUNCTIONS.previewHierarchyImport).toBe(PREVIEW_FUNCTION)
    const phaseGate = readFileSync(PHASE_GATE_PATH, "utf8")
    const securityPhaseGate = readFileSync(SECURITY_PHASE_GATE_PATH, "utf8")

    expect(phaseGate).toContain("BEGIN;")
    expect(phaseGate).toContain("ROLLBACK;")
    expect(phaseGate).toContain(PREVIEW_FUNCTION)
    for (const scenario of [
      "roman sections and normalized order",
      "direct criteria before subgroups",
      "blank rows are ignored",
      "create update move delete effects",
      "provisional criterion codes",
      "content before a section",
      "unsupported 1.1 marker",
      "empty content",
      "malformed row",
      "partial identity",
      "wrong-kind identity",
      "foreign identity",
      "changed criterion code",
      "duplicate identity",
      "invalid preview suppresses effects",
      "identity loss uses create-delete fallback",
      "empty tree previews explicit deletes",
      "stale metadata",
      "fixture tree snapshot",
      "physical row number validation",
      "preview is read-only",
    ]) {
      expect(phaseGate).toContain(scenario)
    }
    expect(phaseGate).toContain("pg_temp.baseline_tree_snapshot")
    expect(phaseGate).toContain("target_group_order")
    expect(phaseGate).toContain("target_subgroup_order")
    expect(phaseGate).toContain("target_criterion_order")
    expect(securityPhaseGate).toContain("BEGIN;")
    expect(securityPhaseGate).toContain("ROLLBACK;")
    expect(securityPhaseGate).toContain("missing claims fail closed")
    expect(securityPhaseGate).toContain("non-global role denied")
    expect(securityPhaseGate).toContain("raw admin preview succeeds")
    expect(securityPhaseGate).toContain("preview privilege contract")
    expect(securityPhaseGate).toContain("internal helper privilege contract")
    expect(securityPhaseGate).toContain("has_function_privilege")
  })

  it("keeps each P2A SQL artifact below the hard file ceiling", () => {
    const paths = [
      path.join(MIGRATIONS_DIR, readSingleMigration(METADATA_SUFFIX).file),
      path.join(MIGRATIONS_DIR, readSingleMigration(VALIDATION_SUFFIX).file),
      path.join(MIGRATIONS_DIR, readSingleMigration(PREVIEW_SUFFIX).file),
      PHASE_GATE_PATH,
      SECURITY_PHASE_GATE_PATH,
    ]

    for (const filePath of paths) {
      expect(readFileSync(filePath, "utf8").split("\n").length).toBeLessThanOrEqual(450)
    }
  })
})
