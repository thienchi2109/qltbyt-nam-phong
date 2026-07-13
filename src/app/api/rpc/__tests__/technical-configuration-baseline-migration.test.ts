import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATION_SUFFIXES = [
  "technical_configuration_baseline_drafts.sql",
  "technical_configuration_baseline_draft_group_rpcs.sql",
  "technical_configuration_baseline_content_rpcs.sql",
  "technical_configuration_baseline_reorder_preview.sql",
] as const
const migrationsDir = join(process.cwd(), "supabase", "migrations")

function getMigrationSource() {
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => MIGRATION_SUFFIXES.some((suffix) => file.endsWith(suffix)))
    .sort()

  expect(migrationFiles).toHaveLength(MIGRATION_SUFFIXES.length)
  expect(migrationFiles.map((file) => file.replace(/^\d+_/, ""))).toEqual(MIGRATION_SUFFIXES)
  return migrationFiles.map((file) => readFileSync(join(migrationsDir, file), "utf8")).join("\n")
}

function getFunctionBlock(migrationSource: string, functionName: string) {
  const start = migrationSource.indexOf(`FUNCTION public.${functionName}(`)
  expect(start).toBeGreaterThanOrEqual(0)

  const end = migrationSource.indexOf("\n$$;", start)
  expect(end).toBeGreaterThan(start)

  return migrationSource.slice(start, end)
}

const PUBLIC_RPC_SIGNATURES = [
  "technical_configuration_baseline_draft_create(UUID, BIGINT)",
  "technical_configuration_baseline_draft_get(UUID)",
  "technical_configuration_baseline_group_create(UUID, TEXT, BIGINT)",
  "technical_configuration_baseline_group_update(UUID, TEXT, BIGINT)",
  "technical_configuration_baseline_group_delete(UUID, BIGINT)",
  "technical_configuration_baseline_groups_reorder(UUID, UUID[], BIGINT)",
  "technical_configuration_baseline_criterion_create(UUID, TEXT, TEXT, BIGINT)",
  "technical_configuration_baseline_criterion_update(UUID, TEXT, TEXT, BIGINT)",
  "technical_configuration_baseline_criterion_delete(UUID, BIGINT)",
  "technical_configuration_baseline_criteria_reorder(UUID, UUID[], BIGINT)",
  "technical_configuration_baseline_bulk_preview(UUID, JSONB, BIGINT)",
] as const

describe("technical configuration baseline draft migration", () => {
  const migrationSource = getMigrationSource()

  it("keeps each phase migration below the proactive extraction threshold", () => {
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => MIGRATION_SUFFIXES.some((suffix) => file.endsWith(suffix)))
      .sort()

    for (const migrationFile of migrationFiles) {
      const lineCount = readFileSync(join(migrationsDir, migrationFile), "utf8").split("\n").length
      expect(lineCount, migrationFile).toBeLessThan(350)
    }
  })

  it("creates the fixed two-level draft schema", () => {
    expect(migrationSource).toContain(
      "CREATE TABLE public.technical_configuration_baseline_versions"
    )
    expect(migrationSource).toContain("CREATE TABLE public.technical_configuration_baseline_groups")
    expect(migrationSource).toContain(
      "CREATE TABLE public.technical_configuration_baseline_criteria"
    )
    expect(migrationSource).toMatch(/status TEXT NOT NULL DEFAULT 'draft'/)
    expect(migrationSource).toMatch(/next_criterion_number BIGINT NOT NULL DEFAULT 1/)
    expect(migrationSource).toMatch(/requirement_text TEXT NOT NULL/)
    expect(migrationSource).toMatch(/source_criterion_id UUID/)
    expect(migrationSource).not.toMatch(/field_definitions|custom_columns|JSONB\s+NOT NULL/i)
  })

  it("enforces one draft, sequential versions and same-version group ownership", () => {
    expect(migrationSource).toContain("technical_configuration_baseline_versions_one_draft_idx")
    expect(migrationSource).toMatch(
      /UNIQUE INDEX technical_configuration_baseline_versions_one_draft_idx[\s\S]*WHERE status = 'draft'/
    )
    expect(migrationSource).toMatch(/UNIQUE \(dossier_id, version_number\)/)
    expect(migrationSource).toMatch(/UNIQUE \(id, baseline_version_id\)/)
    expect(migrationSource).toMatch(
      /FOREIGN KEY \(group_id, baseline_version_id\)[\s\S]*REFERENCES public\.technical_configuration_baseline_groups \(id, baseline_version_id\)/
    )
    expect(migrationSource).toMatch(
      /REFERENCES public\.technical_configuration_baseline_versions\(id\) ON DELETE CASCADE/
    )
    expect(migrationSource).toMatch(
      /REFERENCES public\.technical_configuration_baseline_groups \(id, baseline_version_id\)[\s\S]*ON DELETE CASCADE/
    )
  })

  it("keeps client table access denied and RPC execution authenticated-only", () => {
    for (const table of [
      "technical_configuration_baseline_versions",
      "technical_configuration_baseline_groups",
      "technical_configuration_baseline_criteria",
    ]) {
      expect(migrationSource).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migrationSource).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated`
      )
      expect(migrationSource).toContain(`GRANT ALL ON TABLE public.${table} TO service_role`)
    }

    for (const signature of PUBLIC_RPC_SIGNATURES) {
      expect(migrationSource).toContain(
        `REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated, service_role`
      )
      expect(migrationSource).toContain(
        `GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated`
      )
    }
  })

  it("pins search_path and uses the P1 global/archive boundary for every public RPC", () => {
    for (const signature of PUBLIC_RPC_SIGNATURES) {
      const functionName = signature.slice(0, signature.indexOf("("))
      const block = getFunctionBlock(migrationSource, functionName)

      expect(block).toContain("SECURITY DEFINER")
      expect(block).toContain("SET search_path = public, pg_temp")
      expect(block).toMatch(
        /_technical_configuration_require_(global_user|editable_dossier|editable_baseline_version)/
      )
    }
  })

  it("checks global claims before resolving descendant identifiers", () => {
    for (const functionName of [
      "technical_configuration_baseline_group_update",
      "technical_configuration_baseline_group_delete",
      "technical_configuration_baseline_criterion_create",
      "technical_configuration_baseline_criterion_update",
      "technical_configuration_baseline_criterion_delete",
      "technical_configuration_baseline_criteria_reorder",
      "technical_configuration_baseline_bulk_preview",
    ]) {
      const block = getFunctionBlock(migrationSource, functionName)
      const claimGuardOffset = block.indexOf("_technical_configuration_require_global_user")
      const descendantLookupOffset = block.indexOf("FROM public.technical_configuration_baseline_")

      expect(claimGuardOffset, functionName).toBeGreaterThanOrEqual(0)
      expect(descendantLookupOffset, functionName).toBeGreaterThan(claimGuardOffset)
    }
  })

  it("locks the owning version and rejects archived, locked and stale mutations", () => {
    const block = getFunctionBlock(
      migrationSource,
      "_technical_configuration_require_editable_baseline_version"
    )

    expect(block).toContain("_technical_configuration_require_global_user")
    const dossierLockOffset = block.indexOf("FROM public.technical_configuration_dossiers d")
    const versionLockOffset = block.lastIndexOf(
      "FROM public.technical_configuration_baseline_versions v"
    )
    expect(dossierLockOffset).toBeGreaterThanOrEqual(0)
    expect(versionLockOffset).toBeGreaterThan(dossierLockOffset)
    expect(block.match(/FOR UPDATE/g)).toHaveLength(2)
    expect(block).toContain("archived_dossier")
    expect(block).toContain("locked_version")
    expect(block).toContain("stale_revision")
  })

  it("aggregates draft reads without per-group criterion subqueries", () => {
    const block = getFunctionBlock(migrationSource, "_technical_configuration_baseline_snapshot")

    expect(block).toContain("criteria_by_group")
    expect(block).toContain("groups_by_version")
    expect(block).toContain("LEFT JOIN criteria_by_group")
  })

  it("creates a blank draft atomically with four editable suggested groups", () => {
    const block = getFunctionBlock(migrationSource, "technical_configuration_baseline_draft_create")

    expect(block).toContain("_technical_configuration_require_editable_dossier")
    expect(block).toContain("draft_already_exists")
    expect(block).toContain("Yêu cầu chung")
    expect(block).toContain("Yêu cầu cấu hình cung cấp")
    expect(block).toContain("Yêu cầu kỹ thuật")
    expect(block).toContain("Yêu cầu khác")
    expect(block).toMatch(/revision = revision \+ 1/)
    expect(block).toMatch(/RETURNING revision INTO v_dossier_revision/)
    expect(block).toContain("'dossier_revision', v_dossier_revision")
  })

  it("generates stable criterion codes without accepting a code parameter", () => {
    const block = getFunctionBlock(
      migrationSource,
      "technical_configuration_baseline_criterion_create"
    )

    expect(block).not.toMatch(/p_criterion_code/i)
    expect(block).toContain("next_criterion_number")
    expect(block).toContain("TC-")
    expect(block).toMatch(/next_criterion_number = next_criterion_number \+ 1/)
    expect(block).toContain("WHEN unique_violation")
    expect(block).toContain("validation_error")
    expect(migrationSource).toMatch(/UNIQUE \(baseline_version_id, criterion_code\)/)
  })

  it("validates complete reorder sets before updating rows", () => {
    for (const functionName of [
      "technical_configuration_baseline_groups_reorder",
      "technical_configuration_baseline_criteria_reorder",
    ]) {
      const block = getFunctionBlock(migrationSource, functionName)
      const validationOffset = block.indexOf("validation_error")
      const updateOffset = block.indexOf("UPDATE public.technical_configuration_baseline_")

      expect(block).toContain("cardinality")
      expect(block).toContain("COUNT(DISTINCT")
      expect(validationOffset).toBeGreaterThanOrEqual(0)
      expect(updateOffset).toBeGreaterThan(validationOffset)
      expect(block).toMatch(/revision = revision \+ 1/)
    }
  })

  it("keeps bulk preview read-only and returns structured preview errors", () => {
    const block = getFunctionBlock(migrationSource, "technical_configuration_baseline_bulk_preview")

    expect(block).toContain("p_items")
    expect(block).toContain("'errors'")
    expect(block).toContain("jsonb_object_keys")
    expect(block).toContain("unsupported field")
    expect(block).toContain("title must be a string or null")
    expect(block).not.toMatch(/\bINSERT INTO\b|\bUPDATE\b|\bDELETE FROM\b/)
  })

  it("freezes optimistic concurrency and structured error messages", () => {
    expect(migrationSource).toContain("p_expected_revision BIGINT")
    expect(migrationSource).toContain("stale_revision")
    expect(migrationSource).toContain("archived_dossier")
    expect(migrationSource).toContain("locked_version")
    expect(migrationSource).toContain("draft_already_exists")
    expect(migrationSource).toContain("validation_error")
  })
})
