import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_SUFFIX = "_technical_configuration_dossier_search.sql"
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_search_phase_gate.sql"
)
const DELETE_PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_delete_phase_gate.sql"
)
const GATE_REGISTRY_PATH = path.join(REPO_ROOT, "supabase/db-quality-gate-tests.json")
const LIST_FUNCTION_MARKER =
  "CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_list"

type DatabaseGateRegistry = {
  tests: Array<{
    evidence: string[]
    fixtureContract: string
    path: string
    purpose: string
    runnerRequirements: string[]
    safety: string
    timeoutSeconds: number
    transactionContract: string
  }>
}

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(MIGRATION_SUFFIX))
    .sort()
}

function getMigrationSource(): string {
  const migrationFile = getMigrationFiles()[0]
  return migrationFile ? readFileSync(path.join(MIGRATIONS_DIR, migrationFile), "utf8") : ""
}

function getMigrationTimestamp(fileName: string): number {
  const match = /^(\d{14})_/.exec(fileName)
  if (!match) {
    throw new Error(`Migration file lacks a timestamp prefix: ${fileName}`)
  }

  return Number(match[1])
}

function getFunctionBlock(source: string, functionName: string): string {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}`
  const start = source.lastIndexOf(marker)
  if (start < 0) {
    return ""
  }

  const end = source.indexOf("\n$function$;", start + marker.length)
  return end < 0 ? "" : source.slice(start, end + "\n$function$;".length)
}

describe("technical configuration dossier Phase 2 search migration", () => {
  const migrationSource = getMigrationSource()
  const normalizeBlock = getFunctionBlock(migrationSource, "_normalize_search_text")
  const listBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_list")

  it("adds one append-only migration after every local dossier-list definition", () => {
    const migrationFiles = getMigrationFiles()
    expect(migrationFiles).toHaveLength(1)

    const migrationFile = migrationFiles[0] ?? ""
    const migrationTimestamp = getMigrationTimestamp(migrationFile)
    const predecessorFiles = readdirSync(MIGRATIONS_DIR).filter((file) => {
      if (!file.endsWith(".sql") || file === migrationFile) {
        return false
      }

      return readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").includes(LIST_FUNCTION_MARKER)
    })

    expect(predecessorFiles).toHaveLength(2)
    for (const predecessorFile of predecessorFiles) {
      expect(migrationTimestamp).toBeGreaterThan(getMigrationTimestamp(predecessorFile))
    }
  })

  it("creates an immutable internal Unicode and Vietnamese normalization helper", () => {
    expect(migrationSource).toContain("BEGIN;")
    expect(migrationSource).toContain("COMMIT;")
    expect(normalizeBlock).toMatch(/_normalize_search_text\(\s*input TEXT\s*\)/)
    expect(normalizeBlock).toContain("RETURNS TEXT")
    expect(normalizeBlock).toContain("LANGUAGE sql")
    expect(normalizeBlock).toContain("IMMUTABLE")
    expect(normalizeBlock).toContain("PARALLEL SAFE")
    expect(normalizeBlock).toContain("SET search_path = public, pg_temp")
    expect(normalizeBlock).toContain("pg_catalog.normalize(input, 'NFC')")
    expect(normalizeBlock).toContain("pg_catalog.lower(")
    expect(normalizeBlock).toContain("pg_catalog.translate(")
    expect(normalizeBlock).toContain("đ")
    expect(normalizeBlock).toContain("pg_catalog.regexp_replace(")
    expect(normalizeBlock).toContain("[^[:alnum:]]+")
    expect(normalizeBlock).toContain("[[:space:]]+")
    expect(normalizeBlock).toContain("WHEN input IS NULL THEN NULL")

    expect(migrationSource).toMatch(
      /REVOKE ALL ON FUNCTION public\._normalize_search_text\(TEXT\)\s+FROM PUBLIC, anon, authenticated, service_role;/
    )
    expect(migrationSource).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\._normalize_search_text\(TEXT\)/
    )
  })

  it("atomically replaces the old signature with a backward-compatible fourth argument", () => {
    expect(migrationSource).toContain(
      "DROP FUNCTION public.technical_configuration_dossiers_list(INTEGER, INTEGER, BOOLEAN);"
    )
    expect(listBlock).toMatch(
      /technical_configuration_dossiers_list\(\s*p_page INTEGER DEFAULT 1,\s*p_page_size INTEGER DEFAULT 20,\s*p_include_archived BOOLEAN DEFAULT false,\s*p_search TEXT DEFAULT NULL\s*\)/
    )
    expect(listBlock).toContain("RETURNS JSONB")
    expect(listBlock).toContain("SECURITY DEFINER")
    expect(listBlock).toContain("SET search_path = public, pg_temp")
    expect(listBlock).toContain("PERFORM public._technical_configuration_require_global_user()")

    expect(migrationSource).toMatch(
      /REVOKE ALL ON FUNCTION public\.technical_configuration_dossiers_list\(\s*INTEGER, INTEGER, BOOLEAN, TEXT\s*\)\s+FROM PUBLIC, anon, authenticated, service_role;/
    )
    expect(migrationSource).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.technical_configuration_dossiers_list\(\s*INTEGER, INTEGER, BOOLEAN, TEXT\s*\)\s+TO authenticated;/
    )
    expect(migrationSource).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.technical_configuration_dossiers_list\(\s*INTEGER, INTEGER, BOOLEAN, TEXT\s*\)[\s\S]*TO service_role;/
    )
  })

  it("implements bounded literal all-token search with stable ranking and filtered totals", () => {
    expect(listBlock).toContain("pg_catalog.char_length(p_search) > 200")
    expect(listBlock).toContain("NULLIF(public._normalize_search_text(p_search), '')")
    expect(listBlock).toContain("SELECT DISTINCT token")
    expect(listBlock).toContain("pg_catalog.regexp_split_to_table")
    expect(listBlock.match(/public\._sanitize_ilike_pattern/g)?.length).toBeGreaterThanOrEqual(3)
    expect(listBlock).toContain("v_index_token TEXT")
    expect(listBlock).toContain("ORDER BY pg_catalog.char_length(token) DESC, token")
    expect(listBlock).toContain("candidate_ids AS MATERIALIZED")
    expect(listBlock).toContain("UNION")
    expect(listBlock).toContain("candidate_dossiers AS MATERIALIZED")
    expect(listBlock).toContain("FROM candidate_dossiers d")
    expect(listBlock).toContain("NOT EXISTS")
    expect(listBlock).toMatch(
      /public\._normalize_search_text\(d\.name\)\s+LIKE[\s\S]*public\._normalize_search_text\(d\.device_type_name\)\s+LIKE/
    )
    expect(listBlock).toContain("WHEN public._normalize_search_text(d.name) = v_normalized_search")
    expect(listBlock).toContain(
      "WHEN public._normalize_search_text(d.name) LIKE public._sanitize_ilike_pattern(v_normalized_search) || '%'"
    )
    expect(listBlock).toContain("search_rank")
    expect(listBlock).toMatch(
      /ORDER BY filtered\.search_rank,\s*filtered\.updated_at DESC,\s*filtered\.id/
    )
    expect(listBlock).toContain("SELECT count(*)")
    expect(listBlock).toContain("FROM filtered_dossiers")
  })

  it("preserves archive, pagination, payload, and set-based can-delete contracts", () => {
    expect(listBlock).toContain("p_include_archived OR d.archived_at IS NULL")
    expect(listBlock).toContain("LIMIT p_page_size")
    expect(listBlock).toContain("OFFSET (p_page - 1)::BIGINT * p_page_size")
    expect(listBlock).toContain("WITH search_tokens AS MATERIALIZED")
    expect(listBlock).toContain("dossier_page AS MATERIALIZED")
    expect(listBlock).toContain("locked_dossiers AS")
    expect(listBlock).toContain("LEFT JOIN locked_dossiers locked")
    expect(listBlock).toContain("'can_delete', p.can_delete")
    expect(listBlock).toContain("'page_size'")
  })

  it("adds both schema-qualified trigram expression indexes and performance coverage", () => {
    expect(migrationSource).toContain("technical_configuration_dossiers_name_search_trgm_idx")
    expect(migrationSource).toContain(
      "technical_configuration_dossiers_device_type_search_trgm_idx"
    )
    expect(migrationSource.match(/extensions\.gin_trgm_ops/g)).toHaveLength(2)
    expect(migrationSource.match(/public\._normalize_search_text\(/g)?.length).toBeGreaterThan(2)
    expect(migrationSource).toContain("One- and two-character tokens may use a sequential scan")

    const phaseGateSource = readIfExists(PHASE_GATE_PATH)
    expect(phaseGateSource).toContain("EXPLAIN (FORMAT JSON)")
    expect(phaseGateSource).toContain("technical_configuration_dossiers_name_search_trgm_idx")
    expect(phaseGateSource).toContain(
      "technical_configuration_dossiers_device_type_search_trgm_idx"
    )
  })

  it("ships and unconditionally registers the rollback-only runtime phase gate", () => {
    const phaseGateSource = readIfExists(PHASE_GATE_PATH)
    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("_normalize_search_text")
    expect(phaseGateSource).toContain("technical_configuration_dossiers_list")
    expect(phaseGateSource).toContain("has_function_privilege")
    expect(phaseGateSource).toContain("accent/case/Unicode/punctuation equivalence")
    expect(phaseGateSource).toContain("literal wildcard search")
    expect(phaseGateSource).toContain("filtered pagination")
    expect(phaseGateSource).toContain("fixture cleanup failed")

    const registry = JSON.parse(readFileSync(GATE_REGISTRY_PATH, "utf8")) as DatabaseGateRegistry
    expect(
      registry.tests.filter(
        (entry) =>
          entry.path === "supabase/tests/technical_configuration_dossier_search_phase_gate.sql"
      )
    ).toEqual([
      {
        evidence: ["OpenSpec add-technical-configuration-dossier-search Phase 2"],
        fixtureContract: "isolated-fixture",
        path: "supabase/tests/technical_configuration_dossier_search_phase_gate.sql",
        purpose: "phase-gate",
        runnerRequirements: ["psql"],
        safety: "default-safe",
        timeoutSeconds: 30,
        transactionContract: "rollback-required",
      },
    ])
  })

  it("updates the delete gate to resolve the new signature while retaining three-argument calls", () => {
    const deleteGateSource = readFileSync(DELETE_PHASE_GATE_PATH, "utf8")
    expect(deleteGateSource).toContain(
      "'public.technical_configuration_dossiers_list(integer,integer,boolean,text)'::regprocedure"
    )
    expect(deleteGateSource).toMatch(
      /public\.technical_configuration_dossiers_list\(1,\s*100,\s*true\)/
    )
  })
})
