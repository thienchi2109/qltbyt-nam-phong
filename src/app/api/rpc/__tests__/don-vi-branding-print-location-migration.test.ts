import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations")
const MIGRATION_FILE = "20260728082127_don_vi_branding_print_location.sql"
const MIGRATION_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE)
const APPROVED_PREDECESSOR = "20260727090000_technical_configuration_comparison_reads.sql"

function listSqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return listSqlFiles(entryPath)
    }

    return entry.isFile() && entry.name.endsWith(".sql")
      ? [path.relative(MIGRATIONS_DIR, entryPath)]
      : []
  })
}

function getMigrationTimestamp(filePath: string) {
  const timestamp = path.basename(filePath).match(/^(\d{8}|\d{12}|\d{14})_.+\.sql$/)?.[1]

  return timestamp
    ? {
        raw: timestamp,
        sortKey: timestamp.padEnd(14, "0"),
      }
    : null
}

function stripSqlComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "")
}

function compactSql(source: string) {
  return source.replace(/\s+/g, " ").trim()
}

function getExecuteGrantTargets(source: string) {
  const targets = new Set<string>()
  const grantPattern =
    /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.don_vi_branding_get\s*\(\s*bigint\s*\)\s+TO\s+([^;]+);/gi

  for (const match of source.matchAll(grantPattern)) {
    for (const target of match[1]?.split(",") ?? []) {
      targets.add(target.trim().replace(/^"|"$/g, "").toLowerCase())
    }
  }

  return targets
}

const sqlFiles = listSqlFiles(MIGRATIONS_DIR)
const migrationSource = readFileSync(MIGRATION_PATH, "utf8")
const executableSql = stripSqlComments(migrationSource)
const compactExecutableSql = compactSql(executableSql)

describe("don_vi_branding_get print location migration", () => {
  it("keeps every SQL file enumerated and places the target after its approved predecessor", () => {
    const migrationEntries = sqlFiles.map((file) => ({
      file,
      timestamp: getMigrationTimestamp(file),
    }))
    const timestampedMigrations = migrationEntries
      .filter(
        (
          entry
        ): entry is {
          file: string
          timestamp: NonNullable<ReturnType<typeof getMigrationTimestamp>>
        } => entry.timestamp !== null
      )
      .sort(
        (left, right) =>
          left.timestamp.sortKey.localeCompare(right.timestamp.sortKey) ||
          left.file.localeCompare(right.file)
      )
    const targetIndex = timestampedMigrations.findIndex((entry) => entry.file === MIGRATION_FILE)
    const timestampLengths = new Set(
      timestampedMigrations.map((entry) => entry.timestamp.raw.length)
    )

    expect(migrationEntries.some((entry) => entry.file === MIGRATION_FILE)).toBe(true)
    expect(migrationEntries.some((entry) => entry.file.includes(path.sep))).toBe(true)
    expect(migrationEntries.some((entry) => entry.timestamp === null)).toBe(true)
    expect([...timestampLengths].sort((left, right) => left - right)).toEqual([8, 12, 14])
    expect(timestampedMigrations.every((entry) => entry.timestamp.sortKey.length === 14)).toBe(true)
    expect(targetIndex).toBeGreaterThan(0)
    expect(timestampedMigrations[targetIndex - 1]?.file).toBe(APPROVED_PREDECESSOR)
  })

  it("replaces the bigint overload with a nullable print_location result", () => {
    expect(compactExecutableSql).toMatch(
      /DROP FUNCTION IF EXISTS public\.don_vi_branding_get\s*\(\s*bigint\s*\)\s*;/i
    )
    expect(compactExecutableSql).toMatch(
      /CREATE FUNCTION public\.don_vi_branding_get\s*\(\s*p_id bigint DEFAULT NULL\s*\)\s*RETURNS TABLE\s*\(\s*id bigint\s*,\s*name text\s*,\s*logo_url text\s*,\s*print_location text\s*\)\s*LANGUAGE plpgsql/i
    )
  })

  it("projects the curated dia_ban label without normalization, data writes, or geographic fallbacks", () => {
    expect(migrationSource).toContain(
      "-- Expose the tenant's curated dia_ban label as printable location."
    )
    expect(migrationSource).toContain("-- This migration performs no normalization or data write.")
    expect(compactExecutableSql).toMatch(
      /SELECT d\.id\s*,\s*d\.name\s*,\s*d\.logo_url\s*,\s*db\.ten_dia_ban AS print_location FROM public\.don_vi d/i
    )
    expect(compactExecutableSql).toMatch(
      /LEFT JOIN public\.dia_ban db ON db\.id\s*=\s*d\.dia_ban_id/i
    )
    expect(executableSql).not.toMatch(/\bBTRIM\s*\(/i)
    expect(executableSql).not.toMatch(/\bUPDATE\b/i)
    expect(executableSql).not.toMatch(/Cần\s+Thơ|Hà\s+Nội|An\s+Giang/iu)
  })

  it("preserves the JWT fallback, tenant guards, and invoker security", () => {
    expect(compactExecutableSql).toContain(
      "v_role := lower(coalesce(public._get_jwt_claim('app_role')::text, ''));"
    )
    expect(compactExecutableSql).toContain(
      "v_role_fallback := lower(coalesce(public._get_jwt_claim('role')::text, ''));"
    )
    expect(compactExecutableSql).toMatch(/IF v_role = '' THEN v_role := v_role_fallback; END IF;/i)
    expect(compactExecutableSql).toMatch(
      /v_claim_don_vi := NULLIF\(public\._get_jwt_claim\('don_vi'\), ''\)::bigint; IF v_role = 'global' THEN v_effective_id := COALESCE\(p_id, v_claim_don_vi\); ELSE v_effective_id := v_claim_don_vi; IF v_effective_id IS NULL THEN RAISE EXCEPTION [^;]+ USING HINT = 'missing_don_vi_claim'; END IF; IF p_id IS NOT NULL AND p_id <> v_effective_id THEN RAISE EXCEPTION [^;]+ USING HINT = 'tenant_mismatch'; END IF; END IF; IF v_effective_id IS NULL THEN RETURN; END IF;/i
    )
    expect(compactExecutableSql).toContain("WHERE d.id = v_effective_id;")
    expect(executableSql).not.toMatch(/\bSECURITY\s+DEFINER\b/i)
  })

  it("restores execute grants for every effective RPC role", () => {
    const grantTargets = getExecuteGrantTargets(executableSql)

    expect([...grantTargets]).toEqual(
      expect.arrayContaining(["public", "anon", "authenticated", "service_role"])
    )
  })
})
