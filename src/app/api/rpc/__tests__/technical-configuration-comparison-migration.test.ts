import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260727090000_technical_configuration_comparison_reads.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_comparison_phase_gate.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function countLines(source: string): number {
  return source === "" ? 0 : source.trimEnd().split("\n").length
}

function getFunctionBlock(source: string, functionName: string): string {
  const functions = [
    ...source.matchAll(/^CREATE(?: OR REPLACE)? FUNCTION public\.([a-z0-9_]+)\(/gim),
  ]
  const index = functions.findIndex((match) => match[1] === functionName)
  if (index === -1) return ""

  const start = functions[index].index ?? 0
  const end = functions[index + 1]?.index ?? source.length
  return source.slice(start, end)
}

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const comparisonFunctionBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_comparison_get"
)

describe("P10A1 technical configuration comparison read migration", () => {
  it("uses one ordered primary RPC migration after every referenced table contract", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(migrationSource).not.toBe("")
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_comparison_reads"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(
      MIGRATION_FILE.localeCompare("20260726020000_technical_configuration_option_evidence.sql")
    ).toBeGreaterThan(0)
  })

  it("freezes the bounded four-argument RPC and explicit execute grants", () => {
    expect(comparisonFunctionBlock).not.toBe("")
    expect(migrationSource).toContain(
      "FUNCTION public.technical_configuration_comparison_get(\n" +
        "  p_baseline_version_id UUID,\n" +
        "  p_option_ids UUID[],\n" +
        "  p_page INTEGER,\n" +
        "  p_page_size INTEGER\n" +
        ")"
    )
    expect(comparisonFunctionBlock).toContain("RETURNS JSONB")
    expect(comparisonFunctionBlock).toContain("SECURITY DEFINER")
    expect(comparisonFunctionBlock).toContain("SET search_path = public, pg_temp")
    expect(migrationSource).toContain(
      "REVOKE ALL ON FUNCTION public.technical_configuration_comparison_get(\n" +
        "  UUID, UUID[], INTEGER, INTEGER\n" +
        ") FROM PUBLIC, anon, authenticated, service_role"
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public.technical_configuration_comparison_get(\n" +
        "  UUID, UUID[], INTEGER, INTEGER\n" +
        ") TO authenticated"
    )
    expect(migrationSource).not.toContain(") TO authenticated, service_role")
  })

  it("fails closed through the raw admin/global guard and exact error contract", () => {
    expect(comparisonFunctionBlock).toContain(
      "PERFORM public._technical_configuration_require_global_user()"
    )
    expect(comparisonFunctionBlock).toContain(
      "RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'"
    )
    expect(comparisonFunctionBlock).toContain("RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'")
    expect(comparisonFunctionBlock).not.toContain("don_vi")
    expect(comparisonFunctionBlock).not.toContain(
      "public._technical_configuration_require_editable_dossier("
    )
    expect(comparisonFunctionBlock).not.toContain("archived_dossier")
    expect(comparisonFunctionBlock).not.toContain("locked_version")
  })

  it("validates nullable bounds, unique option IDs, and exact dossier ownership", () => {
    for (const marker of [
      "p_baseline_version_id IS NULL",
      "p_option_ids IS NULL",
      "array_length(p_option_ids, 1)",
      "array_position(p_option_ids, NULL)",
      "p_page IS NULL OR p_page < 1",
      "p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100",
      "COUNT(DISTINCT requested.option_id)",
      "FROM public.technical_configuration_baseline_versions v",
      "o.dossier_id = v_dossier_id",
    ]) {
      expect(comparisonFunctionBlock).toContain(marker)
    }
    expect(comparisonFunctionBlock).toMatch(
      /(?:FROM|JOIN) public\.technical_configuration_options o/
    )
  })

  it("pages criteria first and preserves selected-option ordinality", () => {
    expect(comparisonFunctionBlock).toContain(
      "unnest(p_option_ids) WITH ORDINALITY AS requested(option_id, ordinal)"
    )
    expect(comparisonFunctionBlock).toContain("paged_criteria AS")
    expect(comparisonFunctionBlock).toContain("baseline_evidence AS")
    expect(comparisonFunctionBlock).toContain("option_evidence AS")
    expect(comparisonFunctionBlock).toContain("option_values AS")
    expect(comparisonFunctionBlock).toContain("ORDER BY selected.ordinal")
    expect(comparisonFunctionBlock).toContain(
      "ORDER BY paged.group_sort_order, paged.criterion_sort_order, paged.criterion_id"
    )
    expect(comparisonFunctionBlock).not.toMatch(/\bSELECT\s+\*/i)
  })

  it("returns the exact fixed nested response and evidence summaries", () => {
    for (const mapping of [
      "'dossier', jsonb_build_object(",
      "'id', d.id",
      "'device_type_name', d.device_type_name",
      "'name', d.name",
      "'revision', d.revision",
      "'archived_at', d.archived_at",
      "'baseline_version', jsonb_build_object(",
      "'dossier_id', v.dossier_id",
      "'version_number', v.version_number",
      "'status', v.status",
      "'options',",
      "'supplier_id', selected.supplier_id",
      "'supplier_name', selected.supplier_name",
      "'model', selected.model",
      "'manufacturer', selected.manufacturer",
      "'option_name', selected.option_name",
      "'display_label', selected.display_label",
      "'criteria',",
      "'group', jsonb_build_object(",
      "'criterion', jsonb_build_object(",
      "'criterion_code', paged.criterion_code",
      "'title', paged.title",
      "'requirement_text', paged.requirement_text",
      "'baseline_evidence', jsonb_build_object(",
      "'option_values',",
      "'option_id', values.option_id",
      "'comparison_set_id', values.comparison_set_id",
      "'response', values.response",
      "'evidence', values.evidence",
      "'total', v_total",
      "'page', p_page",
      "'page_size', p_page_size",
    ]) {
      expect(comparisonFunctionBlock).toContain(mapping)
    }

    expect(comparisonFunctionBlock.match(/'document_count'/g)).toHaveLength(2)
    expect(comparisonFunctionBlock.match(/'citation_count'/g)).toHaveLength(2)
    expect(comparisonFunctionBlock.match(/'has_evidence'/g)).toHaveLength(2)
    expect(comparisonFunctionBlock).toContain("'response_text', response.response_text")
    expect(comparisonFunctionBlock).toContain(
      "'supplementary_information', response.supplementary_information"
    )
    expect(comparisonFunctionBlock).not.toContain("reference_product")
    expect(comparisonFunctionBlock).not.toContain("'citations'")
    expect(comparisonFunctionBlock).not.toContain("'documents'")
  })

  it("is side-effect free and keeps the primary migration within 450 lines", () => {
    expect(comparisonFunctionBlock).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(comparisonFunctionBlock).not.toMatch(/\bUPDATE\b/i)
    expect(comparisonFunctionBlock).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(comparisonFunctionBlock).not.toMatch(/\bMERGE\s+INTO\b/i)
    expect(comparisonFunctionBlock).not.toMatch(/\bTRUNCATE\b/i)
    expect(comparisonFunctionBlock).not.toMatch(
      /\bFOR\s+(?:KEY\s+SHARE|NO\s+KEY\s+UPDATE|SHARE|UPDATE)\b/i
    )
    expect(countLines(migrationSource)).toBeLessThanOrEqual(450)
  })

  it("ships the rollback-only SQL behavior and inner-query performance gate", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    expect(phaseGateSource).not.toMatch(/\bCOMMIT\s*;/i)
    expect(phaseGateSource.trimEnd()).toMatch(/\bROLLBACK\s*;$/i)
    expect(
      phaseGateSource.match(
        /FROM public\.technical_configuration_comparison_sets cs\s+WHERE cs\.dossier_id = v_dossier_id/g
      ) ?? []
    ).toHaveLength(2)
    expect(
      phaseGateSource.match(
        /FROM public\.technical_configuration_option_responses r\s+WHERE r\.baseline_version_id = v_baseline_version_id/g
      ) ?? []
    ).toHaveLength(2)
    expect(phaseGateSource).toContain("        LIMIT 100\n        OFFSET 100")
    expect(phaseGateSource).toContain("        JOIN option_evidence evidence")
    expect(phaseGateSource).toContain(
      "NOT jsonb_path_exists(\n" +
        "      v_plan,\n" +
        '      \'$.**."Parent Relationship" ? (@ == "SubPlan")\'\n' +
        "    )"
    )
    expect(phaseGateSource).not.toContain("v_plan::TEXT NOT LIKE")

    for (const marker of [
      "missing role rejected",
      "empty user id rejected",
      "disallowed role rejected",
      "raw admin accepted",
      "raw global accepted",
      "null baseline rejected",
      "null options rejected",
      "empty options rejected",
      "duplicate options rejected",
      "nine options rejected",
      "null page rejected",
      "null page size rejected",
      "missing baseline rejected",
      "missing option rejected",
      "mixed dossier rejected",
      "options preserve request order",
      "criteria pagination returns exact total",
      "ninth option succeeds separately",
      "missing comparison set returns null response",
      "baseline evidence isolated",
      "option evidence isolated",
      "supplementary information remains separate",
      "archived dossier readable",
      "locked baseline readable",
      "read preserves comparison set count",
      "read preserves dossier revision",
      "read preserves audit metadata",
      "500 criteria 50 options 8 selected",
      "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)",
      "P10A1 inner query plan: %",
      "inner plan remains page and selection bounded",
      "authenticated executes comparison RPC",
      "service role cannot execute comparison RPC",
      "anon cannot execute comparison RPC",
      "fixed search_path",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
  })
})
