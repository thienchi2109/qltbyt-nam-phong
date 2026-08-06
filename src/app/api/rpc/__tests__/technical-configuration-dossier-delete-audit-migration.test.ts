import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const REPO_ROOT = process.cwd()
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase/migrations")
const MIGRATION_FILE = "20260806031201_technical_configuration_dossier_delete_audit.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const MIGRATION_MARKER = "-- P15A2: dossier hard-delete audit hardening"
const AUDIT_HELPER_PREDECESSOR = "2025-09-29/20250925_audit_logs_v2_entities_and_helper.sql"
const AUDIT_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_delete_audit_phase_gate.sql"
)
const AUDIT_FAILURE_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_delete_audit_failure_phase_gate.sql"
)
const CONCURRENCY_GATE_PATH = path.join(
  REPO_ROOT,
  "supabase/tests/technical_configuration_dossier_delete_concurrency_phase_gate.sql"
)
const DELETE_RPC_NAME = "technical_configuration_dossiers_delete"
const ORDERING_MARKERS = [
  `CREATE OR REPLACE FUNCTION public.${DELETE_RPC_NAME}`,
  "CREATE OR REPLACE FUNCTION public._technical_configuration_require_editable_dossier",
  "CREATE OR REPLACE FUNCTION public._technical_configuration_require_editable_baseline_version",
  "CREATE OR REPLACE FUNCTION public.technical_configuration_baseline_lock",
  "CREATE OR REPLACE FUNCTION public.audit_log(",
] as const
const AUDIT_HELPER_SIGNATURE =
  /CREATE OR REPLACE FUNCTION public\.audit_log\(\s*p_action_type TEXT,\s*p_entity_type TEXT DEFAULT NULL(?:::TEXT)?,\s*p_entity_id BIGINT DEFAULT NULL(?:::BIGINT)?,\s*p_entity_label TEXT DEFAULT NULL(?:::TEXT)?,\s*p_action_details JSONB DEFAULT NULL(?:::JSONB)?\s*\)/

function readIfExists(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
}

function listMigrationFiles(directory = MIGRATIONS_DIR): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      return listMigrationFiles(absolutePath)
    }

    return entry.name.endsWith(".sql")
      ? [path.relative(MIGRATIONS_DIR, absolutePath).split(path.sep).join("/")]
      : []
  })
}

function getMigrationTimestamp(filePath: string): number {
  const match = /^(\d{8}|\d{14})_/.exec(path.basename(filePath))
  if (!match) {
    throw new Error(`Migration file lacks a timestamp prefix: ${filePath}`)
  }

  return Number(match[1].length === 8 ? `${match[1]}000000` : match[1])
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

describe("technical configuration dossier P15A2 delete audit migration", () => {
  const migrationSource = readIfExists(MIGRATION_PATH)
  const deleteBlock = getFunctionBlock(migrationSource, DELETE_RPC_NAME)

  it("adds one correctly ordered audit-hardening migration", () => {
    const migrationFiles = listMigrationFiles()
    const matchingFiles = migrationFiles
      .filter((file) => file.endsWith("_technical_configuration_dossier_delete_audit.sql"))
      .sort()

    expect(matchingFiles).toEqual([MIGRATION_FILE])
    expect(migrationSource).toContain(MIGRATION_MARKER)

    const predecessorFiles = migrationFiles.filter((file) => {
      if (file === MIGRATION_FILE) {
        return false
      }

      const source = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8")
      return ORDERING_MARKERS.some((marker) => source.includes(marker))
    })

    expect(predecessorFiles.length).toBeGreaterThan(0)
    expect(predecessorFiles).toContain(AUDIT_HELPER_PREDECESSOR)
    expect(readFileSync(path.join(MIGRATIONS_DIR, AUDIT_HELPER_PREDECESSOR), "utf8")).toMatch(
      AUDIT_HELPER_SIGNATURE
    )
    const migrationTimestamp = getMigrationTimestamp(MIGRATION_FILE)
    for (const predecessorFile of predecessorFiles) {
      expect(migrationTimestamp).toBeGreaterThan(getMigrationTimestamp(predecessorFile))
    }
  })

  it("preserves the P15A signature, response, security boundary, and grants", () => {
    expect(migrationSource).toContain("BEGIN;")
    expect(migrationSource).toContain("COMMIT;")
    expect(deleteBlock).toMatch(
      /CREATE OR REPLACE FUNCTION public\.technical_configuration_dossiers_delete\(\s*p_id UUID,\s*p_expected_revision BIGINT\s*\)/
    )
    expect(deleteBlock).toContain("RETURNS JSONB")
    expect(deleteBlock).toContain("LANGUAGE plpgsql")
    expect(deleteBlock).toContain("SECURITY DEFINER")
    expect(deleteBlock).toContain("SET search_path = public, pg_temp")
    expect(deleteBlock).toContain(
      "PERFORM public._technical_configuration_require_editable_dossier("
    )
    expect(deleteBlock).toContain("RAISE EXCEPTION 'locked_dossier' USING ERRCODE = 'PT409';")
    expect(deleteBlock).toContain(
      "RETURN jsonb_build_object(\n    'data',\n    jsonb_build_object("
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

  it("audits the locked root snapshot after guards and before one root delete", () => {
    const guardIndex = deleteBlock.indexOf(
      "PERFORM public._technical_configuration_require_editable_dossier("
    )
    const lockedHistoryIndex = deleteBlock.indexOf("IF EXISTS (")
    const snapshotIndex = deleteBlock.indexOf("SELECT\n    d.id,")
    const auditIndex = deleteBlock.indexOf("v_audit_ok := public.audit_log(")
    const failClosedIndex = deleteBlock.indexOf("IF v_audit_ok IS DISTINCT FROM TRUE THEN")
    const deleteIndex = deleteBlock.indexOf("DELETE FROM public.technical_configuration_dossiers d")

    expect(guardIndex).toBeGreaterThanOrEqual(0)
    expect(lockedHistoryIndex).toBeGreaterThan(guardIndex)
    expect(snapshotIndex).toBeGreaterThan(lockedHistoryIndex)
    expect(auditIndex).toBeGreaterThan(snapshotIndex)
    expect(failClosedIndex).toBeGreaterThan(auditIndex)
    expect(deleteIndex).toBeGreaterThan(failClosedIndex)
    expect(deleteBlock.match(/\bDELETE FROM\b/g)).toHaveLength(1)

    expect(deleteBlock).toContain("'technical_configuration_dossier_delete'")
    expect(deleteBlock).toContain("'technical_configuration_dossier'")
    expect(deleteBlock).toContain(
      `v_audit_ok := public.audit_log(
    'technical_configuration_dossier_delete',
    'technical_configuration_dossier',
    NULL::BIGINT,
    v_dossier.name,
    jsonb_build_object(
      'dossier_id', v_dossier.id,
      'device_type_name', v_dossier.device_type_name,
      'name', v_dossier.name,
      'description', v_dossier.description,
      'revision', v_dossier.revision,
      'delete_kind', 'hard'
    )
  );`
    )
    expect(deleteBlock).toContain("RAISE EXCEPTION 'audit_log_failed' USING ERRCODE = 'PT500';")
  })

  it("ships a rollback-only success audit gate without replacing shared helpers", () => {
    const successGateSource = readIfExists(AUDIT_GATE_PATH)

    expect(successGateSource).toContain("EXPLICIT LIVE DB WRITE APPROVAL REQUIRED")
    expect(successGateSource).toContain("BEGIN;")
    expect(successGateSource).toContain("ROLLBACK;")
    expect(successGateSource).not.toContain("COMMIT;")
    expect(successGateSource).toContain("technical_configuration_dossier_delete")
    expect(successGateSource).toContain("technical_configuration_dossier")
    expect(successGateSource).toContain("al.action_details = jsonb_build_object(")
    expect(successGateSource).not.toMatch(/\bCREATE(?: OR REPLACE)? FUNCTION\b/)
    expect(successGateSource).not.toContain("RETURN FALSE;")
    expect(successGateSource).not.toContain("forced audit failure")
  })

  it("ships the helper-replacement failure proof as an isolated rollback-only gate", () => {
    const failureGateSource = readIfExists(AUDIT_FAILURE_GATE_PATH)

    expect(failureGateSource).toContain("ISOLATED DATABASE ONLY")
    expect(failureGateSource).toContain("DO NOT RUN ON LIVE DB")
    expect(failureGateSource).toContain("BEGIN;")
    expect(failureGateSource).toContain("ROLLBACK;")
    expect(failureGateSource).not.toContain("COMMIT;")
    expect(failureGateSource).toContain("CREATE OR REPLACE FUNCTION public.audit_log(")
    expect(failureGateSource).toContain("RETURN FALSE;")
    expect(failureGateSource).toContain("audit_log_failed")
    expect(failureGateSource).toContain("PT500")
    expect(failureGateSource).toContain("forced audit failure preserved dossier aggregate")
    expect(failureGateSource).toContain("forced audit failure created no audit row")
  })

  it("updates the two-session gate to assert and clean audit evidence", () => {
    const gateSource = readIfExists(CONCURRENCY_GATE_PATH)

    expect(gateSource).toContain("P15A2 audit-aware concurrency")
    expect(gateSource).toContain("technical_configuration_dossier_delete")
    expect(gateSource).toContain("action_details->>'dossier_id'")
    expect(gateSource).toContain("delete-first produced exactly one delete audit")
    expect(gateSource).toContain("lock-first produced no delete audit")
    expect(gateSource).toMatch(/DELETE FROM public\.audit_logs[\s\S]*action_details->>'dossier_id'/)
    expect(gateSource).toContain("audit residue")
  })
})
