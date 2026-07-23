import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(process.cwd())
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260723110549_technical_configuration_comparison_set_read.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_comparison_set_read_phase_gate.sql"
)
const P8A3_MIGRATION_PATH = path.join(
  MIGRATIONS_DIR,
  "20260722072748_technical_configuration_option_responses.sql"
)
const P8A3_MIGRATION_SHA256 = "80af359add898c9d07bdce11f64b549d50819c247842a10d39f90c60a63730fb"

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
const readFunctionBlock = getFunctionBlock(
  migrationSource,
  "technical_configuration_comparison_set_get"
)

describe("P8A4 technical configuration comparison-set read migration", () => {
  it("extracts only the requested function across both function DDL forms", () => {
    const source = [
      "CREATE OR REPLACE FUNCTION public.target_function()",
      "RETURNS TEXT",
      "AS $$ SELECT 'target' $$;",
      "CREATE FUNCTION public.followup_function()",
      "RETURNS TEXT",
      "AS $$ SELECT 'followup' $$;",
    ].join("\n")

    expect(getFunctionBlock(source, "target_function")).toContain("'target'")
    expect(getFunctionBlock(source, "target_function")).not.toContain("'followup'")
  })

  it("uses one ordered migration after the immutable P8A3 response migration", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
    expect(
      readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.includes("technical_configuration_comparison_set_read"))
        .sort()
    ).toEqual([MIGRATION_FILE])
    expect(
      MIGRATION_FILE.localeCompare("20260722072748_technical_configuration_option_responses.sql")
    ).toBeGreaterThan(0)
  })

  it("freezes the nullable two-argument RPC and explicit execute grants", () => {
    expect(migrationSource).toContain(
      "FUNCTION public.technical_configuration_comparison_set_get(\n" +
        "  p_option_id UUID,\n" +
        "  p_baseline_version_id UUID\n" +
        ")"
    )
    expect(readFunctionBlock).toContain("RETURNS JSONB")
    expect(readFunctionBlock).toContain("SECURITY DEFINER")
    expect(readFunctionBlock).toContain("SET search_path = public, pg_temp")
    expect(migrationSource).toContain(
      "REVOKE ALL ON FUNCTION public.technical_configuration_comparison_set_get(\n" +
        "  UUID, UUID\n" +
        ") FROM PUBLIC, anon, authenticated, service_role"
    )
    expect(migrationSource).toContain(
      "GRANT EXECUTE ON FUNCTION public.technical_configuration_comparison_set_get(\n" +
        "  UUID, UUID\n" +
        ") TO authenticated, service_role"
    )
  })

  it("validates global access and exact dossier ownership while keeping archived reads available", () => {
    expect(readFunctionBlock).toContain(
      "PERFORM public._technical_configuration_require_global_user()"
    )
    expect(readFunctionBlock).toContain("FROM public.technical_configuration_options o")
    expect(readFunctionBlock).toContain("FROM public.technical_configuration_baseline_versions v")
    expect(readFunctionBlock).toContain(
      "IF v_option_dossier_id IS DISTINCT FROM v_version_dossier_id THEN"
    )
    expect(readFunctionBlock).not.toContain(
      "public._technical_configuration_require_editable_dossier("
    )
    expect(readFunctionBlock).not.toContain("archived_dossier")
  })

  it("returns data null for a missing pair without locks, writes, revisions or audit changes", () => {
    expect(readFunctionBlock).toContain("RETURN jsonb_build_object('data', NULL)")
    expect(readFunctionBlock).not.toMatch(/\bINSERT\s+INTO\b/i)
    expect(readFunctionBlock).not.toMatch(/\bUPDATE\b/i)
    expect(readFunctionBlock).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(readFunctionBlock).not.toMatch(/\bMERGE\s+INTO\b/i)
    expect(readFunctionBlock).not.toMatch(/\bTRUNCATE\b/i)
    expect(readFunctionBlock).not.toMatch(
      /\bFOR\s+(?:KEY\s+SHARE|NO\s+KEY\s+UPDATE|SHARE|UPDATE)\b/i
    )
    expect(readFunctionBlock).not.toContain("p_expected_revision")
    expect(readFunctionBlock).not.toContain("revision = revision + 1")
  })

  it("returns the existing comparison-set wire shape with deterministic multiline responses", () => {
    for (const mapping of [
      "'id', cs.id",
      "'dossier_id', cs.dossier_id",
      "'option_id', cs.option_id",
      "'baseline_version_id', cs.baseline_version_id",
      "'created_at', cs.created_at",
      "'created_by', cs.created_by",
      "'updated_at', cs.updated_at",
      "'updated_by', cs.updated_by",
      "'revision', d.revision",
      "'id', r.id",
      "'comparison_set_id', r.comparison_set_id",
      "'baseline_version_id', r.baseline_version_id",
      "'criterion_id', r.criterion_id",
      "'response_text', r.response_text",
      "'supplementary_information', r.supplementary_information",
      "'created_at', r.created_at",
      "'created_by', r.created_by",
      "'updated_at', r.updated_at",
      "'updated_by', r.updated_by",
    ]) {
      expect(readFunctionBlock).toContain(mapping)
    }
    expect(readFunctionBlock.match(/'revision', d\.revision/g)).toHaveLength(2)
    expect(readFunctionBlock).toContain("'responses', COALESCE(")
    expect(readFunctionBlock).toContain("ORDER BY bg.sort_order, bc.sort_order, bc.id")
    expect(readFunctionBlock).toContain("'[]'::JSONB")
  })

  it("does not modify the applied P8A3 migration source contract", () => {
    const source = readFileSync(P8A3_MIGRATION_PATH, "utf8")
    expect(createHash("sha256").update(source).digest("hex")).toBe(P8A3_MIGRATION_SHA256)
    expect(source).toContain("UNIQUE (option_id, baseline_version_id)")
  })

  it("ships a rollback-only phase gate for read behavior and privileges", () => {
    expect(existsSync(PHASE_GATE_PATH)).toBe(true)
    expect(countLines(migrationSource)).toBeLessThanOrEqual(450)
    expect(phaseGateSource).not.toMatch(/\bCOMMIT\s*;/i)
    expect(phaseGateSource.trimEnd()).toMatch(/\bROLLBACK\s*;$/i)

    for (const marker of [
      "BEGIN;",
      "ROLLBACK;",
      "missing claims rejected",
      "malformed claims rejected",
      "nonnumeric user id rejected",
      "non-global role rejected",
      "raw admin accepted",
      "missing pair returns data null",
      "missing pair creates no comparison data",
      "missing pair preserves dossier revision and audit metadata",
      "existing pair returns ordered exact multiline responses",
      "complete existing payload matches stored snapshot",
      "existing pair preserves dossier revision and audit metadata",
      "archived existing data remains readable",
      "cross-dossier option baseline rejected",
      "authenticated executes read RPC",
      "service role executes read RPC",
      "anon cannot execute read RPC",
      "fixed search_path",
    ]) {
      expect(phaseGateSource).toContain(marker)
    }
  })
})
