import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260722034323_technical_configuration_options.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_options_phase_gate.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
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

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)

const OPTION_RPC_SIGNATURES = [
  "technical_configuration_options_list(\n  p_dossier_id UUID,\n  p_supplier_id UUID DEFAULT NULL,\n  p_page INTEGER DEFAULT 1,\n  p_page_size INTEGER DEFAULT 50",
  "technical_configuration_option_create(\n  p_supplier_id UUID,\n  p_model TEXT,\n  p_manufacturer TEXT,\n  p_option_name TEXT,\n  p_notes TEXT,\n  p_expected_revision BIGINT",
  "technical_configuration_option_update(\n  p_option_id UUID,\n  p_model TEXT,\n  p_manufacturer TEXT,\n  p_option_name TEXT,\n  p_notes TEXT,\n  p_expected_revision BIGINT",
  "technical_configuration_option_delete(\n  p_option_id UUID,\n  p_expected_revision BIGINT",
] as const

const OPTION_RPC_NAMES = [
  "technical_configuration_options_list",
  "technical_configuration_option_create",
  "technical_configuration_option_update",
  "technical_configuration_option_delete",
] as const

describe("P8A2 technical configuration option migration", () => {
  it("uses one ordered deploy-safe migration after the applied supplier contract", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_options"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(
      MIGRATION_FILE.localeCompare("20260722010000_technical_configuration_suppliers.sql")
    ).toBeGreaterThan(0)
  })

  it("creates dossier-consistent option identity with audit metadata and no version state", () => {
    const tableBlock = getSqlBlock(
      migrationSource,
      "CREATE TABLE public.technical_configuration_options",
      "\n);"
    )

    for (const column of [
      "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
      "dossier_id UUID NOT NULL",
      "supplier_id UUID NOT NULL",
      "model TEXT",
      "manufacturer TEXT",
      "option_name TEXT",
      "notes TEXT",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "created_by BIGINT NOT NULL",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "updated_by BIGINT NOT NULL",
    ]) {
      expect(tableBlock).toContain(column)
    }

    expect(tableBlock).toContain("CHECK (model IS NOT NULL OR option_name IS NOT NULL)")
    expect(tableBlock).toContain("FOREIGN KEY (supplier_id, dossier_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_suppliers (id, dossier_id)"
    )
    expect(tableBlock).toContain("ON DELETE CASCADE")
    expect(tableBlock).not.toMatch(/\bUNIQUE\b/)
    expect(tableBlock).not.toMatch(
      /\brevision\b|baseline_version_id|locked_at|locked_by|source_baseline_version_id/
    )
    expect(migrationSource).toContain(
      "CREATE INDEX technical_configuration_options_dossier_supplier_idx"
    )
    expect(migrationSource).toContain(
      "ON public.technical_configuration_options (dossier_id, supplier_id)"
    )
  })

  it("freezes the four RPC signatures, wire fields and derived display label", () => {
    for (const signature of OPTION_RPC_SIGNATURES) {
      expect(migrationSource).toContain(`FUNCTION public.${signature}`)
    }

    for (const functionName of OPTION_RPC_NAMES) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`)
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`)
    }

    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_options_list")
    for (const wireField of [
      "'id'",
      "'dossier_id'",
      "'supplier_id'",
      "'supplier_name'",
      "'model'",
      "'manufacturer'",
      "'option_name'",
      "'notes'",
      "'display_label'",
      "'created_at'",
      "'created_by'",
      "'updated_at'",
      "'updated_by'",
      "'revision'",
    ]) {
      expect(listBlock).toContain(wireField)
    }
    expect(listBlock).toContain("COALESCE(o.model, o.option_name)")
    expect(listBlock).toContain("s.name || ' · ' || COALESCE(o.model, o.option_name)")
  })

  it("uses global reads and dossier revision ownership for every mutation", () => {
    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_options_list")
    expect(listBlock).toContain("PERFORM public._technical_configuration_require_global_user()")
    expect(listBlock).not.toContain("_technical_configuration_require_editable_dossier")
    expect(listBlock).toContain("p_supplier_id IS NULL OR o.supplier_id = p_supplier_id")
    expect(listBlock).toContain("LIMIT p_page_size")
    expect(listBlock).toContain("OFFSET (p_page::BIGINT - 1) * p_page_size::BIGINT")

    for (const functionName of OPTION_RPC_NAMES.slice(1)) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain(
        "v_user_id := public._technical_configuration_require_editable_dossier("
      )
      expect(block).toContain("p_expected_revision")
      expect(block).toContain("UPDATE public.technical_configuration_dossiers")
      expect(block).toContain("revision = revision + 1")
      expect(block).not.toMatch(
        /_technical_configuration_require_editable_baseline_version|baseline_version_id/
      )
    }
  })

  it("keeps options RPC-only with deny-by-default RLS and explicit grants", () => {
    expect(migrationSource).toContain(
      "ALTER TABLE public.technical_configuration_options ENABLE ROW LEVEL SECURITY"
    )
    expect(migrationSource).toContain(
      "CREATE POLICY technical_configuration_options_no_client_access"
    )
    expect(migrationSource).toContain(
      "FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)"
    )
    expect(migrationSource).toMatch(
      /REVOKE ALL ON TABLE public\.technical_configuration_options\s+FROM PUBLIC, anon, authenticated/
    )
    expect(migrationSource).toContain(
      "GRANT ALL ON TABLE public.technical_configuration_options TO service_role"
    )
  })

  it("ships a bounded transaction phase gate for the complete P8A2 contract", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    expect(migrationSource.split("\n").length).toBeLessThanOrEqual(450)
    expect(phaseGateSource.split("\n").length).toBeLessThanOrEqual(450)

    for (const contractMarker of [
      "BEGIN;",
      "ROLLBACK;",
      "multiple options under one supplier",
      "duplicate option identity remains allowed",
      "cross-dossier supplier ownership rejected",
      "option list pagination",
      "supplier filter stays dossier scoped",
      "archived dossier remains readable",
      "archived dossier rejects option mutation",
      "current revision increments exactly once",
      "stale revision leaves option and dossier unchanged",
      "locked baseline does not block option mutation",
      "option create audit metadata",
      "option update preserves creation audit",
      "supplier delete cascades options",
      "dossier delete cascades options",
      "FOREACH v_function_signature IN ARRAY",
      "FOREACH v_table_privilege IN ARRAY",
    ]) {
      expect(phaseGateSource).toContain(contractMarker)
    }

    expect(phaseGateSource).toMatch(
      /has_function_privilege\(\s*'authenticated',\s*v_function_signature,\s*'EXECUTE'\s*\)/
    )
    expect(phaseGateSource).toMatch(
      /has_function_privilege\(\s*'service_role',\s*v_function_signature,\s*'EXECUTE'\s*\)/
    )
    expect(phaseGateSource).toMatch(
      /has_function_privilege\(\s*'anon',\s*v_function_signature,\s*'EXECUTE'\s*\)/
    )
    expect(phaseGateSource).toMatch(
      /has_table_privilege\(\s*'authenticated',\s*'public\.technical_configuration_options',\s*v_table_privilege\s*\)/
    )
    expect(phaseGateSource).toMatch(
      /has_table_privilege\(\s*'anon',\s*'public\.technical_configuration_options',\s*v_table_privilege\s*\)/
    )
    expect(phaseGateSource).toMatch(
      /has_table_privilege\(\s*'service_role',\s*'public\.technical_configuration_options',\s*v_table_privilege\s*\)/
    )
  })
})
