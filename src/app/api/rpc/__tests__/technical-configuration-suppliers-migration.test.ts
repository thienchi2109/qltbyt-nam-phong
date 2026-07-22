import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260722010000_technical_configuration_suppliers.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_suppliers_phase_gate.sql"
)

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getFunctionBlock(source: string, functionName: string): string {
  const marker = `FUNCTION public.${functionName}(`
  const start = source.indexOf(marker)
  if (start === -1) return ""

  const next = source.indexOf("\nCREATE OR REPLACE FUNCTION public.", start + marker.length)
  return source.slice(start, next === -1 ? source.length : next)
}

function getTableBlock(source: string): string {
  const start = source.indexOf("CREATE TABLE public.technical_configuration_suppliers")
  if (start === -1) return ""

  const end = source.indexOf("\n);", start)
  return end === -1 ? "" : source.slice(start, end + 3)
}

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)

const SUPPLIER_RPC_SIGNATURES = [
  "technical_configuration_suppliers_list(\n  p_dossier_id UUID,\n  p_page INTEGER DEFAULT 1,\n  p_page_size INTEGER DEFAULT 50",
  "technical_configuration_supplier_create(\n  p_dossier_id UUID,\n  p_name TEXT,\n  p_expected_revision BIGINT",
  "technical_configuration_supplier_update(\n  p_supplier_id UUID,\n  p_name TEXT,\n  p_expected_revision BIGINT",
  "technical_configuration_supplier_delete(\n  p_supplier_id UUID,\n  p_expected_revision BIGINT",
] as const

const SUPPLIER_RPC_NAMES = [
  "technical_configuration_suppliers_list",
  "technical_configuration_supplier_create",
  "technical_configuration_supplier_update",
  "technical_configuration_supplier_delete",
] as const

describe("P8A1 technical configuration supplier migration", () => {
  it("uses the approved deploy-safe migration boundary and ordering", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_suppliers"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(
      MIGRATION_FILE.localeCompare("20260712112500_technical_configuration_dossier_foundation.sql")
    ).toBeGreaterThan(0)
  })

  it("creates only the dossier-scoped supplier aggregate", () => {
    const tableBlock = getTableBlock(migrationSource)

    expect(tableBlock).toContain("id UUID PRIMARY KEY DEFAULT gen_random_uuid()")
    expect(tableBlock).toContain("dossier_id UUID NOT NULL")
    expect(tableBlock).toContain("name TEXT NOT NULL")
    expect(tableBlock).toContain("normalized_name TEXT GENERATED ALWAYS AS")
    expect(tableBlock).toContain("created_by BIGINT NOT NULL")
    expect(tableBlock).toContain("updated_by BIGINT NOT NULL")
    expect(tableBlock).toContain("UNIQUE (id, dossier_id)")
    expect(tableBlock).toContain("UNIQUE (dossier_id, normalized_name)")
    expect(tableBlock).toContain("REFERENCES public.technical_configuration_dossiers (id)")
    expect(tableBlock).toContain("ON DELETE CASCADE")
    expect(tableBlock).not.toMatch(
      /baseline_version_id|locked_at|locked_by|source_baseline_version_id/
    )
    expect(tableBlock).not.toMatch(/\brevision\b/)
    expect(migrationSource).not.toContain("CREATE TABLE public.technical_configuration_options")
    expect(migrationSource).not.toContain(
      "CREATE TABLE public.technical_configuration_option_responses"
    )
  })

  it("normalizes uniqueness while preserving a canonical display name", () => {
    expect(migrationSource).toContain(
      "CREATE OR REPLACE FUNCTION public._technical_configuration_normalize_supplier_name("
    )
    expect(migrationSource).toContain(
      "lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'))"
    )

    for (const functionName of [
      "technical_configuration_supplier_create",
      "technical_configuration_supplier_update",
    ]) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain(
        "v_name TEXT := NULLIF(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'), '')"
      )
      expect(block).toContain("RAISE EXCEPTION 'validation_error' USING ERRCODE = 'PT422'")
      expect(block).toContain("RAISE EXCEPTION 'duplicate_supplier' USING ERRCODE = 'PT409'")
    }
  })

  it("freezes the four RPC signatures and security contract", () => {
    for (const signature of SUPPLIER_RPC_SIGNATURES) {
      expect(migrationSource).toContain(`FUNCTION public.${signature}`)
    }

    for (const functionName of SUPPLIER_RPC_NAMES) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`)
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`)
    }
  })

  it("uses global reads and dossier-owned optimistic concurrency for mutations", () => {
    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_suppliers_list")
    expect(listBlock).toContain("PERFORM public._technical_configuration_require_global_user()")
    expect(listBlock).toContain("FROM public.technical_configuration_dossiers d")
    expect(listBlock).toContain("FROM public.technical_configuration_suppliers s")
    expect(listBlock).toContain("'revision', v_revision")
    expect(listBlock).toContain("LIMIT p_page_size")
    expect(listBlock).toContain("OFFSET (p_page - 1) * p_page_size")

    const createBlock = getFunctionBlock(migrationSource, "technical_configuration_supplier_create")
    expect(createBlock).toContain(
      "v_user_id := public._technical_configuration_require_editable_dossier("
    )
    expect(createBlock).toContain("p_dossier_id,")
    expect(createBlock).toContain("p_expected_revision")

    for (const functionName of [
      "technical_configuration_supplier_update",
      "technical_configuration_supplier_delete",
    ]) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("FROM public.technical_configuration_suppliers s")
      expect(block).toContain(
        "v_user_id := public._technical_configuration_require_editable_dossier("
      )
      expect(block).toContain("v_dossier_id,")
      expect(block).toContain("p_expected_revision")
    }

    for (const functionName of SUPPLIER_RPC_NAMES.slice(1)) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("UPDATE public.technical_configuration_dossiers")
      expect(block).toContain("revision = revision + 1")
      expect(block).not.toContain("_technical_configuration_require_editable_baseline_version")
    }
  })

  it("keeps the table RPC-only with deny-by-default RLS and explicit grants", () => {
    expect(migrationSource).toContain(
      "ALTER TABLE public.technical_configuration_suppliers ENABLE ROW LEVEL SECURITY"
    )
    expect(migrationSource).toContain(
      "CREATE POLICY technical_configuration_suppliers_no_client_access"
    )
    expect(migrationSource).toContain(
      "FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)"
    )
    expect(migrationSource).toMatch(
      /REVOKE ALL ON TABLE public\.technical_configuration_suppliers\s+FROM PUBLIC, anon, authenticated/
    )
    expect(migrationSource).toContain(
      "GRANT ALL ON TABLE public.technical_configuration_suppliers TO service_role"
    )
  })

  it("ships a phase-local SQL gate without coupling it to later option leaves", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("technical_configuration_suppliers_list")
    expect(phaseGateSource).toContain("technical_configuration_supplier_create")
    expect(phaseGateSource).toContain("technical_configuration_supplier_update")
    expect(phaseGateSource).toContain("technical_configuration_supplier_delete")
    expect(phaseGateSource).toContain("duplicate_supplier")
    expect(phaseGateSource).toContain("stale_revision")
    expect(phaseGateSource).toContain("archived_dossier")
    expect(phaseGateSource).toContain("ON DELETE CASCADE")
    expect(phaseGateSource).not.toMatch(/technical_configuration_options|option_responses/)
  })
})
