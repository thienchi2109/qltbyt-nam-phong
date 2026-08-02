import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const LATEST_DEPENDENCY_MIGRATION =
  "20260802054948_technical_configuration_result_export_manifest.sql"
const RANKING_MIGRATION_FILE =
  "20260802092214_technical_configuration_result_export_ranking_source.sql"
const SNAPSHOT_MIGRATION_FILE =
  "20260802092215_technical_configuration_result_export_snapshot_token_source.sql"
const MATRIX_MIGRATION_FILE = "20260802092216_technical_configuration_result_export_matrix_page.sql"
const RANKING_MIGRATION_PATH = path.join(MIGRATIONS_DIR, RANKING_MIGRATION_FILE)
const SNAPSHOT_MIGRATION_PATH = path.join(MIGRATIONS_DIR, SNAPSHOT_MIGRATION_FILE)
const MATRIX_MIGRATION_PATH = path.join(MIGRATIONS_DIR, MATRIX_MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_result_export_pages_phase_gate.sql"
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

const rankingMigrationSource = readIfExists(RANKING_MIGRATION_PATH)
const snapshotMigrationSource = readIfExists(SNAPSHOT_MIGRATION_PATH)
const matrixMigrationSource = readIfExists(MATRIX_MIGRATION_PATH)
const migrationSource = `${rankingMigrationSource}\n${snapshotMigrationSource}\n${matrixMigrationSource}`
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const optionDisplayLabelBlock = getFunctionBlock(
  rankingMigrationSource,
  "_technical_configuration_option_display_label"
)
const derivedStatusBlock = getFunctionBlock(
  rankingMigrationSource,
  "_technical_configuration_derived_status"
)
const rankingSnapshotBlock = getFunctionBlock(
  migrationSource,
  "_technical_configuration_reference_ranking_snapshot"
)
const referenceRankingBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_reference_ranking_list"
)
const exportRankingBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_result_export_ranking_list"
)
const exportSnapshotBlock = getFunctionBlock(
  snapshotMigrationSource,
  "_technical_configuration_result_export_snapshot"
)
const exportMatrixBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_result_export_matrix_list"
)

const rankingResponseKeys = [
  "data",
  "dossier_id",
  "baseline_version_id",
  "snapshot_token",
  "ranking_snapshot_token",
  "total",
  "page",
  "page_size",
]

describe("P14A2 technical configuration result export page migration", () => {
  it("sorts all bounded migrations after P14A1 and ships one rollback-only phase gate", () => {
    expect(RANKING_MIGRATION_FILE.localeCompare(LATEST_DEPENDENCY_MIGRATION)).toBeGreaterThan(0)
    expect(SNAPSHOT_MIGRATION_FILE.localeCompare(RANKING_MIGRATION_FILE)).toBeGreaterThan(0)
    expect(MATRIX_MIGRATION_FILE.localeCompare(SNAPSHOT_MIGRATION_FILE)).toBeGreaterThan(0)
    expect(rankingMigrationSource).not.toBe("")
    expect(snapshotMigrationSource).not.toBe("")
    expect(matrixMigrationSource).not.toBe("")
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).not.toContain("COMMIT;")
  })

  it("freezes the private ranking source and both exact public page signatures", () => {
    expect(rankingSnapshotBlock).toContain(
      "_technical_configuration_reference_ranking_snapshot(\n" +
        "  p_dossier_id UUID,\n" +
        "  p_baseline_version_id UUID"
    )
    for (const functionBlock of [exportRankingBlock, exportMatrixBlock]) {
      expect(functionBlock).toContain(
        "  p_dossier_id UUID,\n" +
          "  p_baseline_version_id UUID,\n" +
          "  p_option_ids UUID[],\n" +
          "  p_criterion_ids UUID[],\n" +
          "  p_page INTEGER,\n" +
          "  p_page_size INTEGER"
      )
      expect(functionBlock).toContain("RETURNS JSONB")
      expect(functionBlock).toContain("LANGUAGE plpgsql\nSTABLE\nSECURITY DEFINER")
      expect(functionBlock).toContain("SET search_path = public, pg_temp")
      expect(functionBlock).toContain(
        "PERFORM public._technical_configuration_require_global_user()"
      )
      expect(functionBlock).toContain("public._technical_configuration_result_export_snapshot(")
    }
  })

  it("extracts P12C1 ranking semantics once and delegates both public ranking surfaces", () => {
    expect(rankingSnapshotBlock).toContain("DENSE_RANK() OVER")
    expect(rankingSnapshotBlock).toContain(
      "COUNT(*) FILTER (WHERE scored.derived_status = 'fails')"
    )
    expect(rankingSnapshotBlock).toContain(
      "COUNT(*) FILTER (WHERE scored.derived_status = 'insufficient_evidence')"
    )
    expect(rankingSnapshotBlock).toContain(
      "COUNT(*) FILTER (WHERE scored.derived_status = 'exceeds')"
    )
    expect(referenceRankingBlock).toContain(
      "public._technical_configuration_reference_ranking_snapshot("
    )
    expect(exportRankingBlock).toContain(
      "public._technical_configuration_reference_ranking_snapshot("
    )
    expect(migrationSource.match(/DENSE_RANK\(\) OVER/g)).toHaveLength(1)
    expect(referenceRankingBlock).not.toContain("public.technical_configuration_manual_assessments")
    expect(exportRankingBlock).not.toContain("public.technical_configuration_manual_assessments")
  })

  it("shares option labels and derived statuses across ranking and matrix surfaces", () => {
    expect(optionDisplayLabelBlock).toContain(
      "_technical_configuration_option_display_label(\n" +
        "  p_supplier_name TEXT,\n" +
        "  p_model TEXT,\n" +
        "  p_option_name TEXT"
    )
    expect(optionDisplayLabelBlock).toContain("LANGUAGE sql\nIMMUTABLE")
    expect(derivedStatusBlock).toContain(
      "_technical_configuration_derived_status(\n" +
        "  p_technical_axis TEXT,\n" +
        "  p_evidence_axis TEXT"
    )
    expect(derivedStatusBlock).toContain("LANGUAGE sql\nIMMUTABLE")
    for (const marker of [
      "THEN 'not_evaluated'",
      "THEN 'not_applicable'",
      "THEN 'fails'",
      "THEN 'unclear'",
      "THEN 'insufficient_evidence'",
      "ELSE p_technical_axis",
    ]) {
      expect(derivedStatusBlock).toContain(marker)
    }
    for (const functionBlock of [rankingSnapshotBlock, exportMatrixBlock]) {
      expect(functionBlock).toContain("public._technical_configuration_option_display_label(")
      expect(functionBlock).toContain("public._technical_configuration_derived_status(")
      expect(functionBlock).not.toContain("supplier.name || ' ' || chr(183)")
    }
    expect(rankingSnapshotBlock).toContain("WHEN criterion.criterion_id IS NULL THEN NULL")
    expect(exportMatrixBlock).not.toContain("WHEN assessment.technical_axis")
  })

  it("reuses the exact ranking token without running the paged P12C1 RPC inside the snapshot", () => {
    expect(exportSnapshotBlock).toMatch(
      /v_ranking_snapshot_token :=\s+public\._technical_configuration_reference_ranking_token\(/
    )
    expect(exportSnapshotBlock).toContain("'ranking_snapshot_token', v_ranking_snapshot_token")
    expect(exportSnapshotBlock).not.toContain(
      "public.technical_configuration_reference_ranking_list("
    )
  })

  it("locks bounded scoped ranking pages with exact P12C1 row keys and repeated tokens", () => {
    expect(exportRankingBlock).toContain(
      "p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100"
    )
    expect(exportRankingBlock).toContain("WITH ORDINALITY")
    expect(exportRankingBlock).toContain(
      "JOIN selected_options selected ON selected.option_id = ranking.option_id"
    )
    expect(exportRankingBlock).toMatch(/OFFSET \(p_page - 1\)::BIGINT \* p_page_size/)
    expect(getObjectKeys(exportRankingBlock, "RETURN jsonb_build_object(", "\n  );\nEND;")).toEqual(
      rankingResponseKeys
    )
    expect(
      getObjectKeys(
        rankingSnapshotBlock,
        "jsonb_build_object(\n          'option_id'",
        "\n        )\n  FROM aggregated"
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
  })

  it("locks flattened matrix pages, sparse output and the seven-status conclusion", () => {
    expect(exportMatrixBlock).toContain(
      "p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 1000"
    )
    expect(exportMatrixBlock).toContain("WITH ORDINALITY")
    expect(exportMatrixBlock).toContain("LEFT JOIN public.technical_configuration_comparison_sets")
    expect(exportMatrixBlock).toContain("LEFT JOIN public.technical_configuration_option_responses")
    expect(exportMatrixBlock).toContain(
      "LEFT JOIN public.technical_configuration_manual_assessments"
    )
    expect(exportMatrixBlock).toContain("COALESCE(evidence.document_links, '[]'::JSONB)")
    expect(exportMatrixBlock).toContain(
      "'conclusion', public._technical_configuration_derived_status("
    )
    expect(
      getObjectKeys(
        exportMatrixBlock,
        "jsonb_build_object(\n            'group_id'",
        "\n          )"
      )
    ).toEqual([
      "group_id",
      "group_name",
      "group_order",
      "criterion_id",
      "criterion_code",
      "criterion_title",
      "requirement_text",
      "criterion_order",
      "option_id",
      "supplier_id",
      "supplier_name",
      "display_label",
      "model",
      "manufacturer",
      "option_name",
      "response_text",
      "supplementary_information",
      "document_links",
      "technical_axis",
      "evidence_axis",
      "assessment_notes",
      "conclusion",
    ])
    expect(
      getObjectKeys(
        exportMatrixBlock,
        "jsonb_build_object(\n            'document_id'",
        "\n          )"
      )
    ).toEqual([
      "document_id",
      "document_name",
      "document_url",
      "citation_id",
      "page_section",
      "excerpt",
    ])
    expect(getObjectKeys(exportMatrixBlock, "RETURN jsonb_build_object(", "\n  );\nEND;")).toEqual(
      rankingResponseKeys
    )
  })

  it("keeps every new function read-only, scoped and least-privilege", () => {
    for (const functionBlock of [
      rankingSnapshotBlock,
      referenceRankingBlock,
      exportRankingBlock,
      exportMatrixBlock,
    ]) {
      expect(functionBlock).not.toMatch(/\bSELECT\s+(?:[a-z_]+\.)?\*/i)
      expect(functionBlock).not.toMatch(
        /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|MERGE\s+INTO)\b/i
      )
      expect(functionBlock).not.toContain("technical_configuration_comparison_set_get_or_create")
    }
    expect(exportMatrixBlock).not.toContain("technical_configuration_reference_products")
    expect(exportMatrixBlock).not.toContain("technical_configuration_reference_responses")
    expect(exportMatrixBlock).not.toContain("technical_configuration_reference_citations")
    expect(exportMatrixBlock).not.toContain("technical_configuration_baseline_documents")
    expect(migrationSource).toContain(
      "REVOKE ALL ON FUNCTION public._technical_configuration_reference_ranking_snapshot("
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public._technical_configuration_reference_ranking_snapshot("
    )
    expect(migrationSource).toContain("TO service_role;")
    for (const functionName of [
      "_technical_configuration_option_display_label",
      "_technical_configuration_derived_status",
      "_technical_configuration_reference_ranking_snapshot",
      "technical_configuration_reference_ranking_list",
      "technical_configuration_result_export_ranking_list",
      "technical_configuration_result_export_matrix_list",
    ]) {
      expect(migrationSource).toContain(`REVOKE ALL ON FUNCTION public.${functionName}(`)
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}(`)
    }
    expect(migrationSource.match(/TO authenticated, service_role;/g)).toHaveLength(3)
  })

  it("defines focused authorization, bounds, plan and read-only phase gates", () => {
    for (const marker of [
      "missing claims rejected",
      "denied role rejected",
      "ranking page bounds rejected",
      "matrix page bounds rejected",
      "ranking preserves P12C1 ties and counters",
      "ranking scope filters after complete-universe rank",
      "matrix preserves requested criterion-option order",
      "sparse matrix returns null and empty links",
      "reference products never enter matrix cells",
      "ranking non-empty second page stays stable",
      "matrix non-empty second page stays stable",
      "ranking page beyond end stays stable",
      "matrix page beyond end stays stable",
      "matrix bounded wrapper executes and source stays set-based",
      "result export pages remain read-only",
      "P12C1 response remains backward compatible",
      "matrix PUBLIC execute revoked",
      "matrix anon execute revoked",
      "matrix service role execute granted",
      "ranking token helper PUBLIC execute revoked",
      "ranking token helper anon execute revoked",
      "ranking token helper authenticated execute revoked",
      "ranking token helper service role execute granted",
      "shared expression helpers are immutable and service-only",
      "raw admin role remains authorized",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
    expect(phaseGateSource).toContain("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)")
    expect(phaseGateSource).not.toContain(
      "EXPLAIN (FORMAT JSON) SELECT public.technical_configuration_result_export_matrix_list"
    )
    expect(phaseGateSource).not.toContain('"Temp (Read|Written) Blocks"')
  })
})
