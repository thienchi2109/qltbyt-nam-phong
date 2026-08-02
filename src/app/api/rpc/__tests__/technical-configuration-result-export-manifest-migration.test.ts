import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const LATEST_DEPENDENCY_MIGRATION = "20260731102715_technical_configuration_reference_ranking.sql"
const MIGRATION_FILE = "20260802054948_technical_configuration_result_export_manifest.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_result_export_manifest_phase_gate.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getFunctionBlock(source: string, functionName: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}(`
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const end = source.indexOf("\n$$;", start + marker.length)
  const functionStart = start + "CREATE OR REPLACE ".length
  return source.slice(functionStart, end === -1 ? source.length : end)
}

function getSqlObjectKeys(source: string, startMarker: string, endMarker: string): string[] {
  const start = source.indexOf(startMarker)
  if (start === -1) return []

  const contentStart = start + startMarker.length
  const end = source.indexOf(endMarker, contentStart)
  if (end === -1) return []

  return [...source.slice(contentStart, end).matchAll(/^\s*'([a-z_]+)',/gm)].map(
    (match) => match[1]
  )
}

const migrationSource = readIfExists(MIGRATION_PATH)
const helperBlock = getFunctionBlock(
  migrationSource,
  "_technical_configuration_result_export_snapshot"
)
const manifestBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_result_export_manifest_get"
)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)

describe("P14A1 technical configuration result export manifest migration", () => {
  it("sorts after the applied P12C1 dependency", () => {
    expect(MIGRATION_FILE.localeCompare(LATEST_DEPENDENCY_MIGRATION)).toBeGreaterThan(0)
    expect(migrationSource).not.toBe("")
  })

  it("freezes the private snapshot helper and exact public manifest signatures", () => {
    expect(helperBlock).toContain(
      "_technical_configuration_result_export_snapshot(\n" +
        "  p_dossier_id UUID,\n" +
        "  p_baseline_version_id UUID,\n" +
        "  p_option_ids UUID[],\n" +
        "  p_criterion_ids UUID[]"
    )
    expect(manifestBlock).toContain(
      "technical_configuration_result_export_manifest_get(\n" +
        "  p_dossier_id UUID,\n" +
        "  p_baseline_version_id UUID,\n" +
        "  p_option_ids UUID[],\n" +
        "  p_criterion_ids UUID[]"
    )

    for (const functionBlock of [helperBlock, manifestBlock]) {
      expect(functionBlock).toContain("RETURNS JSONB")
      expect(functionBlock).toContain("LANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER")
      expect(functionBlock).toContain("SECURITY DEFINER")
      expect(functionBlock).toContain("SET search_path = public, pg_temp")
      expect(functionBlock).toContain(
        "PERFORM public._technical_configuration_require_global_user()"
      )
    }

    expect(migrationSource).toContain(
      "ALTER FUNCTION public.technical_configuration_reference_ranking_list(" +
        "UUID, UUID, INTEGER, INTEGER) STABLE;"
    )
  })

  it("rejects malformed, duplicate and foreign ordered scopes fail closed", () => {
    expect(helperBlock).toContain("p_dossier_id IS NULL OR p_baseline_version_id IS NULL")
    expect(helperBlock).toContain("cardinality(p_option_ids) = 0")
    expect(helperBlock).toContain("cardinality(p_criterion_ids) = 0")
    expect(helperBlock).toContain("array_position(p_option_ids, NULL) IS NOT NULL")
    expect(helperBlock).toContain("array_position(p_criterion_ids, NULL) IS NOT NULL")
    expect(helperBlock).toContain("count(DISTINCT requested.option_id)")
    expect(helperBlock).toContain("count(DISTINCT requested.criterion_id)")
    expect(helperBlock).toContain("RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'")
    expect(helperBlock).toContain("RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'")
    expect(helperBlock).toContain("WITH ORDINALITY")
    expect(helperBlock).toContain("ORDER BY scoped_option.ordinal")
    expect(helperBlock).toContain("ORDER BY scoped_criterion.ordinal")
  })

  it("returns only the approved public manifest shape", () => {
    expect(getSqlObjectKeys(manifestBlock, "RETURN jsonb_build_object(", "\n  );\nEND;")).toEqual([
      "data",
      "dossier",
      "baseline_version",
      "option_total",
      "criterion_total",
      "snapshot_token",
      "ranking_snapshot_token",
    ])

    expect(
      getSqlObjectKeys(
        helperBlock,
        "'dossier', jsonb_build_object(",
        "\n      ),\n      'baseline_version'"
      )
    ).toEqual(["id", "device_type_name", "name", "revision", "archived_at"])
    expect(
      getSqlObjectKeys(
        helperBlock,
        "'baseline_version', jsonb_build_object(",
        "\n      ),\n      'option_ids'"
      )
    ).toEqual(["id", "dossier_id", "version_number", "status", "revision", "locked_at"])
    expect(helperBlock).toContain("dossier.archived_at AT TIME ZONE 'UTC'")
    expect(helperBlock).toContain("version.locked_at AT TIME ZONE 'UTC'")
    expect(helperBlock.match(/AT TIME ZONE 'UTC'/g)).toHaveLength(2)
  })

  it("builds one canonical scoped digest over every workbook-visible source", () => {
    expect(helperBlock).toContain("INTO v_snapshot_data, v_snapshot_payload")
    expect(helperBlock).toContain("md5(v_snapshot_payload::TEXT)")

    for (const tableName of [
      "technical_configuration_dossiers",
      "technical_configuration_baseline_versions",
      "technical_configuration_options",
      "technical_configuration_suppliers",
      "technical_configuration_baseline_groups",
      "technical_configuration_baseline_criteria",
      "technical_configuration_comparison_sets",
      "technical_configuration_option_responses",
      "technical_configuration_option_documents",
      "technical_configuration_option_citations",
      "technical_configuration_manual_assessments",
    ]) {
      expect(helperBlock).toContain(`public.${tableName}`)
    }

    for (const fieldName of [
      "device_type_name",
      "archived_at",
      "locked_at",
      "supplier_name",
      "model",
      "manufacturer",
      "option_name",
      "group_name",
      "criterion_code",
      "criterion_title",
      "requirement_text",
      "comparison_set_id",
      "response_text",
      "supplementary_information",
      "document_name",
      "document_url",
      "page_section",
      "excerpt",
      "technical_axis",
      "evidence_axis",
      "assessment_notes",
      "assessment_revision",
    ]) {
      expect(helperBlock).toContain(`'${fieldName}'`)
    }
  })

  it("reuses the exact complete-universe P12C1 ranking token", () => {
    expect(helperBlock).toContain("public.technical_configuration_reference_ranking_list(")
    expect(helperBlock).toContain("->>'snapshot_token'")
    expect(helperBlock).toContain("'ranking_snapshot_token'")
    expect(helperBlock).not.toContain("DENSE_RANK() OVER")
  })

  it("keeps both functions read-only and grants only the intended execution paths", () => {
    for (const functionBlock of [helperBlock, manifestBlock]) {
      expect(functionBlock).not.toBe("")
      expect(functionBlock).not.toMatch(
        /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|COPY|CREATE|ALTER|DROP|CALL|PERFORM\s+public\.technical_configuration_comparison_set_get_or_create)\b/i
      )
      expect(functionBlock).not.toContain("get_or_create")
    }

    expect(migrationSource).toContain(
      "REVOKE ALL ON FUNCTION public._technical_configuration_result_export_snapshot("
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public._technical_configuration_result_export_snapshot("
    )
    expect(migrationSource).toContain(
      "REVOKE ALL ON FUNCTION public.technical_configuration_result_export_manifest_get("
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public.technical_configuration_result_export_manifest_get("
    )
  })

  it("ships a rollback-only phase gate for authorization, scope and token coverage", () => {
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")

    for (const assertionLabel of [
      "raw admin can read export manifest",
      "global can read export manifest",
      "denied role cannot read export manifest",
      "missing claims rejected",
      "helper is stable",
      "manifest is stable",
      "P12C1 ranking is stable",
      "null dossier rejected",
      "null baseline rejected",
      "dossier baseline mismatch rejected",
      "empty option scope rejected",
      "null option element rejected",
      "duplicate option scope rejected",
      "foreign option scope rejected",
      "empty criterion scope rejected",
      "null criterion element rejected",
      "duplicate criterion scope rejected",
      "foreign criterion scope rejected",
      "ranking token matches P12C1",
      "manifest timestamps are UTC canonical",
      "manifest timestamp representation ignores session timezone",
      "full token changes with dossier name",
      "full token changes with baseline lock date",
      "full token changes with option identity",
      "full token changes with supplier identity",
      "full token changes with criterion requirement",
      "full token changes with response text",
      "full token changes with supplementary information",
      "full token changes with document metadata",
      "full token changes with citation excerpt",
      "full token changes with manual assessment notes",
      "full token changes with manual assessment technical axis",
      "missing rows remain absent",
      "manifest read preserves revisions and audit metadata",
    ]) {
      expect(phaseGateSource).toContain(assertionLabel)
    }
  })

  it("documents forward-only rollback without editing applied history", () => {
    expect(migrationSource).toContain(
      "-- Rollback (forward-only; never edit applied history): ship a separately reviewed migration with:"
    )
    expect(migrationSource).toContain(
      "DROP FUNCTION IF EXISTS public.technical_configuration_result_export_manifest_get("
    )
    expect(migrationSource).toContain(
      "DROP FUNCTION IF EXISTS public._technical_configuration_result_export_snapshot("
    )
    expect(migrationSource).toContain(
      "-- ALTER FUNCTION public.technical_configuration_reference_ranking_list(" +
        "UUID, UUID, INTEGER, INTEGER) VOLATILE;"
    )
  })
})
