import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

function findMigrationFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory()
      ? findMigrationFiles(entryPath)
      : entry.isFile() && entry.name.endsWith(".sql")
        ? [entryPath]
        : []
  })
}

function readLatestUnlinkMigration() {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations")
  const matches = findMigrationFiles(migrationsDir)
    .filter((file) =>
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink/i.test(
        readFileSync(file, "utf8")
      )
    )
    .sort()

  expect(matches.length).toBeGreaterThan(0)
  const migrationPath = matches.at(-1)!
  const source = readFileSync(migrationPath, "utf8")

  return {
    migrationPath: path.relative(process.cwd(), migrationPath),
    source,
    normalized: source.replace(/\s+/g, " "),
  }
}

describe("dinh_muc_thiet_bi_unlink hardened source contract RED baseline", () => {
  it("uses the latest correctly ordered three-argument expected-category overload", () => {
    const { migrationPath, normalized } = readLatestUnlinkMigration()

    expect(migrationPath).not.toBe("supabase/migrations/20260201_device_quota_rpc_mapping.sql")
    expect(normalized).toMatch(
      /CREATE OR REPLACE FUNCTION public\.dinh_muc_thiet_bi_unlink\s*\(\s*p_thiet_bi_ids BIGINT\[\],\s*p_nhom_id BIGINT,\s*p_don_vi BIGINT DEFAULT NULL\s*\)/i
    )
    expect(normalized).toMatch(/tb\.nhom_thiet_bi_id\s*=\s*p_nhom_id/i)
  })

  it("fails closed for role and user claims and rejects unauthorized direct RPC roles", () => {
    const { normalized } = readLatestUnlinkMigration()

    expect(normalized).toContain("Missing role claim")
    expect(normalized).toContain("Missing user_id claim")
    expect(normalized).toMatch(/v_role\s+NOT IN\s*\('global',\s*'admin',\s*'to_qltb'\)/i)
    expect(normalized).toMatch(
      /NULLIF\(current_setting\('request\.jwt\.claims', true\)::json->>'user_id', ''\)/i
    )
  })

  it("has distinct category-scope and equipment-scope tenant failures", () => {
    const { source, normalized } = readLatestUnlinkMigration()
    const exceptionMessages = Array.from(
      source.matchAll(/RAISE EXCEPTION\s+'([^']+)'/gi),
      (match) => match[1]
    )

    expect(normalized).toMatch(
      /FROM public\.nhom_thiet_bi[\s\S]*id\s*=\s*p_nhom_id[\s\S]*don_vi_id\s*=\s*p_don_vi/i
    )
    expect(normalized).toMatch(/tb\.id\s*=\s*ANY\(p_thiet_bi_ids\)/i)
    expect(normalized).toMatch(/tb\.don_vi\s*=\s*p_don_vi/i)
    expect(exceptionMessages.some((message) => /category|nhóm/i.test(message))).toBe(true)
    expect(exceptionMessages.some((message) => /equipment|thiết bị/i.test(message))).toBe(true)
  })

  it("preserves security definer, safe search path, affected count, and complete audit data", () => {
    const { normalized } = readLatestUnlinkMigration()

    expect(normalized).toContain("SECURITY DEFINER")
    expect(normalized).toContain("SET search_path = public, pg_temp")
    expect(normalized).toContain("GET DIAGNOSTICS v_affected_count = ROW_COUNT")
    expect(normalized).toContain("INSERT INTO public.thiet_bi_nhom_audit_log")
    expect(normalized).toContain("'unlink'")
    expect(normalized).toContain("performed_by")
    expect(normalized).toContain("previous_nhom_id")
    expect(normalized).toContain("RETURN v_affected_count")
  })

  it("revokes public and anon execution, grants authenticated, and removes the unsafe overload", () => {
    const { normalized } = readLatestUnlinkMigration()
    const revokeStatements =
      normalized
        .match(
          /REVOKE ALL ON FUNCTION public\.dinh_muc_thiet_bi_unlink\(BIGINT\[\], BIGINT, BIGINT\)[^;]*;/gi
        )
        ?.join(" ") ?? ""

    expect(revokeStatements).toMatch(/\bPUBLIC\b/i)
    expect(revokeStatements).toMatch(/\banon\b/i)
    expect(normalized).toContain(
      "GRANT EXECUTE ON FUNCTION public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT, BIGINT) TO authenticated"
    )
    expect(normalized).toContain(
      "DROP FUNCTION IF EXISTS public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT)"
    )
    expect(normalized).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.dinh_muc_thiet_bi_unlink\s*\(\s*p_thiet_bi_ids BIGINT\[\],\s*p_don_vi BIGINT/i
    )
  })
})
