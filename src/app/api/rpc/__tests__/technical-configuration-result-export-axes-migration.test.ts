import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const LATEST_DEPENDENCY_MIGRATION =
  "20260802092217_technical_configuration_result_export_helper_search_path.sql"
const SNAPSHOT_AXES_MIGRATION_FILE =
  "20260802161400_technical_configuration_result_export_snapshot_axes_source.sql"
const AXES_MIGRATION_FILE = "20260802161401_technical_configuration_result_export_axes.sql"
const SNAPSHOT_AXES_MIGRATION_PATH = path.join(MIGRATIONS_DIR, SNAPSHOT_AXES_MIGRATION_FILE)
const AXES_MIGRATION_PATH = path.join(MIGRATIONS_DIR, AXES_MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_result_export_axes_phase_gate.sql"
)
const MANIFEST_MIGRATION_PATH = path.join(
  MIGRATIONS_DIR,
  "20260802054948_technical_configuration_result_export_manifest.sql"
)
const PREVIOUS_SNAPSHOT_MIGRATION_PATH = path.join(
  MIGRATIONS_DIR,
  "20260802092215_technical_configuration_result_export_snapshot_token_source.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getFunctionBlock(source: string, functionName: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(`
  const start = source.indexOf(marker)
  if (start === -1) return ""
  const end = source.indexOf("\n$$;", start + marker.length)
  return source.slice(start, end === -1 ? source.length : end)
}

function getSnapshotSourceCore(source: string): string {
  const start = source.indexOf("DECLARE")
  const end = source.indexOf(
    "  INTO v_snapshot_data, v_snapshot_payload, v_option_total, v_criterion_total"
  )
  return start === -1 || end === -1 ? "" : source.slice(start, end)
}

function getObjectKeys(source: string, startMarker: string, endMarker: string): string[] {
  const start = source.indexOf(startMarker)
  if (start === -1) return []
  const contentStart = start + startMarker.length
  const end = source.indexOf(endMarker, contentStart)
  if (end === -1) return []
  const markerKey = startMarker.match(/'([a-z_]+)'/)?.[1]
  const remainingKeys = [...source.slice(contentStart, end).matchAll(/^\s*'([a-z_]+)',/gm)].map(
    (match) => match[1]
  )
  return markerKey ? [markerKey, ...remainingKeys] : remainingKeys
}

const snapshotAxesSource = readIfExists(SNAPSHOT_AXES_MIGRATION_PATH)
const migrationSource = readIfExists(AXES_MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const manifestSource = readIfExists(MANIFEST_MIGRATION_PATH)
const previousSnapshotSource = readIfExists(PREVIOUS_SNAPSHOT_MIGRATION_PATH)
const snapshotBlock = getFunctionBlock(
  snapshotAxesSource,
  "_technical_configuration_result_export_snapshot"
)
const previousSnapshotBlock = getFunctionBlock(
  previousSnapshotSource,
  "_technical_configuration_result_export_snapshot"
)
const manifestBlock = getFunctionBlock(
  manifestSource,
  "technical_configuration_result_export_manifest_get"
)
const optionAxisBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_result_export_option_axis_list"
)
const criterionAxisBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_result_export_criterion_axis_list"
)

describe("P14A4 technical configuration result export axes migration", () => {
  it("sorts after every P14A2 migration and ships a dedicated phase gate", () => {
    expect(SNAPSHOT_AXES_MIGRATION_FILE > LATEST_DEPENDENCY_MIGRATION).toBe(true)
    expect(AXES_MIGRATION_FILE > SNAPSHOT_AXES_MIGRATION_FILE).toBe(true)
    expect(existsSync(SNAPSHOT_AXES_MIGRATION_PATH)).toBe(true)
    expect(existsSync(AXES_MIGRATION_PATH)).toBe(true)
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
  })

  it("keeps the public manifest exact while exposing private hashed descriptors", () => {
    expect(manifestBlock).not.toContain("'options'")
    expect(manifestBlock).not.toContain("'criteria'")
    expect(snapshotBlock).toContain("'options', v_snapshot_payload->'options'")
    expect(snapshotBlock).toContain("'criteria', v_snapshot_payload->'criteria'")
    expect(snapshotBlock).not.toContain(
      "'display_label', public._technical_configuration_option_display_label("
    )
    expect(optionAxisBlock).toContain(
      "'display_label', public._technical_configuration_option_display_label("
    )
    expect(getSnapshotSourceCore(snapshotBlock)).toBe(getSnapshotSourceCore(previousSnapshotBlock))
  })

  it("freezes exact option and criterion axis signatures and response envelopes", () => {
    const signature =
      "p_dossier_id UUID, p_baseline_version_id UUID, p_option_ids UUID[], p_criterion_ids UUID[], p_page INTEGER, p_page_size INTEGER"
    expect(optionAxisBlock.replace(/\s+/g, " ")).toContain(signature)
    expect(criterionAxisBlock.replace(/\s+/g, " ")).toContain(signature)

    for (const block of [optionAxisBlock, criterionAxisBlock]) {
      expect(getObjectKeys(block, "RETURN jsonb_build_object(", "\n  );\nEND;")).toEqual([
        "data",
        "dossier_id",
        "baseline_version_id",
        "snapshot_token",
        "ranking_snapshot_token",
        "total",
        "page",
        "page_size",
      ])
    }
  })

  it("locks exact descriptor keys, validated ordinality and bounded pages", () => {
    expect(getObjectKeys(optionAxisBlock, "jsonb_build_object(", "\n        )\n")).toEqual([
      "option_id",
      "supplier_id",
      "supplier_name",
      "display_label",
      "model",
      "manufacturer",
      "option_name",
    ])
    expect(getObjectKeys(criterionAxisBlock, "jsonb_build_object(", "\n        )\n")).toEqual([
      "group_id",
      "group_name",
      "group_order",
      "criterion_id",
      "criterion_code",
      "criterion_title",
      "requirement_text",
      "criterion_order",
    ])

    for (const [block, axis] of [
      [optionAxisBlock, "options"],
      [criterionAxisBlock, "criteria"],
    ] as const) {
      expect(block).toContain("p_page_size > 100")
      expect(block).toContain(`jsonb_array_elements(v_snapshot->'${axis}') WITH ORDINALITY`)
      expect(block).toContain("ORDER BY selected.ordinal")
      expect(block).toContain("OFFSET (p_page - 1)::BIGINT * p_page_size")
    }
  })

  it("keeps both functions read-only, guarded and least privilege", () => {
    for (const [block, functionName] of [
      [optionAxisBlock, "technical_configuration_result_export_option_axis_list"],
      [criterionAxisBlock, "technical_configuration_result_export_criterion_axis_list"],
    ] as const) {
      expect(block).toContain("LANGUAGE plpgsql")
      expect(block).toContain("STABLE")
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(block).toContain("PERFORM public._technical_configuration_require_global_user()")
      expect(block).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE)\b/i)
      const normalizedMigration = migrationSource
        .replace(/\s+/g, " ")
        .replace(/\(\s+/g, "(")
        .replace(/\s+\)/g, ")")
      expect(normalizedMigration).toContain(
        `REVOKE ALL ON FUNCTION public.${functionName}(UUID, UUID, UUID[], UUID[], INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(normalizedMigration).toContain(
        `GRANT EXECUTE ON FUNCTION public.${functionName}(UUID, UUID, UUID[], UUID[], INTEGER, INTEGER) TO authenticated, service_role;`
      )
    }
  })

  it("defines executable authorization, ordering and asymmetric-empty phase gates", () => {
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("technical_configuration_result_export_option_axis_list")
    expect(phaseGateSource).toContain("technical_configuration_result_export_criterion_axis_list")
    expect(phaseGateSource).toContain("SET LOCAL ROLE authenticated")
    expect(phaseGateSource).toContain("has_function_privilege")
    expect(phaseGateSource).toContain("permission_denied")
    expect(phaseGateSource).toContain("validation_error")
    for (const marker of [
      "raw admin preserves requested option order",
      "normal 2 x 2 axes keep exact envelopes descriptors and tokens",
      "1 x 0 preserves the option axis",
      "0 x 1 preserves the criterion axis",
      "0 x 0 preserves two empty independent axes",
      "ordered axis RPCs remain read-only",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
  })
})
