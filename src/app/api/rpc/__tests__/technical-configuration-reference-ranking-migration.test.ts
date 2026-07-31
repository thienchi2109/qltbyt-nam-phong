import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const LATEST_DEPENDENCY_MIGRATION =
  "20260730151948_technical_configuration_evaluation_criteria_filter.sql"
const MIGRATION_FILE = "20260731102715_technical_configuration_reference_ranking.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_reference_ranking_phase_gate.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getFunctionBlock(source: string): string {
  const marker = "FUNCTION public.technical_configuration_reference_ranking_list("
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const end = source.indexOf("\n$$;", start + marker.length)
  return source.slice(start, end === -1 ? source.length : end)
}

function getSqlObjectKeys(source: string, startMarker: string, endMarker: string): string[] {
  const start = source.indexOf(startMarker)
  if (start === -1) return []

  const end = source.indexOf(endMarker, start + startMarker.length)
  if (end === -1) return []

  return [...source.slice(start, end).matchAll(/'([a-z_]+)'/g)].map((match) => match[1])
}

const migrationSource = readIfExists(MIGRATION_PATH)
const functionBlock = getFunctionBlock(migrationSource)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)

describe("P12C1 technical configuration reference ranking migration", () => {
  it("sorts after the applied P12B2 dependency", () => {
    expect(MIGRATION_FILE.localeCompare(LATEST_DEPENDENCY_MIGRATION)).toBeGreaterThan(0)
    expect(migrationSource).not.toBe("")
  })

  it("freezes one guarded read-only RPC with bounded 1-based pagination", () => {
    expect(functionBlock).toContain(
      "technical_configuration_reference_ranking_list(\n" +
        "  p_dossier_id UUID,\n" +
        "  p_baseline_version_id UUID,\n" +
        "  p_page INTEGER,\n" +
        "  p_page_size INTEGER"
    )
    expect(functionBlock).toContain("RETURNS JSONB")
    expect(functionBlock).toContain("SECURITY DEFINER")
    expect(functionBlock).toContain("SET search_path = public, pg_temp")
    expect(functionBlock).toContain("PERFORM public._technical_configuration_require_global_user()")
    expect(functionBlock).toContain("p_page IS NULL OR p_page < 1")
    expect(functionBlock).toContain("p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100")
    expect(functionBlock).toContain("RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'")
    expect(functionBlock).toContain("RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'")
    expect(functionBlock).toContain("LIMIT p_page_size")
    expect(functionBlock).toMatch(/OFFSET \(p_page - 1\)::BIGINT \* p_page_size/)
    expect(migrationSource).toContain(
      "REVOKE ALL ON FUNCTION public.technical_configuration_reference_ranking_list("
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public.technical_configuration_reference_ranking_list("
    )
  })

  it("ranks the complete option and criterion universe from persisted manual axes", () => {
    expect(functionBlock).toMatch(
      /FROM public\.technical_configuration_options option_row[\s\S]*LEFT JOIN canonical_criteria criterion ON TRUE/
    )
    expect(functionBlock).toContain("criterion.criterion_id IS NULL THEN 0")
    expect(functionBlock).toMatch(/LEFT JOIN public\.technical_configuration_comparison_sets/)
    expect(functionBlock).toMatch(/LEFT JOIN public\.technical_configuration_manual_assessments/)
    expect(functionBlock).toContain("assessment.technical_axis = 'not_applicable' THEN 0")
    expect(functionBlock).toMatch(
      /assessment\.technical_axis IS NULL[\s\S]*assessment\.evidence_axis IS NULL/
    )
    expect(functionBlock).toContain("COUNT(*) FILTER (WHERE scored.derived_status = 'fails')")
    expect(functionBlock).toContain(
      "COUNT(*) FILTER (WHERE scored.derived_status = 'insufficient_evidence')"
    )
    expect(functionBlock).toContain("COUNT(*) FILTER (WHERE scored.derived_status = 'exceeds')")
    expect(functionBlock).toContain("DENSE_RANK() OVER")
    expect(functionBlock).toMatch(
      /ORDER BY[\s\S]*failed_count[\s\S]*insufficient_evidence_count[\s\S]*exceeds_count DESC/
    )
    expect(functionBlock).toContain("WHERE aggregated.incomplete_criterion_count = 0")
  })

  it("computes ranks before pagination and preserves canonical option order inside ties", () => {
    const rankIndex = functionBlock.indexOf("DENSE_RANK() OVER")
    const pageIndex = functionBlock.indexOf("LIMIT p_page_size")

    expect(rankIndex).toBeGreaterThan(-1)
    expect(pageIndex).toBeGreaterThan(rankIndex)
    expect(functionBlock).toContain("supplier.normalized_name AS supplier_normalized_name")
    expect(functionBlock).toContain(
      "COALESCE(option_row.model, option_row.option_name) AS identity_label"
    )
    expect(functionBlock).toMatch(
      /ORDER BY[\s\S]*ranked\.rank[\s\S]*ranked\.supplier_normalized_name[\s\S]*ranked\.identity_label[\s\S]*ranked\.option_id/
    )
  })

  it("returns only the frozen ranking wire fields and an opaque snapshot token", () => {
    expect(
      getSqlObjectKeys(
        functionBlock,
        "SELECT jsonb_agg(\n          jsonb_build_object(",
        "\n          ORDER BY"
      )
    ).toEqual([
      "option_id",
      "supplier_id",
      "supplier_name",
      "display_label",
      "eligibility",
      "incomplete_criterion_count",
      "failed_count",
      "insufficient_evidence_count",
      "exceeds_count",
      "rank",
    ])
    expect(getSqlObjectKeys(functionBlock, "RETURN jsonb_build_object(", "\n  );\nEND;")).toEqual([
      "data",
      "dossier_id",
      "baseline_version_id",
      "snapshot_token",
      "total",
      "page",
      "page_size",
    ])

    expect(functionBlock).toContain("md5(")
    expect(functionBlock).toContain("assessment.revision")
    expect(functionBlock).toContain("comparison_set.updated_at")
    expect(functionBlock).toMatch(
      /to_char\(\s*snapshot_option\.option_updated_at AT TIME ZONE 'UTC',\s*'YYYY-MM-DD"T"HH24:MI:SS\.US'\s*\)/
    )
    expect(functionBlock).toMatch(
      /to_char\(\s*snapshot_option\.supplier_updated_at AT TIME ZONE 'UTC',\s*'YYYY-MM-DD"T"HH24:MI:SS\.US'\s*\)/
    )
    expect(functionBlock).toMatch(
      /to_char\(\s*comparison_set\.updated_at AT TIME ZONE 'UTC',\s*'YYYY-MM-DD"T"HH24:MI:SS\.US'\s*\)/
    )
    expect(functionBlock).not.toMatch(
      /(?:snapshot_option\.(?:option_updated_at|supplier_updated_at)|comparison_set\.updated_at)::TEXT/
    )
    expect(functionBlock).not.toMatch(
      /reference_product|response_text|supplementary_information|option_document|option_citation|persisted_rank|award|machine|ai_/i
    )
  })

  it("ships a rollback-only phase gate for dense rank and complete-page safety", () => {
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("dense rank returns 1, 1, 2")
    expect(phaseGateSource).toContain("more than 100 options exhausts across pages")
    expect(phaseGateSource).toContain("more than 100 criteria remains complete")
    expect(phaseGateSource).toContain("missing comparison sets stay incomplete")
    expect(phaseGateSource).toContain("zero-criterion baseline preserves option universe")
    expect(phaseGateSource).toContain("fails with null evidence stays incomplete")
    expect(phaseGateSource).toContain("unclear with null evidence stays incomplete")
    expect(phaseGateSource).toContain("cross dossier baseline rejected")
    expect(phaseGateSource).toContain("page size zero rejected")
    expect(phaseGateSource).toContain("page size 101 rejected")
    expect(phaseGateSource).toContain("page beyond exhaustion is empty")
    expect(phaseGateSource).toContain("snapshot token ignores session timestamp formatting")
    expect(phaseGateSource).toContain("raw admin can read ranking")
    expect(phaseGateSource).toContain("denied role cannot read ranking")
  })

  it("documents forward-only rollback without editing applied history", () => {
    expect(migrationSource).toContain(
      "-- Rollback (forward-only; never edit applied history): ship a separately reviewed migration with:"
    )
    expect(migrationSource).toContain(
      "DROP FUNCTION IF EXISTS public.technical_configuration_reference_ranking_list("
    )
  })
})
