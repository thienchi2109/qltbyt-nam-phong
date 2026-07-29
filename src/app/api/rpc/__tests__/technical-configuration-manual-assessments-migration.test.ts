import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260729134453_technical_configuration_manual_assessments.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_manual_assessments_phase_gate.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function countLines(source: string): number {
  return source === "" ? 0 : source.trimEnd().split("\n").length
}

function getSqlBlock(source: string, marker: string, nextMarker: string): string {
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const next = source.indexOf(nextMarker, start + marker.length)
  return source.slice(start, next === -1 ? source.length : next)
}

function getFunctionBlock(source: string, functionName: string): string {
  return getSqlBlock(
    source,
    `FUNCTION public.${functionName}(`,
    "\nCREATE OR REPLACE FUNCTION public."
  )
}

function getTableColumnNames(tableBlock: string): string[] {
  return tableBlock
    .slice(0, tableBlock.indexOf("\n  UNIQUE"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+ [A-Z]/.test(line))
    .map((line) => line.split(/\s+/, 1)[0])
}

function getJsonObjectKeys(objectBlock: string): string[] {
  return Array.from(objectBlock.matchAll(/^\s*'([^']+)',/gm), (match) => match[1])
}

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)

const ASSESSMENT_RPC_SIGNATURES = [
  "technical_configuration_assessments_list(\n  p_comparison_set_id UUID,\n  p_page INTEGER,\n  p_page_size INTEGER",
  "technical_configuration_assessment_upsert(\n  p_comparison_set_id UUID,\n  p_criterion_id UUID,\n  p_technical_axis TEXT,\n  p_evidence_axis TEXT,\n  p_notes TEXT,\n  p_expected_revision BIGINT",
] as const

const ASSESSMENT_RPC_NAMES = [
  "technical_configuration_assessments_list",
  "technical_configuration_assessment_upsert",
] as const

const ASSESSMENT_WIRE_FIELDS = [
  "'id'",
  "'comparison_set_id'",
  "'baseline_version_id'",
  "'criterion_id'",
  "'technical_axis'",
  "'evidence_axis'",
  "'notes'",
  "'revision'",
  "'created_by'",
  "'created_at'",
  "'updated_by'",
  "'updated_at'",
] as const

describe("P11B technical configuration manual assessment migration", () => {
  it("uses one ordered migration after the current technical configuration chain", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_manual_assessments"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(
      MIGRATION_FILE.localeCompare("20260729062450_equipment_list_liquidation_chronology.sql")
    ).toBeGreaterThan(0)
    expect(
      MIGRATION_FILE.localeCompare("20260727090000_technical_configuration_comparison_reads.sql")
    ).toBeGreaterThan(0)
  })

  it("creates one row-revisioned assessment per exact comparison set and criterion", () => {
    const tableBlock = getSqlBlock(
      migrationSource,
      "CREATE TABLE public.technical_configuration_manual_assessments",
      "\n);"
    )

    for (const column of [
      "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
      "comparison_set_id UUID NOT NULL",
      "baseline_version_id UUID NOT NULL",
      "criterion_id UUID NOT NULL",
      "technical_axis TEXT",
      "evidence_axis TEXT",
      "notes TEXT NOT NULL DEFAULT ''",
      "revision BIGINT NOT NULL DEFAULT 1",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "created_by BIGINT NOT NULL",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "updated_by BIGINT NOT NULL",
    ]) {
      expect(tableBlock).toContain(column)
    }

    expect(getTableColumnNames(tableBlock)).toEqual([
      "id",
      "comparison_set_id",
      "baseline_version_id",
      "criterion_id",
      "technical_axis",
      "evidence_axis",
      "notes",
      "revision",
      "created_at",
      "created_by",
      "updated_at",
      "updated_by",
    ])
    expect(tableBlock).toContain("UNIQUE (comparison_set_id, criterion_id)")
    expect(tableBlock).toContain("CHECK (revision > 0)")
    expect(tableBlock).toContain("FOREIGN KEY (comparison_set_id, baseline_version_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_comparison_sets (id, baseline_version_id)"
    )
    expect(tableBlock).toContain("FOREIGN KEY (criterion_id, baseline_version_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id)"
    )
    expect(tableBlock.match(/ON DELETE CASCADE/g)).toHaveLength(2)
  })

  it("stores only nullable canonical axes and notes without derived or machine state", () => {
    const tableBlock = getSqlBlock(
      migrationSource,
      "CREATE TABLE public.technical_configuration_manual_assessments",
      "\n);"
    )

    expect(tableBlock).toMatch(
      /CHECK \(\s*technical_axis IS NULL\s+OR technical_axis IN \(\s*'exceeds',\s*'meets',\s*'fails',\s*'unclear',\s*'not_applicable'\s*\)\s*\)/
    )
    expect(tableBlock).toMatch(
      /CHECK \(\s*evidence_axis IS NULL\s+OR evidence_axis IN \(\s*'complete',\s*'partial',\s*'missing',\s*'not_required'\s*\)\s*\)/
    )
    expect(tableBlock).not.toMatch(
      /derived|overall_status|stale|machine|ai_result|source_response|supplementary|document|citation/i
    )
  })

  it("adds leftmost-prefix indexes for both composite ownership foreign keys", () => {
    for (const index of [
      "ON public.technical_configuration_manual_assessments (comparison_set_id, baseline_version_id)",
      "ON public.technical_configuration_manual_assessments (criterion_id, baseline_version_id)",
    ]) {
      expect(migrationSource).toContain(index)
    }
  })

  it("freezes both dormant DB RPC signatures and exact deterministic wire fields", () => {
    for (const signature of ASSESSMENT_RPC_SIGNATURES) {
      expect(migrationSource).toContain(`FUNCTION public.${signature}`)
    }

    for (const functionName of ASSESSMENT_RPC_NAMES) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`)
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`)
      expect(block).not.toMatch(
        /'derived_status'|'overall_status'|'response_text'|'supplementary_information'|'documents'|'citations'|'machine_result'/
      )
    }

    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_assessments_list")
    const listItemBlock = getSqlBlock(listBlock, "jsonb_build_object(", ") AS item")
    const upsertBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_assessment_upsert"
    )
    const upsertDataBlock = getSqlBlock(
      upsertBlock,
      "SELECT jsonb_build_object(",
      "\n  INTO v_data"
    )

    expect(getJsonObjectKeys(listItemBlock)).toEqual(
      ASSESSMENT_WIRE_FIELDS.map((field) => field.slice(1, -1))
    )
    expect(getJsonObjectKeys(upsertDataBlock)).toEqual(
      ASSESSMENT_WIRE_FIELDS.map((field) => field.slice(1, -1))
    )
    expect(listBlock).toContain("ORDER BY bg.sort_order, bc.sort_order, bc.id")
    expect(listBlock).toContain("WITH ordered_assessments AS MATERIALIZED")
    expect(listBlock).toContain("paged_assessments AS")
    expect(listBlock).toContain("(SELECT count(*) FROM ordered_assessments)")
    expect(listBlock).not.toContain("SELECT count(*)\n  INTO v_total")
    expect(listBlock).toContain("'data'")
    expect(listBlock).toContain("'total'")
    expect(listBlock).toContain("'page'")
    expect(listBlock).toContain("'page_size'")
  })

  it("keeps list reads bounded, authorized, archived-readable and mutation-free", () => {
    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_assessments_list")

    expect(listBlock).toContain("PERFORM public._technical_configuration_require_global_user()")
    expect(listBlock).toContain("p_comparison_set_id IS NULL")
    expect(listBlock).toContain("p_page IS NULL OR p_page < 1")
    expect(listBlock).toContain("p_page_size IS NULL OR p_page_size < 1 OR p_page_size > 100")
    expect(listBlock).toContain("RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'")
    expect(listBlock).toContain("RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'")
    expect(listBlock).toContain("LIMIT p_page_size")
    expect(listBlock).toContain("OFFSET (p_page - 1)::BIGINT * p_page_size")
    expect(listBlock).not.toContain("_technical_configuration_require_editable_dossier")
    expect(listBlock).not.toMatch(/\bINSERT INTO public\.|\bUPDATE public\.|\bDELETE FROM public\./)
  })

  it("uses row-level optimistic concurrency and never increments dossier revision", () => {
    const upsertBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_assessment_upsert"
    )

    expect(upsertBlock).toContain(
      "v_user_id := public._technical_configuration_require_global_user()"
    )
    expect(upsertBlock).toContain("p_expected_revision IS NULL OR p_expected_revision < 0")
    expect(upsertBlock).toContain("p_technical_axis IS NOT NULL")
    expect(upsertBlock).toContain("p_evidence_axis IS NOT NULL")
    expect(upsertBlock).toContain("RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'")
    expect(upsertBlock).toContain("RAISE EXCEPTION 'not_found' USING ERRCODE = 'PT404'")
    expect(upsertBlock).toContain("RAISE EXCEPTION 'archived_dossier' USING ERRCODE = 'PT409'")
    expect(upsertBlock).toContain("RAISE EXCEPTION 'stale_revision' USING ERRCODE = 'PT409'")
    expect(upsertBlock).not.toContain("FOR SHARE OF cs, d")
    expect(upsertBlock).toContain("AND cs.dossier_id = v_dossier_id")
    expect(upsertBlock.indexOf("FROM public.technical_configuration_dossiers d")).toBeLessThan(
      upsertBlock.indexOf("AND cs.dossier_id = v_dossier_id")
    )
    expect(upsertBlock.indexOf("AND cs.dossier_id = v_dossier_id")).toBeLessThan(
      upsertBlock.indexOf("FROM public.technical_configuration_baseline_criteria c")
    )
    expect(upsertBlock).toContain("FOR UPDATE")
    expect(upsertBlock).toContain("COALESCE(p_notes, '')")
    expect(upsertBlock).toContain("p_expected_revision = 0")
    expect(upsertBlock).toContain("ON CONFLICT (comparison_set_id, criterion_id) DO NOTHING")
    expect(upsertBlock).toContain("revision = a.revision + 1")
    expect(upsertBlock).toContain("updated_at = now()")
    expect(upsertBlock).toContain("updated_by = v_user_id")
    expect(upsertBlock).not.toContain("_technical_configuration_require_editable_dossier")
    expect(upsertBlock).not.toMatch(
      /UPDATE public\.technical_configuration_dossiers|revision = revision \+ 1/
    )
  })

  it("keeps the table RPC-only with deny-by-default RLS and explicit grants", () => {
    const tableName = "technical_configuration_manual_assessments"

    expect(migrationSource).toContain(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`)
    expect(migrationSource).toContain(`CREATE POLICY ${tableName}_no_client_access`)
    expect(migrationSource).toContain(
      "FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)"
    )
    expect(migrationSource).toMatch(
      new RegExp(`REVOKE ALL ON TABLE public\\.${tableName}\\s+FROM PUBLIC, anon, authenticated`)
    )
    expect(migrationSource).toContain(`GRANT ALL ON TABLE public.${tableName} TO service_role`)

    for (const functionName of ASSESSMENT_RPC_NAMES) {
      expect(migrationSource).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) FROM PUBLIC, anon, authenticated, service_role`
        )
      )
      expect(migrationSource).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*?\\) TO authenticated, service_role`
        )
      )
    }
  })

  it("ships one bounded rollback-only phase gate for the complete P11B contract", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    expect(countLines(migrationSource)).toBeLessThanOrEqual(450)
    expect(countLines(phaseGateSource)).toBeLessThanOrEqual(450)

    for (const marker of [
      "BEGIN;",
      "ROLLBACK;",
      "missing claims rejected",
      "non-global role rejected",
      "raw admin accepted",
      "assessment list bounds enforced",
      "null comparison set rejected",
      "null page rejected",
      "null page size rejected",
      "invalid page rejected",
      "zero page size rejected",
      "oversized page size rejected",
      "archived assessment reads remain available",
      "archived assessment mutation rejected",
      "cross-version criterion rejected",
      "assessment comparison set ownership FK enforced",
      "assessment criterion ownership FK enforced",
      "canonical nullable axes and notes preserved",
      "invalid technical axis rejected",
      "invalid evidence axis rejected",
      "first create revision is one",
      "create response exact wire fields",
      "existing row rejects expected revision zero",
      "missing row rejects positive expected revision",
      "exact update increments only assessment revision",
      "update response exact wire fields",
      "stale update leaves assessment unchanged",
      "source response update preserves manual assessment",
      "option document update preserves manual assessment",
      "to_jsonb(a)",
      "assessment update preserves creation audit",
      "option delete cascades assessments",
      "baseline delete cascades assessments",
      "dossier delete cascades assessments",
      "manual assessment table exposes no derived or machine fields",
      "v_column_names = ARRAY[",
      "FOREACH v_function_signature IN ARRAY",
      "FOREACH v_table_privilege IN ARRAY",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
  })
})
