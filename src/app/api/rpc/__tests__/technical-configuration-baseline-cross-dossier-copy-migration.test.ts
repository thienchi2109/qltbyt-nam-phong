import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { BASELINE_RPC_FUNCTIONS } from "@/lib/technical-configuration-baseline-rpcs"
import { ALLOWED_FUNCTIONS } from "@/app/api/rpc/[fn]/allowed-functions"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_SUFFIX = "_technical_configuration_baseline_cross_dossier_copy.sql"
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_baseline_cross_dossier_copy_phase_gate.sql"
)
const CONCURRENCY_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_baseline_cross_dossier_copy_concurrency_phase_gate.sql"
)
const REGISTRY_PATH = path.join(REPO_ROOT, "supabase/db-quality-gate-tests.json")

const RPCS = {
  sources: "technical_configuration_baseline_cross_dossier_sources_list",
  preview: "technical_configuration_baseline_cross_dossier_copy_preview",
  apply: "technical_configuration_baseline_cross_dossier_copy_apply",
} as const

const SIGNATURES = {
  sources: `${RPCS.sources}(UUID, TEXT, INTEGER, INTEGER)`,
  preview: `${RPCS.preview}(UUID, UUID, BIGINT, UUID, BIGINT)`,
  apply: `${RPCS.apply}(UUID, UUID, BIGINT, UUID, BIGINT, TEXT, BOOLEAN)`,
} as const

const LOCKED_TABLES = [
  "technical_configuration_baseline_versions",
  "technical_configuration_baseline_groups",
  "technical_configuration_baseline_subgroups",
  "technical_configuration_baseline_criteria",
  "technical_configuration_reference_products",
  "technical_configuration_reference_responses",
  "technical_configuration_baseline_documents",
  "technical_configuration_baseline_citations",
  "technical_configuration_reference_documents",
  "technical_configuration_reference_citations",
  "technical_configuration_suppliers",
  "technical_configuration_options",
  "technical_configuration_option_documents",
  "technical_configuration_comparison_sets",
  "technical_configuration_option_responses",
  "technical_configuration_option_citations",
  "technical_configuration_manual_assessments",
] as const

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

  const end = source.indexOf("\n$$;", start + marker.length)
  return end < 0 ? "" : source.slice(start, end + 4)
}

describe("technical configuration cross-dossier baseline copy migration", () => {
  const migrationSource = getMigrationSource()
  const sourcesBlock = getFunctionBlock(migrationSource, RPCS.sources)
  const previewBlock = getFunctionBlock(migrationSource, RPCS.preview)
  const applyBlock = getFunctionBlock(migrationSource, RPCS.apply)

  it("adds exactly one append-only migration after every lineage and copy predecessor", () => {
    const migrationFiles = getMigrationFiles()
    expect(migrationFiles).toHaveLength(1)

    const migrationFile = migrationFiles[0] ?? ""
    const predecessorFiles = readdirSync(MIGRATIONS_DIR).filter((file) => {
      if (!file.endsWith(".sql") || file === migrationFile) {
        return false
      }

      const source = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      return (
        source.includes("technical_configuration_baseline_versions_source_fkey") ||
        source.includes("CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_copy")
      )
    })

    expect(predecessorFiles.length).toBeGreaterThan(0)
    const migrationTimestamp = getMigrationTimestamp(migrationFile)
    for (const predecessorFile of predecessorFiles) {
      expect(migrationTimestamp).toBeGreaterThan(getMigrationTimestamp(predecessorFile))
    }
  })

  it("supersedes same-dossier lineage while requiring an immutable locked source", () => {
    expect(migrationSource).toContain(
      "DROP CONSTRAINT technical_configuration_baseline_versions_source_fkey"
    )
    expect(migrationSource).toMatch(
      /FOREIGN KEY \(source_baseline_version_id\)[\s\S]*REFERENCES public\.technical_configuration_baseline_versions \(id\)[\s\S]*ON DELETE RESTRICT/
    )
    expect(migrationSource).toContain("technical_configuration_baseline_validate_source_lineage")
    expect(migrationSource).toMatch(
      /source_baseline_version_id[\s\S]*status <> 'locked'[\s\S]*source_not_locked/
    )
  })

  it("freezes the exact source-list wire contract and bounded ordering", () => {
    expect(sourcesBlock).toMatch(
      /p_target_dossier_id UUID,\s*p_search TEXT DEFAULT NULL,\s*p_page INTEGER DEFAULT 1,\s*p_page_size INTEGER DEFAULT 20/
    )
    expect(sourcesBlock).toContain("RETURNS JSONB")
    expect(sourcesBlock).toContain("SECURITY DEFINER")
    expect(sourcesBlock).toContain("SET search_path = public, pg_temp")
    expect(sourcesBlock.indexOf("_technical_configuration_require_global_user")).toBeLessThan(
      sourcesBlock.indexOf("FROM public.technical_configuration_dossiers")
    )
    expect(sourcesBlock).toContain("p_page < 1")
    expect(sourcesBlock).toContain("p_page_size < 1 OR p_page_size > 100")
    expect(sourcesBlock).toContain("_sanitize_ilike_pattern")
    expect(sourcesBlock).toContain("v.status = 'locked'")
    expect(sourcesBlock).toContain("v.dossier_id <> p_target_dossier_id")
    expect(sourcesBlock).toMatch(
      /ORDER BY[\s\S]*e\.locked_at DESC[\s\S]*e\.dossier_name ASC[\s\S]*e\.version_number DESC[\s\S]*e\.baseline_version_id ASC/
    )
    for (const key of [
      "baseline_version_id",
      "dossier_id",
      "device_type_name",
      "dossier_name",
      "dossier_archived_at",
      "version_number",
      "locked_at",
      "main_section_count",
      "subgroup_count",
      "criterion_count",
      "total",
      "page",
      "page_size",
    ]) {
      expect(sourcesBlock).toContain(`'${key}'`)
    }
  })

  it("freezes preview pairing, response counts, read-only behavior, and fingerprint", () => {
    expect(previewBlock).toMatch(
      /p_source_baseline_version_id UUID,\s*p_target_dossier_id UUID,\s*p_expected_dossier_revision BIGINT,\s*p_expected_target_baseline_version_id UUID,\s*p_expected_target_baseline_revision BIGINT/
    )
    expect(previewBlock).toContain("_technical_configuration_require_global_user")
    expect(previewBlock).toMatch(
      /p_expected_target_baseline_version_id IS NULL[\s\S]*p_expected_target_baseline_revision IS NULL/
    )
    expect(previewBlock).toContain("validation_error")
    expect(previewBlock).toContain(
      "technical_configuration_internal.baseline_cross_dossier_preview"
    )
    expect(previewBlock).not.toMatch(/\bINSERT INTO\b|\bUPDATE\b|\bDELETE FROM\b/)

    for (const key of [
      "mode",
      "requires_replacement_confirmation",
      "preview_fingerprint",
      "source",
      "target",
      "copy_counts",
      "delete_counts",
      "preserved_counts",
      "main_sections",
      "subgroups",
      "criteria",
      "reference_products",
      "reference_responses",
      "baseline_documents",
      "baseline_citations",
      "reference_documents",
      "reference_citations",
      "option_responses",
      "option_citations",
      "manual_assessments",
      "suppliers",
      "options",
      "option_documents",
      "comparison_sets",
    ]) {
      expect(migrationSource).toContain(`'${key}'`)
    }
    expect(migrationSource).toContain("'cross-dossier-baseline-copy-v1'")
    expect(migrationSource).toContain("SET timezone = 'UTC'")
    expect(migrationSource).not.toContain("'source_dossier', to_jsonb")
    expect(migrationSource).toContain("encode(extensions.digest(convert_to(")
  })

  it("locks canonically, rejects stale previews, and copies the full baseline aggregate", () => {
    expect(applyBlock).toMatch(
      /p_source_baseline_version_id UUID,\s*p_target_dossier_id UUID,\s*p_expected_dossier_revision BIGINT,\s*p_expected_target_baseline_version_id UUID,\s*p_expected_target_baseline_revision BIGINT,\s*p_preview_fingerprint TEXT,\s*p_confirm_replace BOOLEAN/
    )
    expect(applyBlock).toContain("_technical_configuration_require_global_user")
    expect(applyBlock).toContain("_technical_configuration_require_editable_dossier(")
    expect(applyBlock).toMatch(
      /p_source_baseline_version_id IS NULL OR p_target_dossier_id IS NULL[\s\S]*p_expected_dossier_revision IS NULL/
    )

    let previousOffset = applyBlock.indexOf("_technical_configuration_require_editable_dossier(")
    for (const table of LOCKED_TABLES) {
      const marker = `LOCK TABLE public.${table} IN SHARE ROW EXCLUSIVE MODE NOWAIT`
      const offset = applyBlock.indexOf(marker)
      expect(offset, table).toBeGreaterThan(previousOffset)
      previousOffset = offset
    }

    expect(applyBlock).toContain("WHEN lock_not_available THEN")
    expect(applyBlock).toContain("RAISE EXCEPTION 'concurrent_write_retry' USING ERRCODE = 'PT409'")
    expect(applyBlock).toContain("replacement_confirmation_needed")
    expect(applyBlock).toContain("stale_preview")
    expect(migrationSource).toContain("target_draft_changed")
    expect(migrationSource).toContain("technical_configuration_baseline_group_copy_map")
    expect(migrationSource).toContain("technical_configuration_baseline_subgroup_copy_map")
    expect(migrationSource).toContain("technical_configuration_baseline_criterion_copy_map")
    expect(migrationSource).toContain("technical_configuration_reference_product_copy_map")
    expect(migrationSource).toContain("technical_configuration_baseline_document_copy_map")
    expect(migrationSource).toContain("technical_configuration_reference_document_copy_map")
    expect(migrationSource).toContain("source_criterion_id")
    expect(migrationSource).toContain("next_criterion_number")
    expect(migrationSource).not.toContain(
      "substring(c.criterion_code FROM '^TC-([0-9]+)$')::BIGINT"
    )

    for (const table of [
      "technical_configuration_option_responses",
      "technical_configuration_option_citations",
      "technical_configuration_manual_assessments",
    ]) {
      expect(applyBlock).toContain(`DELETE FROM public.${table}`)
    }
    for (const table of [
      "technical_configuration_suppliers",
      "technical_configuration_options",
      "technical_configuration_option_documents",
      "technical_configuration_comparison_sets",
    ]) {
      expect(applyBlock).not.toContain(`DELETE FROM public.${table}`)
      expect(applyBlock).not.toContain(`INSERT INTO public.${table}`)
    }
  })

  it("uses authenticated-only execute grants and stable contract errors", () => {
    expect(migrationSource).toContain(
      "REVOKE ALL ON SCHEMA technical_configuration_internal FROM PUBLIC"
    )

    for (const signature of Object.values(SIGNATURES)) {
      expect(migrationSource).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${signature} FROM PUBLIC`
      )
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM anon, authenticated, service_role`
      )
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated`
      )
    }

    for (const error of [
      "validation_error",
      "not_found",
      "source_not_locked",
      "source_matches_target_dossier",
      "dossier_archived",
      "stale_revision",
      "target_draft_changed",
      "stale_preview",
      "concurrent_write_retry",
      "replacement_confirmation_needed",
    ]) {
      expect(migrationSource).toContain(error)
    }
  })

  it("allowlists the dormant backend contract without adding a UI caller", () => {
    expect(BASELINE_RPC_FUNCTIONS).toMatchObject({
      listCrossDossierSources: RPCS.sources,
      previewCrossDossierCopy: RPCS.preview,
      applyCrossDossierCopy: RPCS.apply,
    })
    for (const rpc of Object.values(RPCS)) {
      expect(ALLOWED_FUNCTIONS.has(rpc)).toBe(true)
    }
  })

  it("ships registered functional and two-session rollback gates", () => {
    const phaseGateSource = readIfExists(PHASE_GATE_PATH)
    const concurrencyGateSource = readIfExists(CONCURRENCY_GATE_PATH)
    const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as {
      tests: Array<{ path: string; purpose: string; runnerRequirements: string[] }>
    }

    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("archived locked source")
    expect(phaseGateSource).toContain("replacement_confirmation_needed")
    expect(phaseGateSource).toContain("stale_preview")
    expect(phaseGateSource).toContain("source_matches_target_dossier")
    expect(phaseGateSource).toContain("atomic rollback")
    expect(phaseGateSource).toContain("same-dossier compatibility")

    expect(concurrencyGateSource).toContain("concurrent_write_retry")
    expect(concurrencyGateSource).toContain("writer-first")
    expect(concurrencyGateSource).toContain("apply-first")
    expect(concurrencyGateSource).toContain("no partial mutation")
    expect(concurrencyGateSource).toContain("no deadlock wait-cycle")
    expect(concurrencyGateSource.match(/v_observed_session_a BOOLEAN := false/g)).toHaveLength(2)
    expect(concurrencyGateSource).not.toContain("IF v_attempt = 600 THEN")

    expect(registry.tests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: path.relative(REPO_ROOT, PHASE_GATE_PATH),
          purpose: "phase-gate",
        }),
        expect.objectContaining({
          path: path.relative(REPO_ROOT, CONCURRENCY_GATE_PATH),
          purpose: "concurrency",
          runnerRequirements: expect.arrayContaining(["psql", "multi-session"]),
        }),
      ])
    )
  })
})
