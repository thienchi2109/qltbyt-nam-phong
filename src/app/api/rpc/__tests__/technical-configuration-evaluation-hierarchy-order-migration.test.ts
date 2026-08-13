import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATION_FILE = "20260812140500_technical_configuration_evaluation_hierarchy_order.sql"
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATES_DIR = path.resolve(process.cwd(), "supabase/tests")
const BEHAVIOR_PHASE_GATE_FILE = "technical_configuration_evaluation_hierarchy_order_phase_gate.sql"
const PHASE_GATE_FILES = [
  BEHAVIOR_PHASE_GATE_FILE,
  "technical_configuration_evaluation_hierarchy_order_security_phase_gate.sql",
] as const
const EVALUATION_LIST_DEFINITION =
  /CREATE OR REPLACE FUNCTION public\.technical_configuration_evaluation_criteria_list\s*\(/

function compactSql(source: string): string {
  return source.replace(/\s+/g, " ").trim()
}

function getMigrationSource(): string {
  expect(existsSync(MIGRATION_PATH), `${MIGRATION_FILE} must exist`).toBe(true)
  return readFileSync(MIGRATION_PATH, "utf8")
}

function getEvaluationListRedefinitionFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) =>
      EVALUATION_LIST_DEFINITION.test(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
    )
    .sort()
}

function getFunctionBlock(source: string): string {
  const start = source.indexOf(
    "CREATE OR REPLACE FUNCTION public.technical_configuration_evaluation_criteria_list("
  )
  expect(start).toBeGreaterThanOrEqual(0)

  const end = source.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end + 4)
}

describe("technical configuration evaluation P5C0 hierarchy order migration", () => {
  it("keeps both rollback-only phase gates discoverable and below the hard ceiling", () => {
    const discoveredPhaseGates = readdirSync(PHASE_GATES_DIR)
      .filter(
        (file) =>
          file.startsWith("technical_configuration_evaluation_hierarchy_order") &&
          file.endsWith("_phase_gate.sql")
      )
      .sort()

    expect(discoveredPhaseGates).toEqual([...PHASE_GATE_FILES])

    for (const file of PHASE_GATE_FILES) {
      const source = readFileSync(path.join(PHASE_GATES_DIR, file), "utf8")
      expect(source.split("\n").length).toBeLessThanOrEqual(450)
      expect(source).toMatch(/\bBEGIN;/)
      expect(source).toMatch(/\bROLLBACK;\s*$/)
    }
  })

  it("uses an interleaved fixture that cannot pass through legacy flat ordering", () => {
    const source = compactSql(
      readFileSync(path.join(PHASE_GATES_DIR, BEHAVIOR_PHASE_GATE_FILE), "utf8")
    )

    expect(source).toContain(
      "CASE WHEN series = 101 THEN NULL WHEN series % 2 = 1 THEN v_subgroup_1_id ELSE v_subgroup_2_id END"
    )
    expect(source).toContain("P5C0 criterion ' || series, series, v_user_id")
    expect(source).toContain("subgroup_id IS NULL AND sort_order = 101")
    expect(source).toContain("subgroup_id = v_subgroup_1_id AND sort_order = 97")
    expect(source).toContain("subgroup_id = v_subgroup_1_id AND sort_order = 99")
    expect(source).toContain("subgroup_id = v_subgroup_2_id AND sort_order = 98")
    expect(source).toContain("subgroup_id = v_subgroup_2_id AND sort_order = 100")
  })

  it("ships after the latest local redefinition and only replaces the evaluation list RPC", () => {
    const source = getMigrationSource()
    const redefinitionFiles = getEvaluationListRedefinitionFiles()
    const priorRedefinitionFiles = redefinitionFiles.filter((file) => file !== MIGRATION_FILE)
    const latestPriorRedefinition = priorRedefinitionFiles.at(-1)
    const redefinedFunctions = [
      ...source.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/g),
    ].map((match) => match[1])

    expect(latestPriorRedefinition).toBeDefined()
    expect(redefinitionFiles.at(-1)).toBe(MIGRATION_FILE)
    expect(MIGRATION_FILE > (latestPriorRedefinition ?? "")).toBe(true)
    expect(redefinedFunctions).toEqual(["technical_configuration_evaluation_criteria_list"])
    expect(source).not.toMatch(
      /\b(?:CREATE TABLE|ALTER TABLE|CREATE INDEX|INSERT INTO|UPDATE public\.|DELETE FROM)\b/
    )
    expect(source).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.technical_configuration_(?:comparison|result_export)[a-z0-9_]*/
    )
    expect(source).toContain("Rollback (forward-compatible; never edit applied history)")
  })

  it("preserves the public contract, authorization, validation, and least-privilege grants", () => {
    const source = getMigrationSource()
    const block = getFunctionBlock(source)
    const compactBlock = compactSql(block)
    const compact = compactSql(source)
    const headerEnd = compactBlock.indexOf(" LANGUAGE plpgsql")

    expect(compactBlock.slice(0, headerEnd)).toBe(
      "CREATE OR REPLACE FUNCTION public.technical_configuration_evaluation_criteria_list( p_option_id UUID, p_baseline_version_id UUID, p_status_filter TEXT, p_page INTEGER, p_page_size INTEGER ) RETURNS JSONB"
    )
    expect(block).toContain("LANGUAGE plpgsql")
    expect(block).toContain("SECURITY DEFINER")
    expect(block).toContain("SET search_path = public, pg_temp")
    expect(block).toContain("PERFORM public._technical_configuration_require_global_user()")
    expect(block).toContain("v_comparison_page_size CONSTANT INTEGER := 50")
    expect(block).toContain("p_page_size > 100")
    expect(block).toContain(
      "p_status_filter NOT IN ('all', 'not_evaluated', 'fails', 'insufficient_evidence')"
    )
    expect(block).toContain("RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'")
    expect(block).toContain("RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'")

    expect(compact).toContain(
      "REVOKE ALL ON FUNCTION public.technical_configuration_evaluation_criteria_list( UUID, UUID, TEXT, INTEGER, INTEGER ) FROM PUBLIC, anon, authenticated, service_role"
    )
    expect(compact).toContain(
      "GRANT EXECUTE ON FUNCTION public.technical_configuration_evaluation_criteria_list( UUID, UUID, TEXT, INTEGER, INTEGER ) TO authenticated, service_role"
    )
  })

  it("computes the hierarchy-aware canonical index before filtering", () => {
    const block = compactSql(getFunctionBlock(getMigrationSource()))
    const canonicalStart = block.indexOf("canonical_criteria AS MATERIALIZED")
    const filteredStart = block.indexOf("filtered_criteria AS MATERIALIZED")
    const pagedStart = block.indexOf("paged_criteria AS")
    const statusFilter = block.indexOf("WHERE p_status_filter = 'all'", filteredStart)

    expect(canonicalStart).toBeGreaterThanOrEqual(0)
    expect(filteredStart).toBeGreaterThan(canonicalStart)
    expect(pagedStart).toBeGreaterThan(filteredStart)
    expect(statusFilter).toBeGreaterThan(filteredStart)
    expect(statusFilter).toBeLessThan(pagedStart)

    expect(block).toContain(
      "LEFT JOIN public.technical_configuration_baseline_subgroups subgroup_row ON subgroup_row.id = criterion.subgroup_id AND subgroup_row.group_id = criterion.group_id AND subgroup_row.baseline_version_id = criterion.baseline_version_id"
    )
    expect(block).toContain(
      "ORDER BY group_row.sort_order, group_row.id, CASE WHEN criterion.subgroup_id IS NULL THEN 0 ELSE 1 END, CASE WHEN criterion.subgroup_id IS NULL THEN 0 ELSE COALESCE(subgroup_row.sort_order, 2147483647) END, CASE WHEN criterion.subgroup_id IS NULL THEN '00000000-0000-0000-0000-000000000000'::UUID ELSE COALESCE( subgroup_row.id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::UUID ) END, criterion.sort_order, criterion.id"
    )
    expect(block).toContain(
      "row_number() OVER ( ORDER BY group_row.sort_order, group_row.id, CASE WHEN criterion.subgroup_id IS NULL THEN 0 ELSE 1 END"
    )
    expect(block).toContain(
      "((canonical.canonical_index - 1) / v_comparison_page_size) + 1 AS canonical_page"
    )
  })

  it("orders transport pagination and JSON aggregation by canonical index", () => {
    const block = compactSql(getFunctionBlock(getMigrationSource()))
    const pagedStart = block.indexOf("paged_criteria AS")
    const transportOrder = block.indexOf("ORDER BY filtered.canonical_index", pagedStart)
    const limit = block.indexOf("LIMIT p_page_size", pagedStart)
    const offset = block.indexOf("OFFSET (p_page - 1)::BIGINT * p_page_size", pagedStart)
    const jsonOrder = block.indexOf("ORDER BY paged.canonical_index", offset)

    expect(transportOrder).toBeGreaterThan(pagedStart)
    expect(limit).toBeGreaterThan(transportOrder)
    expect(offset).toBeGreaterThan(limit)
    expect(jsonOrder).toBeGreaterThan(offset)
  })

  it("preserves assessment derivation and the response JSON shape", () => {
    const block = compactSql(getFunctionBlock(getMigrationSource()))

    expect(block).toContain(
      "LEFT JOIN public.technical_configuration_comparison_sets comparison_set ON comparison_set.option_id = p_option_id AND comparison_set.baseline_version_id = p_baseline_version_id"
    )
    expect(block).toContain(
      "LEFT JOIN public.technical_configuration_manual_assessments assessment ON assessment.comparison_set_id = comparison_set.id AND assessment.baseline_version_id = criterion.baseline_version_id AND assessment.criterion_id = criterion.id"
    )
    expect(block).toContain("WHEN assessment.technical_axis IS NULL THEN 'not_evaluated'")
    expect(block).toContain(
      "WHEN assessment.technical_axis = 'not_applicable' THEN 'not_applicable'"
    )
    expect(block).toContain("WHEN assessment.technical_axis = 'fails' THEN 'fails'")
    expect(block).toContain("WHEN assessment.technical_axis = 'unclear' THEN 'unclear'")
    expect(block).toContain(
      "WHEN assessment.evidence_axis IN ('partial', 'missing') THEN 'insufficient_evidence'"
    )
    expect(block).toContain(
      "jsonb_build_object( 'criterion_id', paged.criterion_id, 'canonical_index', paged.canonical_index, 'canonical_page', paged.canonical_page )"
    )
    expect(block).toContain(
      "RETURN jsonb_build_object( 'data', v_data, 'total', v_total, 'page', p_page, 'page_size', p_page_size )"
    )
  })
})
