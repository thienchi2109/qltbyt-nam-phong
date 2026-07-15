import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_import_phase_gate.sql"
)
const ATOMICITY_PHASE_GATE_PATH = path.resolve(
  process.cwd(),
  "supabase/tests/technical_configuration_baseline_import_atomicity_phase_gate.sql"
)
const IMPORT_MIGRATION_SUFFIX = "_technical_configuration_baseline_import.sql"
const IMPORT_METADATA_VALIDATION_MIGRATION_SUFFIX =
  "_technical_configuration_baseline_import_metadata_validation.sql"
const IMPORT_VALIDATION_MIGRATION_SUFFIX = "_technical_configuration_baseline_import_validation.sql"
const LATEST_BASELINE_MIGRATION =
  "20260714030000_technical_configuration_baseline_history_review_fixes.sql"
const METADATA_VALIDATOR_FUNCTION = "_technical_configuration_baseline_import_validate_metadata"
const VALIDATOR_FUNCTION = "_technical_configuration_baseline_import_validate"
const PREVIEW_FUNCTION = "technical_configuration_baseline_import_preview"
const APPLY_FUNCTION = "technical_configuration_baseline_import_apply"

function getImportMigration(): { file: string; source: string } {
  const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((file) =>
    file.endsWith(IMPORT_MIGRATION_SUFFIX)
  )
  const validationMigrationFiles = readdirSync(MIGRATIONS_DIR).filter((file) =>
    file.endsWith(IMPORT_VALIDATION_MIGRATION_SUFFIX)
  )
  const metadataValidationMigrationFiles = readdirSync(MIGRATIONS_DIR).filter((file) =>
    file.endsWith(IMPORT_METADATA_VALIDATION_MIGRATION_SUFFIX)
  )

  expect(migrationFiles).toHaveLength(1)
  expect(metadataValidationMigrationFiles).toHaveLength(1)
  expect(validationMigrationFiles).toHaveLength(1)
  const file = migrationFiles[0] ?? ""
  const source = [...metadataValidationMigrationFiles, ...validationMigrationFiles, file]
    .sort()
    .map((migrationFile) => readFileSync(path.join(MIGRATIONS_DIR, migrationFile), "utf8"))
    .join("\n")
  return { file, source }
}

function getFunctionBlock(migrationSource: string, functionName: string): string {
  const start = migrationSource.lastIndexOf(`CREATE OR REPLACE FUNCTION public.${functionName}`)
  expect(start).toBeGreaterThanOrEqual(0)

  const end = migrationSource.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)
  return migrationSource.slice(start, end + 4)
}

function expectSecuredFunction(block: string) {
  expect(block).toContain("SECURITY DEFINER")
  expect(block).toContain("SET search_path = public, pg_temp")
}

describe("technical configuration baseline P5C import migration", () => {
  it("sorts after the latest baseline migration and defines the exact P5C signatures", () => {
    const { file, source } = getImportMigration()

    expect(file.localeCompare(LATEST_BASELINE_MIGRATION)).toBeGreaterThan(0)
    expect(source).toContain(
      `CREATE OR REPLACE FUNCTION public.${PREVIEW_FUNCTION}(\n  p_baseline_version_id UUID,\n  p_template_metadata JSONB,\n  p_rows JSONB,\n  p_expected_revision BIGINT`
    )
    expect(source).toContain(
      `CREATE OR REPLACE FUNCTION public.${APPLY_FUNCTION}(\n  p_baseline_version_id UUID,\n  p_template_metadata JSONB,\n  p_rows JSONB,\n  p_expected_revision BIGINT`
    )
  })

  it("uses secured validation helpers and revalidates apply after the editable-version lock", () => {
    const { source } = getImportMigration()
    const metadataValidatorBlock = getFunctionBlock(source, METADATA_VALIDATOR_FUNCTION)
    const validatorBlock = getFunctionBlock(source, VALIDATOR_FUNCTION)
    const previewBlock = getFunctionBlock(source, PREVIEW_FUNCTION)
    const applyBlock = getFunctionBlock(source, APPLY_FUNCTION)

    expectSecuredFunction(metadataValidatorBlock)
    expectSecuredFunction(validatorBlock)
    expectSecuredFunction(previewBlock)
    expectSecuredFunction(applyBlock)
    expect(previewBlock).toContain("_technical_configuration_require_editable_baseline_version")
    expect(previewBlock).toContain(VALIDATOR_FUNCTION)
    expect(previewBlock).not.toMatch(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./)
    expect(validatorBlock).toContain(METADATA_VALIDATOR_FUNCTION)

    const lockIndex = applyBlock.indexOf(
      "_technical_configuration_require_editable_baseline_version"
    )
    const validationIndex = applyBlock.indexOf(VALIDATOR_FUNCTION)
    const mutationIndex = applyBlock.search(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\./)
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(validationIndex).toBeGreaterThan(lockIndex)
    expect(mutationIndex).toBeGreaterThan(validationIndex)
  })

  it("validates target metadata and the complete canonical row contract", () => {
    const { source } = getImportMigration()
    const metadataValidatorBlock = getFunctionBlock(source, METADATA_VALIDATOR_FUNCTION)
    const validatorBlock = getFunctionBlock(source, VALIDATOR_FUNCTION)

    for (const key of [
      "template_kind",
      "template_version",
      "dossier_id",
      "baseline_version_id",
      "baseline_revision",
      "generated_at",
    ]) {
      expect(metadataValidatorBlock).toContain(key)
    }
    for (const key of [
      "row_type",
      "group_order",
      "group_name",
      "criterion_order",
      "criterion_code",
      "criterion_title",
      "requirement_text",
    ]) {
      expect(validatorBlock).toContain(key)
    }

    expect(metadataValidatorBlock).toContain("technical_configuration_baseline")
    expect(metadataValidatorBlock).toContain("template_mismatch")
    expect(validatorBlock).toContain("changed_criterion_code")
    expect(validatorBlock).toContain("duplicate_criterion_code")
    expect(validatorBlock).toContain("GREATEST(4, length")
    expect(validatorBlock).toContain("invalid_row_shape")
    expect(validatorBlock).toContain("row_errors")
  })

  it("reconciles the full tree while preserving existing criterion identity", () => {
    const applyBlock = getFunctionBlock(getImportMigration().source, APPLY_FUNCTION)

    expect(applyBlock).toMatch(/UPDATE public\.technical_configuration_baseline_groups/)
    expect(applyBlock).toMatch(/INSERT INTO public\.technical_configuration_baseline_groups/)
    expect(applyBlock).toMatch(/DELETE FROM public\.technical_configuration_baseline_groups/)
    expect(applyBlock).toMatch(/UPDATE public\.technical_configuration_baseline_criteria/)
    expect(applyBlock).toMatch(/INSERT INTO public\.technical_configuration_baseline_criteria/)
    expect(applyBlock).toMatch(/DELETE FROM public\.technical_configuration_baseline_criteria/)
    expect(applyBlock).toContain("criterion_code")
    expect(applyBlock).toContain("next_criterion_number")
    expect(applyBlock).toMatch(/revision = revision \+ 1/)
    expect(applyBlock).toContain("_technical_configuration_baseline_snapshot")
  })

  it("loads existing codes once and reconciles criteria set-wise under the aggregate lock", () => {
    const { source } = getImportMigration()
    const validatorBlock = getFunctionBlock(source, VALIDATOR_FUNCTION)
    const applyBlock = getFunctionBlock(source, APPLY_FUNCTION)

    expect(
      validatorBlock.match(/FROM public\.technical_configuration_baseline_criteria/g)
    ).toHaveLength(1)
    expect(applyBlock).not.toContain("FOR v_row IN")
    expect(applyBlock).toMatch(
      /UPDATE public\.technical_configuration_baseline_criteria[\s\S]*FROM incoming_criteria/
    )
    expect(applyBlock).toMatch(
      /INSERT INTO public\.technical_configuration_baseline_criteria[\s\S]*SELECT/
    )
  })

  it("keeps helper grants closed and exposes only preview and apply to authenticated", () => {
    const { source } = getImportMigration()
    const helperSignatures = [
      `${METADATA_VALIDATOR_FUNCTION}(UUID, JSONB, BIGINT)`,
      `${VALIDATOR_FUNCTION}(UUID, JSONB, JSONB, BIGINT)`,
    ]
    const signatures = [
      `${PREVIEW_FUNCTION}(UUID, JSONB, JSONB, BIGINT)`,
      `${APPLY_FUNCTION}(UUID, JSONB, JSONB, BIGINT)`,
    ]

    for (const signature of helperSignatures) {
      expect(source).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(source).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role;`)
    }
    for (const signature of signatures) {
      expect(source).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(source).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`)
    }
  })

  it("ships a rollback-safe phase gate for trust, identity, counters, and atomicity", () => {
    const phaseGateSource = readFileSync(PHASE_GATE_PATH, "utf8")
    const atomicityPhaseGateSource = readFileSync(ATOMICITY_PHASE_GATE_PATH, "utf8")

    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("raw admin preview succeeds")
    expect(phaseGateSource).toContain("global apply succeeds")
    expect(phaseGateSource).toContain("missing claims fail closed")
    expect(phaseGateSource).toContain("non-global role denied")
    expect(phaseGateSource).toContain("preview is read-only")
    expect(phaseGateSource).toContain("wrong template kind")
    expect(phaseGateSource).toContain("wrong template version")
    expect(phaseGateSource).toContain("mismatched dossier metadata")
    expect(phaseGateSource).toContain("mismatched baseline metadata")
    expect(phaseGateSource).toContain("mismatched revision metadata")
    expect(phaseGateSource).toContain("metadata mismatch through apply")
    expect(phaseGateSource).toContain("malformed payload through preview")
    expect(phaseGateSource).toContain("malformed payload through apply")
    expect(phaseGateSource).toContain("tampered canonical rows")
    expect(phaseGateSource).toContain("stale revision")
    expect(phaseGateSource).toContain("locked target")
    expect(phaseGateSource).toContain("archived target")
    expect(phaseGateSource).toContain(PREVIEW_FUNCTION)
    expect(phaseGateSource).toContain(APPLY_FUNCTION)

    expect(atomicityPhaseGateSource).toContain("BEGIN;")
    expect(atomicityPhaseGateSource).toContain("ROLLBACK;")
    expect(atomicityPhaseGateSource).not.toContain("CREATE TRIGGER")
    expect(atomicityPhaseGateSource).toContain("preserves criterion identity and source linkage")
    expect(atomicityPhaseGateSource).toContain("persists a newly created group and criterion")
    expect(atomicityPhaseGateSource).toContain("deletes omitted groups and criteria")
    expect(atomicityPhaseGateSource).toContain("reorders groups and criteria")
    expect(atomicityPhaseGateSource).toContain("advances revision and counter exactly once")
    expect(atomicityPhaseGateSource).toContain("allocates TC-10000 without truncation")
    expect(atomicityPhaseGateSource).toContain("row failure rolls back the aggregate")
    expect(atomicityPhaseGateSource).toContain("duplicate failure rolls back the aggregate")
    expect(atomicityPhaseGateSource).toContain("relationship failure rolls back the aggregate")
    expect(atomicityPhaseGateSource).toContain("late failure rolls back the aggregate")
    expect(atomicityPhaseGateSource).toContain("stale revision leaves the aggregate unchanged")
  })

  it("keeps each P5C SQL artifact below the extraction threshold", () => {
    const paths = [
      path.resolve(
        MIGRATIONS_DIR,
        "20260715001200_technical_configuration_baseline_import_metadata_validation.sql"
      ),
      path.resolve(
        MIGRATIONS_DIR,
        "20260715001250_technical_configuration_baseline_import_validation.sql"
      ),
      path.resolve(MIGRATIONS_DIR, "20260715001300_technical_configuration_baseline_import.sql"),
      PHASE_GATE_PATH,
      ATOMICITY_PHASE_GATE_PATH,
    ]

    for (const filePath of paths) {
      expect(readFileSync(filePath, "utf8").split("\n").length - 1).toBeLessThanOrEqual(350)
    }
  })
})
