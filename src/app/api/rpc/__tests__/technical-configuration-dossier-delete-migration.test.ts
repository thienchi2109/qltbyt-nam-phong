import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_SUFFIX = "_technical_configuration_dossier_delete.sql"
const PHASE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_delete_phase_gate.sql"
)
const CONCURRENCY_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql"
)
const ALLOWED_FUNCTIONS_PATH = path.join(REPO_ROOT, "src/app/api/rpc/[fn]/allowed-functions.ts")
const RPC_MANIFESTS_DIR = path.join(REPO_ROOT, "src/lib")
const DELETE_RPC_NAME = "technical_configuration_dossiers_delete"
const LIST_PREDECESSOR_MIGRATION = "20260712112500_technical_configuration_dossier_foundation.sql"
const ORDERING_MARKERS = [
  "CREATE OR REPLACE FUNCTION public.technical_configuration_dossiers_list",
  "CREATE OR REPLACE FUNCTION public._technical_configuration_require_editable_dossier",
  "CREATE OR REPLACE FUNCTION public._technical_configuration_require_editable_baseline_version",
  "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_lock",
] as const

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function getDeleteMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(MIGRATION_SUFFIX))
    .sort()
}

function getDeleteMigrationSource(): string {
  const migrationFile = getDeleteMigrationFiles()[0]
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

describe("technical configuration dossier P15A delete migration", () => {
  const migrationSource = getDeleteMigrationSource()
  const deleteBlock = getFunctionBlock(migrationSource, DELETE_RPC_NAME)
  const listBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_list")

  it("adds one migration after every local list, guard, and baseline-lock predecessor", () => {
    const migrationFiles = getDeleteMigrationFiles()
    expect(migrationFiles).toHaveLength(1)

    const migrationFile = migrationFiles[0] ?? ""
    const predecessorFiles = readdirSync(MIGRATIONS_DIR).filter((file) => {
      if (!file.endsWith(".sql") || file === migrationFile) {
        return false
      }

      const source = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      return ORDERING_MARKERS.some((marker) => source.includes(marker))
    })

    expect(predecessorFiles.length).toBeGreaterThan(0)
    const migrationTimestamp = getMigrationTimestamp(migrationFile)
    for (const predecessorFile of predecessorFiles) {
      expect(migrationTimestamp).toBeGreaterThan(getMigrationTimestamp(predecessorFile))
    }
  })

  it("documents the forward-only rollback source for the replaced list RPC", () => {
    expect(migrationSource).toContain(`-- ${LIST_PREDECESSOR_MIGRATION}`)
    expect(migrationSource).toContain(
      "DROP FUNCTION public.technical_configuration_dossiers_delete(UUID, BIGINT)"
    )
  })

  it("creates the exact dormant delete RPC with the fixed payload and security boundary", () => {
    expect(migrationSource).toContain("BEGIN;")
    expect(migrationSource).toContain("COMMIT;")
    expect(deleteBlock).toMatch(
      /technical_configuration_dossiers_delete\(\s*p_id UUID,\s*p_expected_revision BIGINT\s*\)/
    )
    expect(deleteBlock).toContain("RETURNS JSONB")
    expect(deleteBlock).toContain("SECURITY DEFINER")
    expect(deleteBlock).toContain("SET search_path = public, pg_temp")
    expect(deleteBlock).toMatch(
      /RETURN jsonb_build_object\(\s*'data',\s*jsonb_build_object\(\s*'id',\s*v_deleted_id\s*\)\s*\);/
    )

    expect(migrationSource).toMatch(
      /REVOKE ALL ON FUNCTION public\.technical_configuration_dossiers_delete\(UUID, BIGINT\)\s+FROM PUBLIC, anon, authenticated, service_role;/
    )
    expect(migrationSource).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.technical_configuration_dossiers_delete\(UUID, BIGINT\)\s+TO authenticated;/
    )
    expect(migrationSource).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.technical_configuration_dossiers_delete\(UUID, BIGINT\)[\s\S]*TO service_role;/
    )
  })

  it("serializes dossier-row-first and rejects locked history before one root delete", () => {
    const guardIndex = deleteBlock.indexOf(
      "PERFORM public._technical_configuration_require_editable_dossier("
    )
    const lockedHistoryIndex = deleteBlock.indexOf(
      "FROM public.technical_configuration_baseline_versions"
    )
    const deleteIndex = deleteBlock.indexOf("DELETE FROM public.technical_configuration_dossiers")

    expect(guardIndex).toBeGreaterThanOrEqual(0)
    expect(lockedHistoryIndex).toBeGreaterThan(guardIndex)
    expect(deleteIndex).toBeGreaterThan(lockedHistoryIndex)
    expect(deleteBlock).toMatch(
      /IF EXISTS \([\s\S]*v\.dossier_id = p_id[\s\S]*v\.status = 'locked'[\s\S]*\) THEN/
    )
    expect(deleteBlock).toContain("RAISE EXCEPTION 'locked_dossier' USING ERRCODE = 'PT409';")
    expect(deleteBlock.match(/\bDELETE FROM\b/g)).toHaveLength(1)
    expect(deleteBlock).not.toMatch(
      /DELETE FROM public\.technical_configuration_(baseline|comparison|manual|option|reference|supplier)/
    )
  })

  it("adds non-null can_delete with set-based locked-history existence logic", () => {
    expect(listBlock).toContain("WITH dossier_page AS MATERIALIZED")
    expect(listBlock).toContain("locked_dossiers AS")
    expect(listBlock).toMatch(
      /JOIN dossier_page page\s+ON page\.id = v\.dossier_id[\s\S]*WHERE v\.status = 'locked'/
    )
    expect(listBlock).toContain("LEFT JOIN locked_dossiers locked")
    expect(listBlock).toMatch(
      /page\.archived_at IS NULL\s+AND locked\.dossier_id IS NULL[\s\S]*AS can_delete/
    )
    expect(listBlock).toContain("'can_delete', p.can_delete")
    expect(listBlock).not.toContain("technical_configuration_baseline_versions_list")
  })

  it("activates the delete RPC only through the canonical module aggregate", () => {
    const allowedFunctionsSource = readFileSync(ALLOWED_FUNCTIONS_PATH, "utf8")
    expect(allowedFunctionsSource).toContain(
      'import { TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES } from "@/lib/technical-configuration-rpcs"'
    )
    expect(allowedFunctionsSource).toContain("...TECHNICAL_CONFIGURATION_RPC_FUNCTION_NAMES")

    const manifestFiles = readdirSync(RPC_MANIFESTS_DIR).filter(
      (file) => file.startsWith("technical-configuration") && file.endsWith("-rpcs.ts")
    )
    expect(manifestFiles.length).toBeGreaterThan(0)

    const owningManifests = manifestFiles.filter((manifestFile) =>
      readFileSync(path.join(RPC_MANIFESTS_DIR, manifestFile), "utf8").includes(DELETE_RPC_NAME)
    )
    expect(owningManifests).toEqual(["technical-configuration-dossier-rpcs.ts"])
  })

  it("ships rollback-only runtime and two-session concurrency gates", () => {
    const phaseGateSource = readIfExists(PHASE_GATE_PATH)
    const concurrencyGateSource = readIfExists(CONCURRENCY_GATE_PATH)

    expect(phaseGateSource).toContain("BEGIN;")
    expect(phaseGateSource).toContain("ROLLBACK;")
    expect(phaseGateSource).toContain("locked_dossier")
    expect(phaseGateSource).toContain("can_delete")
    expect(phaseGateSource).toContain(DELETE_RPC_NAME)
    expect(phaseGateSource).toContain("pg_get_functiondef(")
    expect(phaseGateSource).toContain("CREATE FUNCTION pg_temp.expect_list_can_delete")
    expect(phaseGateSource).toContain("WITH dossier_page AS MATERIALIZED")
    expect(phaseGateSource).toContain("JOIN dossier_page page")
    expect(phaseGateSource).toContain("ON page.id = v.dossier_id")
    expect(phaseGateSource).toContain("list presence failed: % missing")
    expect(phaseGateSource).toContain("'draft dossier'")
    expect(phaseGateSource).toContain("'locked dossier'")
    expect(phaseGateSource).toContain("'archived dossier'")
    expect(phaseGateSource).toContain(`'$.**."Parent Relationship" ? (@ == "SubPlan")'`)
    expect(phaseGateSource).toContain(`'$.**."CTE Name" ? (@ == "dossier_page")'`)
    expect(phaseGateSource).not.toContain(`'$.**."Join Type" ? (@ == "Left")'`)
    expect(phaseGateSource).not.toMatch(
      /INSERT INTO public\.technical_configuration_suppliers\s*\([^)]*\bnormalized_name\b/
    )

    expect(concurrencyGateSource).toContain("CREATE FUNCTION pg_temp.seed_concurrency_aggregate")
    expect(concurrencyGateSource).toContain("delete-first")
    expect(concurrencyGateSource).toContain("lock-first")
    expect(concurrencyGateSource).toContain("PT404")
    expect(concurrencyGateSource).toContain("PT409")
    expect(concurrencyGateSource.match(/'55P03'/g)).toHaveLength(2)
    expect(concurrencyGateSource.match(/'lock_timeout'/g)).toHaveLength(4)
    expect(concurrencyGateSource).not.toContain("FOR UPDATE;")
    expect(concurrencyGateSource.match(/pg_advisory_xact_lock/g)).toHaveLength(2)
    expect(concurrencyGateSource.match(/pg_try_advisory_lock/g)).toHaveLength(2)
    expect(concurrencyGateSource.match(/pg_advisory_unlock/g)).toHaveLength(2)
    expect(concurrencyGateSource.match(/FOR v_attempt IN 1\.\.600 LOOP/g)).toHaveLength(2)
    expect(concurrencyGateSource).toMatch(
      /DELETE-FIRST \/ SESSION A[\s\S]*technical_configuration_dossiers_delete\(v_dossier_id, 1\);[\s\S]*pg_advisory_xact_lock/
    )
    expect(concurrencyGateSource).toMatch(
      /LOCK-FIRST \/ SESSION A[\s\S]*technical_configuration_baseline_lock\(v_version_id, 1\);[\s\S]*pg_advisory_xact_lock/
    )
    expect(concurrencyGateSource).toMatch(
      /DELETE-FIRST ASSERT[\s\S]*technical_configuration_baseline_groups[\s\S]*technical_configuration_baseline_criteria/
    )
    expect(concurrencyGateSource).toMatch(
      /LOCK-FIRST ASSERT[\s\S]*technical_configuration_baseline_groups[\s\S]*technical_configuration_baseline_criteria/
    )
    expect(concurrencyGateSource).toMatch(
      /-- CLEANUP:[\s\S]*technical_configuration_dossiers[\s\S]*technical_configuration_baseline_versions[\s\S]*technical_configuration_baseline_groups[\s\S]*technical_configuration_baseline_criteria/
    )
    expect(concurrencyGateSource).toContain("cleanup failed: fixture residue remains")
  })
})
