import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATION_MARKER = "technical_configuration_dossier_foundation"

const PUBLIC_RPC_SIGNATURES = [
  "technical_configuration_dossiers_list(INTEGER, INTEGER, BOOLEAN)",
  "technical_configuration_dossiers_get(UUID)",
  "technical_configuration_dossiers_create(TEXT, TEXT, TEXT, BIGINT)",
  "technical_configuration_dossiers_update(UUID, TEXT, TEXT, TEXT, BIGINT)",
  "technical_configuration_dossiers_archive(UUID, BIGINT)",
] as const

function getMigrationSource() {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations")
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.includes(MIGRATION_MARKER) && file.endsWith(".sql"))
    .sort()

  expect(migrationFiles).toEqual(["20260712112500_technical_configuration_dossier_foundation.sql"])

  const migrationFile = migrationFiles[0]
  return migrationFile ? readFileSync(path.join(migrationsDir, migrationFile), "utf8") : ""
}

function getFunctionBlock(migrationSource: string, functionName: string) {
  const marker = `CREATE OR REPLACE FUNCTION public.${functionName}`
  const start = migrationSource.indexOf(marker)
  expect(start, `Missing ${functionName}`).toBeGreaterThanOrEqual(0)

  const next = migrationSource.indexOf(
    "\nCREATE OR REPLACE FUNCTION public.",
    start + marker.length
  )
  return migrationSource.slice(start, next === -1 ? migrationSource.length : next)
}

describe("technical configuration dossier foundation migration", () => {
  it("creates one standalone dossier lineage root with the frozen columns", () => {
    const migrationSource = getMigrationSource()

    expect(migrationSource).toContain("CREATE TABLE public.technical_configuration_dossiers")
    expect(migrationSource).toMatch(/id UUID PRIMARY KEY DEFAULT gen_random_uuid\(\)/)
    expect(migrationSource).toMatch(/device_type_name TEXT NOT NULL/)
    expect(migrationSource).toMatch(/name TEXT NOT NULL/)
    expect(migrationSource).toMatch(/description TEXT/)
    expect(migrationSource).toMatch(/revision BIGINT NOT NULL DEFAULT 1/)
    expect(migrationSource).toMatch(/archived_at TIMESTAMPTZ/)
    expect(migrationSource).toMatch(/archived_by BIGINT/)
    expect(migrationSource).toMatch(/created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/)
    expect(migrationSource).toMatch(/created_by BIGINT NOT NULL/)
    expect(migrationSource).toMatch(/updated_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/)
    expect(migrationSource).toMatch(/updated_by BIGINT NOT NULL/)
    expect(migrationSource).toContain("CHECK (btrim(device_type_name) <> '')")
    expect(migrationSource).toContain("CHECK (btrim(name) <> '')")
    expect(migrationSource).toContain("CHECK (revision > 0)")
    expect(migrationSource).not.toMatch(/technical_configuration_lineages?/i)
    expect(migrationSource).not.toMatch(/REFERENCES public\.thiet_bi/i)
    expect(migrationSource).not.toMatch(/CREATE TABLE[^;]*\bai_/i)
  })

  it("uses only indexes justified by active and inclusive dossier lists", () => {
    const migrationSource = getMigrationSource()

    expect(migrationSource).toContain("technical_configuration_dossiers_active_list_idx")
    expect(migrationSource).toContain(
      "ON public.technical_configuration_dossiers (updated_at DESC, id)"
    )
    expect(migrationSource).toContain("WHERE archived_at IS NULL")
    expect(migrationSource).toContain("technical_configuration_dossiers_all_list_idx")
  })

  it("denies direct Data API access and exposes only guarded authenticated RPCs", () => {
    const migrationSource = getMigrationSource()

    expect(migrationSource).toContain(
      "ALTER TABLE public.technical_configuration_dossiers ENABLE ROW LEVEL SECURITY;"
    )
    expect(migrationSource).toContain(
      "CREATE POLICY technical_configuration_dossiers_no_client_access"
    )
    expect(migrationSource).toContain("USING (false)")
    expect(migrationSource).toContain("WITH CHECK (false)")
    expect(migrationSource).toContain(
      "REVOKE ALL ON TABLE public.technical_configuration_dossiers FROM PUBLIC, anon, authenticated;"
    )
    expect(migrationSource).toContain(
      "GRANT ALL ON TABLE public.technical_configuration_dossiers TO service_role;"
    )

    for (const signature of PUBLIC_RPC_SIGNATURES) {
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role;`
      )
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated;`
      )
    }

    const dossierRpcGrantStatements =
      migrationSource.match(
        /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.technical_configuration_dossiers_[\s\S]*?;/gi
      ) ?? []
    expect(dossierRpcGrantStatements).toHaveLength(PUBLIC_RPC_SIGNATURES.length)
    for (const grantStatement of dossierRpcGrantStatements) {
      expect(grantStatement).not.toMatch(/\bservice_role\b/i)
    }

    expect(migrationSource).not.toMatch(
      /GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*technical_configuration_dossiers[^;]*authenticated/i
    )
  })

  it("pins SECURITY DEFINER search paths and fail-closes global authorization", () => {
    const migrationSource = getMigrationSource()
    const guardedFunctions = [
      "_technical_configuration_require_global_user",
      "_technical_configuration_require_editable_dossier",
      "technical_configuration_dossiers_list",
      "technical_configuration_dossiers_get",
      "technical_configuration_dossiers_create",
      "technical_configuration_dossiers_update",
      "technical_configuration_dossiers_archive",
    ]

    for (const functionName of guardedFunctions) {
      const functionBlock = getFunctionBlock(migrationSource, functionName)
      expect(functionBlock).toContain("SECURITY DEFINER")
      expect(functionBlock).toContain("SET search_path = public, pg_temp")
    }

    const authBlock = getFunctionBlock(
      migrationSource,
      "_technical_configuration_require_global_user"
    )
    expect(authBlock).toContain("current_setting('request.jwt.claims', true)")
    expect(authBlock).toContain("NULLIF(v_claims->>'user_id', '')::BIGINT")
    expect(authBlock).toContain("v_role IN ('global', 'admin')")
    expect(authBlock).toContain("RAISE EXCEPTION 'permission_denied'")
    expect(authBlock).toContain("USING ERRCODE = '42501'")

    expect(migrationSource).toMatch(
      /REVOKE ALL ON FUNCTION public\._technical_configuration_require_global_user\(\)\s+FROM PUBLIC, anon, authenticated;/
    )
    expect(migrationSource).toMatch(
      /REVOKE ALL ON FUNCTION public\._technical_configuration_require_editable_dossier\(UUID, BIGINT\)\s+FROM PUBLIC, anon, authenticated;/
    )
  })

  it("returns bounded snake_case list responses and hides archived dossiers by default", () => {
    const migrationSource = getMigrationSource()
    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_list")

    expect(listBlock).toContain("p_page INTEGER DEFAULT 1")
    expect(listBlock).toContain("p_page_size INTEGER DEFAULT 20")
    expect(listBlock).toContain("p_include_archived BOOLEAN DEFAULT false")
    expect(listBlock).toContain("p_page IS NULL")
    expect(listBlock).toContain("p_page_size IS NULL")
    expect(listBlock).toContain("p_page < 1")
    expect(listBlock).toContain("p_page_size < 1")
    expect(listBlock).toContain("p_page_size > 100")
    expect(listBlock).toContain("p_include_archived OR d.archived_at IS NULL")
    expect(listBlock).not.toContain("filtered AS MATERIALIZED")
    expect(listBlock).toContain("ORDER BY d.updated_at DESC, d.id")
    expect(listBlock).toContain("LIMIT p_page_size")
    expect(listBlock).toContain("OFFSET (p_page - 1)::BIGINT * p_page_size")
    expect(listBlock).toMatch(
      /'total',\s+\(\s*SELECT count\(\*\)\s+FROM public\.technical_configuration_dossiers d\s+WHERE p_include_archived OR d\.archived_at IS NULL\s*\)/
    )
    expect(listBlock).toMatch(/'page_size',\s+p_page_size/)
    expect(listBlock).toContain("'total'")
    expect(listBlock).toContain("'data'")
    expect(listBlock).not.toMatch(/SELECT\s+\*/i)
  })

  it("uses the frozen validation error for invalid pagination and required text fields", () => {
    const migrationSource = getMigrationSource()
    const listBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_list")
    const createBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_create")
    const updateBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_update")

    expect(listBlock).toContain("RAISE EXCEPTION 'validation_error'")
    expect(listBlock).toContain("USING ERRCODE = 'PT422'")

    for (const functionBlock of [createBlock, updateBlock]) {
      expect(functionBlock).toContain("p_device_type_name IS NULL")
      expect(functionBlock).toContain("btrim(p_device_type_name) = ''")
      expect(functionBlock).toContain("p_name IS NULL")
      expect(functionBlock).toContain("btrim(p_name) = ''")
      expect(functionBlock).toContain("RAISE EXCEPTION 'validation_error'")
      expect(functionBlock).toContain("USING ERRCODE = 'PT422'")
    }
  })

  it("keeps archived dossiers readable through get without exposing unauthorized data", () => {
    const migrationSource = getMigrationSource()
    const getBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_get")

    expect(getBlock).toContain("PERFORM public._technical_configuration_require_global_user()")
    expect(getBlock).toContain("WHERE d.id = p_id")
    expect(getBlock).not.toContain("archived_at IS NULL")
    expect(getBlock).toContain("RAISE EXCEPTION 'not_found'")
    expect(getBlock).toContain("USING ERRCODE = 'PT404'")
    expect(getBlock).not.toMatch(/SELECT\s+\*/i)
  })

  it("requires create revision zero and returns the first persisted revision", () => {
    const migrationSource = getMigrationSource()
    const createBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_create")

    expect(createBlock).toContain("p_expected_revision BIGINT")
    expect(createBlock).toContain("p_expected_revision IS DISTINCT FROM 0")
    expect(createBlock).toContain("RAISE EXCEPTION 'stale_revision'")
    expect(createBlock).toContain("USING ERRCODE = 'PT409'")
    expect(createBlock).toContain("btrim(p_device_type_name)")
    expect(createBlock).toContain("btrim(p_name)")
    expect(createBlock).toContain("NULLIF(btrim(p_description), '')")
    expect(createBlock).toContain("revision")
    expect(createBlock).toContain("1")
    expect(createBlock).toContain("'data'")
  })

  it("centralizes archived and stale revision rejection for all descendant mutations", () => {
    const migrationSource = getMigrationSource()
    const guardBlock = getFunctionBlock(
      migrationSource,
      "_technical_configuration_require_editable_dossier"
    )

    expect(guardBlock).toContain("p_expected_revision BIGINT")
    expect(guardBlock).toContain("RETURNS BIGINT")
    expect(guardBlock).toContain(
      "v_user_id := public._technical_configuration_require_global_user()"
    )
    expect(guardBlock).toContain("FOR UPDATE")
    expect(guardBlock).toContain("RAISE EXCEPTION 'not_found'")
    expect(guardBlock).toContain("USING ERRCODE = 'PT404'")
    expect(guardBlock).toContain("v_archived_at IS NOT NULL")
    expect(guardBlock).toContain("RAISE EXCEPTION 'archived_dossier'")
    expect(guardBlock).toContain("USING ERRCODE = 'PT409'")
    expect(guardBlock).toContain("v_revision IS DISTINCT FROM p_expected_revision")
    expect(guardBlock).toContain("RAISE EXCEPTION 'stale_revision'")
  })

  it("updates and archives under row lock with atomic revision increments", () => {
    const migrationSource = getMigrationSource()
    const updateBlock = getFunctionBlock(migrationSource, "technical_configuration_dossiers_update")
    const archiveBlock = getFunctionBlock(
      migrationSource,
      "technical_configuration_dossiers_archive"
    )

    for (const functionBlock of [updateBlock, archiveBlock]) {
      expect(functionBlock).toContain(
        "v_user_id := public._technical_configuration_require_editable_dossier"
      )
      expect(functionBlock).toContain("revision = revision + 1")
      expect(functionBlock).toContain("'data'")
    }

    expect(updateBlock).toContain("device_type_name = btrim(p_device_type_name)")
    expect(updateBlock).toContain("name = btrim(p_name)")
    expect(updateBlock).toContain("description = NULLIF(btrim(p_description), '')")
    expect(archiveBlock).toContain("archived_at = now()")
    expect(archiveBlock).toContain("archived_by = v_user_id")
    expect(migrationSource).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.technical_configuration_dossiers_(restore|delete)/i
    )
  })
})
