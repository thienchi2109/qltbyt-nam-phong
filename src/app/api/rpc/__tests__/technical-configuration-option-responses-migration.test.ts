import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260722072748_technical_configuration_option_responses.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_option_responses_phase_gate.sql"
)
const CONSTRAINTS_PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_option_responses_constraints_phase_gate.sql"
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

const migrationSource = readIfExists(MIGRATION_PATH)
const phaseGateSource = readIfExists(PHASE_GATE_PATH)
const constraintsPhaseGateSource = readIfExists(CONSTRAINTS_PHASE_GATE_PATH)

const RESPONSE_RPC_SIGNATURES = [
  "technical_configuration_comparison_set_get_or_create(\n  p_option_id UUID,\n  p_baseline_version_id UUID,\n  p_expected_revision BIGINT",
  "technical_configuration_option_response_upsert(\n  p_comparison_set_id UUID,\n  p_criterion_id UUID,\n  p_response_text TEXT,\n  p_supplementary_information TEXT,\n  p_expected_revision BIGINT",
] as const

const RESPONSE_RPC_NAMES = [
  "technical_configuration_comparison_set_get_or_create",
  "technical_configuration_option_response_upsert",
] as const

const RESPONSE_WIRE_FIELDS = [
  "'id'",
  "'comparison_set_id'",
  "'baseline_version_id'",
  "'criterion_id'",
  "'response_text'",
  "'supplementary_information'",
  "'created_at'",
  "'created_by'",
  "'updated_at'",
  "'updated_by'",
  "'revision'",
] as const

describe("P8A3 technical configuration option response migration", () => {
  it("uses one ordered migration after both immutable P8A2 migrations", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_option_responses"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(
      MIGRATION_FILE.localeCompare(
        "20260722060629_technical_configuration_options_supplier_fk_index.sql"
      )
    ).toBeGreaterThan(0)
  })

  it("creates exact-version comparison-set ownership and adds the option composite key", () => {
    const tableBlock = getSqlBlock(
      migrationSource,
      "CREATE TABLE public.technical_configuration_comparison_sets",
      "\n);"
    )

    for (const column of [
      "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
      "dossier_id UUID NOT NULL",
      "option_id UUID NOT NULL",
      "baseline_version_id UUID NOT NULL",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "created_by BIGINT NOT NULL",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "updated_by BIGINT NOT NULL",
    ]) {
      expect(tableBlock).toContain(column)
    }

    expect(migrationSource).toMatch(
      /ADD CONSTRAINT technical_configuration_options_id_dossier_id_key\s+UNIQUE \(id, dossier_id\)/
    )
    expect(tableBlock).toContain("UNIQUE (option_id, baseline_version_id)")
    expect(tableBlock).toContain("UNIQUE (id, baseline_version_id)")
    expect(tableBlock).toContain("FOREIGN KEY (option_id, dossier_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_options (id, dossier_id)"
    )
    expect(tableBlock).toContain("FOREIGN KEY (baseline_version_id, dossier_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_baseline_versions (id, dossier_id)"
    )
    expect(tableBlock.match(/ON DELETE CASCADE/g)).toHaveLength(2)
  })

  it("creates one full-replacement response per comparison set and exact criterion", () => {
    const tableBlock = getSqlBlock(
      migrationSource,
      "CREATE TABLE public.technical_configuration_option_responses",
      "\n);"
    )

    for (const column of [
      "id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
      "comparison_set_id UUID NOT NULL",
      "baseline_version_id UUID NOT NULL",
      "criterion_id UUID NOT NULL",
      "response_text TEXT NOT NULL DEFAULT ''",
      "supplementary_information TEXT NOT NULL DEFAULT ''",
      "created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "created_by BIGINT NOT NULL",
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
      "updated_by BIGINT NOT NULL",
    ]) {
      expect(tableBlock).toContain(column)
    }

    expect(tableBlock).toContain("UNIQUE (comparison_set_id, criterion_id)")
    expect(tableBlock).toContain("FOREIGN KEY (comparison_set_id, baseline_version_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_comparison_sets (id, baseline_version_id)"
    )
    expect(tableBlock).toContain("FOREIGN KEY (criterion_id, baseline_version_id)")
    expect(tableBlock).toContain(
      "REFERENCES public.technical_configuration_baseline_criteria (id, baseline_version_id)"
    )
    expect(tableBlock.match(/ON DELETE CASCADE/g)).toHaveLength(2)
    expect(tableBlock).not.toMatch(/compliance|evaluation|assessment|ranking|overall_status/i)
  })

  it("adds leftmost-prefix indexes for every composite child foreign key", () => {
    for (const index of [
      "ON public.technical_configuration_comparison_sets (option_id, dossier_id)",
      "ON public.technical_configuration_comparison_sets (baseline_version_id, dossier_id)",
      "ON public.technical_configuration_option_responses (comparison_set_id, baseline_version_id)",
      "ON public.technical_configuration_option_responses (criterion_id, baseline_version_id)",
    ]) {
      expect(migrationSource).toContain(index)
    }
  })

  it("freezes the two RPC signatures, complete wire fields and deterministic response order", () => {
    for (const signature of RESPONSE_RPC_SIGNATURES) {
      expect(migrationSource).toContain(`FUNCTION public.${signature}`)
    }

    for (const functionName of RESPONSE_RPC_NAMES) {
      const block = getFunctionBlock(migrationSource, functionName)
      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(migrationSource).toContain(`REVOKE ALL ON FUNCTION public.${functionName}`)
      expect(migrationSource).toContain(`GRANT EXECUTE ON FUNCTION public.${functionName}`)
    }

    const getOrCreateBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_comparison_set_get_or_create"
    )
    for (const field of [
      "'id'",
      "'dossier_id'",
      "'option_id'",
      "'baseline_version_id'",
      "'created_at'",
      "'created_by'",
      "'updated_at'",
      "'updated_by'",
      "'revision'",
      "'responses'",
      ...RESPONSE_WIRE_FIELDS,
    ]) {
      expect(getOrCreateBlock).toContain(field)
    }
    expect(getOrCreateBlock).toContain("ORDER BY bg.sort_order, bc.sort_order, bc.id")

    const upsertBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_option_response_upsert"
    )
    for (const field of RESPONSE_WIRE_FIELDS) {
      expect(upsertBlock).toContain(field)
    }
  })

  it("keeps existing-set reads mutation-free while revisions guard create and upsert", () => {
    const getOrCreateBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_comparison_set_get_or_create"
    )
    const upsertBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_option_response_upsert"
    )

    expect(getOrCreateBlock).toContain(
      "PERFORM public._technical_configuration_require_global_user()"
    )
    expect(getOrCreateBlock).toContain("IF v_comparison_set_id IS NOT NULL THEN")
    expect(getOrCreateBlock).toMatch(
      /IF v_comparison_set_id IS NOT NULL THEN[\s\S]*?SELECT d\.revision[\s\S]*?FOR SHARE;/
    )
    expect(getOrCreateBlock.indexOf("IF v_comparison_set_id IS NOT NULL THEN")).toBeLessThan(
      getOrCreateBlock.indexOf("public._technical_configuration_require_editable_dossier(")
    )
    expect(getOrCreateBlock).toContain(
      "v_user_id := public._technical_configuration_require_editable_dossier("
    )
    expect(getOrCreateBlock).toContain("p_expected_revision")
    expect(getOrCreateBlock).toContain("revision = revision + 1")
    expect(getOrCreateBlock).not.toContain(
      "_technical_configuration_require_editable_baseline_version"
    )

    expect(upsertBlock).toContain(
      "v_user_id := public._technical_configuration_require_editable_dossier("
    )
    expect(upsertBlock).toContain("p_expected_revision")
    expect(upsertBlock).toContain("COALESCE(p_response_text, '')")
    expect(upsertBlock).toContain("COALESCE(p_supplementary_information, '')")
    expect(upsertBlock).toContain("ON CONFLICT (comparison_set_id, criterion_id) DO UPDATE")
    expect(upsertBlock).toContain("revision = revision + 1")
    expect(upsertBlock).not.toContain("_technical_configuration_require_editable_baseline_version")
    expect(migrationSource).not.toContain(
      "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy"
    )
  })

  it("keeps both tables RPC-only with deny-by-default RLS and explicit service grants", () => {
    for (const tableName of [
      "technical_configuration_comparison_sets",
      "technical_configuration_option_responses",
    ]) {
      expect(migrationSource).toContain(`ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`)
      expect(migrationSource).toMatch(
        new RegExp(`REVOKE ALL ON TABLE public\\.${tableName}\\s+FROM PUBLIC, anon, authenticated`)
      )
      expect(migrationSource).toContain(`GRANT ALL ON TABLE public.${tableName} TO service_role`)
    }
    expect(migrationSource).toContain(
      "FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)"
    )
  })

  it("ships bounded transaction phase gates for the complete P8A3 contract", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    expect(existsSync(CONSTRAINTS_PHASE_GATE_PATH)).toBe(true)
    expect(countLines(migrationSource)).toBeLessThanOrEqual(450)
    expect(countLines(phaseGateSource)).toBeLessThanOrEqual(450)
    expect(countLines(constraintsPhaseGateSource)).toBeLessThanOrEqual(450)

    for (const marker of [
      "BEGIN;",
      "ROLLBACK;",
      "missing claims rejected",
      "non-global role rejected",
      "raw admin accepted",
      "cross-dossier option baseline rejected",
      "exact baseline criterion enforced",
      "existing set ignores stale revision",
      "archived existing set remains readable",
      "missing set increments dossier revision exactly once",
      "response upsert increments dossier revision exactly once",
      "stale create leaves no partial row",
      "stale upsert leaves response and dossier revision unchanged",
      "locked baseline accepts comparison responses",
      "draft baseline accepts responses linked only to copied criteria",
      "multiline response and supplementary information preserved",
      "full replacement preserves resent field",
      "baseline copy excludes comparison data",
      "option delete cascades comparison data",
      "baseline delete cascades comparison data",
      "dossier delete cascades comparison data",
      "response update preserves creation audit",
      "FOREACH v_function_signature IN ARRAY",
      "FOREACH v_table_privilege IN ARRAY",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }

    for (const marker of [
      "BEGIN;",
      "ROLLBACK;",
      "comparison set option ownership FK enforced",
      "comparison set baseline ownership FK enforced",
      "response comparison set ownership FK enforced",
      "response criterion ownership FK enforced",
      "'23503'",
    ]) {
      expect(constraintsPhaseGateSource).toContain(marker)
    }
  })
})
