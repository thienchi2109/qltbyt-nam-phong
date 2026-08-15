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

function normalizeSql(source: string) {
  return source.replace(/\s+/g, " ").trim()
}

function extractLatestFunctionDefinition(source: string) {
  const starts = Array.from(
    source.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink\s*\(/gi)
  )
  expect(starts.length).toBeGreaterThan(0)

  const start = starts.at(-1)!.index
  const sourceFromFunction = source.slice(start)
  const openingDelimiter = sourceFromFunction.match(/\bAS\s+(\$[a-zA-Z0-9_]*\$)/i)
  expect(openingDelimiter).not.toBeNull()

  const delimiter = openingDelimiter![1]
  const bodyStart = start + openingDelimiter!.index! + openingDelimiter![0].length
  const bodyEnd = source.indexOf(delimiter, bodyStart)
  expect(bodyEnd).toBeGreaterThan(bodyStart)

  const statementEnd = source.indexOf(";", bodyEnd + delimiter.length)
  expect(statementEnd).toBeGreaterThan(bodyEnd)

  return {
    functionBody: source.slice(bodyStart, bodyEnd),
    functionSql: source.slice(start, statementEnd + 1),
  }
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
  const migrationSql = readFileSync(migrationPath, "utf8")
  const { functionBody, functionSql } = extractLatestFunctionDefinition(migrationSql)

  return {
    migrationPath: path.relative(process.cwd(), migrationPath),
    normalizedBody: normalizeSql(functionBody),
    normalizedFunction: normalizeSql(functionSql),
    normalizedMigration: normalizeSql(migrationSql),
  }
}

describe("dinh_muc_thiet_bi_unlink hardened source contract RED baseline", () => {
  it("uses the latest correctly ordered three-argument expected-category overload", () => {
    const { migrationPath, normalizedFunction } = readLatestUnlinkMigration()

    expect(migrationPath).not.toBe("supabase/migrations/20260201_device_quota_rpc_mapping.sql")
    expect(normalizedFunction).toMatch(
      /CREATE OR REPLACE FUNCTION public\.dinh_muc_thiet_bi_unlink\s*\(\s*p_thiet_bi_ids BIGINT\[\],\s*p_nhom_id BIGINT,\s*p_don_vi BIGINT DEFAULT NULL\s*\)\s*RETURNS (?:INTEGER|INT)\b/i
    )
  })

  it("runs claim, role, and category guards before the equipment mutation", () => {
    const { normalizedFunction } = readLatestUnlinkMigration()
    const mutationIndex = normalizedFunction.search(/UPDATE public\.thiet_bi\b/i)
    const guardPatterns = [
      /Missing role claim/i,
      /Missing user_id claim/i,
      /v_role\s+NOT IN\s*\('global',\s*'admin',\s*'to_qltb'\)/i,
      /NULLIF\(current_setting\('request\.jwt\.claims', true\)::json->>'user_id', ''\)/i,
      /FROM public\.nhom_thiet_bi[\s\S]*id\s*=\s*p_nhom_id[\s\S]*don_vi_id\s*=\s*p_don_vi/i,
    ]

    expect(mutationIndex).toBeGreaterThan(-1)
    for (const pattern of guardPatterns) {
      const guardIndex = normalizedFunction.search(pattern)
      expect(guardIndex).toBeGreaterThan(-1)
      expect(guardIndex).toBeLessThan(mutationIndex)
    }
  })

  it("uses one tenant- and expected-category-scoped update with distinct scope failures", () => {
    const { normalizedBody } = readLatestUnlinkMigration()
    const updateStatements = normalizedBody.match(/UPDATE public\.thiet_bi\b[\s\S]*?;/gi) ?? []
    const exceptionMessages = Array.from(
      normalizedBody.matchAll(/RAISE EXCEPTION\s+'([^']+)'/gi),
      (match) => match[1]
    )

    expect(updateStatements).toHaveLength(1)
    expect(updateStatements[0]).toMatch(/(?:tb\.)?id\s*=\s*ANY\(p_thiet_bi_ids\)/i)
    expect(updateStatements[0]).toMatch(/(?:tb\.)?don_vi\s*=\s*p_don_vi/i)
    expect(updateStatements[0]).toMatch(/(?:tb\.)?nhom_thiet_bi_id\s*=\s*p_nhom_id/i)
    expect(exceptionMessages.some((message) => /category|nhóm/i.test(message))).toBe(true)
    expect(exceptionMessages.some((message) => /equipment|thiết bị/i.test(message))).toBe(true)
  })

  it("audits IDs returned by the constrained update and returns their affected count", () => {
    const { normalizedFunction } = readLatestUnlinkMigration()
    const updateCte = normalizedFunction.match(
      /WITH\s+([a-z_][a-z0-9_]*)\s+AS\s*\(\s*UPDATE public\.thiet_bi\b[\s\S]*?RETURNING\s+(?:[a-z_][a-z0-9_]*\.)?id\s*\)/i
    )

    expect(updateCte).not.toBeNull()
    const affectedCte = updateCte![1]
    const auditIndex = normalizedFunction.search(/INSERT INTO public\.thiet_bi_nhom_audit_log/i)
    const auditSql = normalizedFunction.slice(auditIndex)
    const directAuditUse =
      new RegExp(`FROM ${affectedCte}\\b`, "i").test(auditSql) &&
      /ARRAY_AGG\(\s*(?:[a-z_][a-z0-9_]*\.)?id\s*\)/i.test(auditSql)
    const affectedIdsCapture = normalizedFunction.match(
      new RegExp(
        `SELECT[\\s\\S]*?ARRAY_AGG\\(\\s*(?:[a-z_][a-z0-9_]*\\.)?id\\s*\\)[\\s\\S]*?INTO\\s+(v_[a-z_][a-z0-9_]*)[\\s\\S]*?FROM\\s+${affectedCte}\\b`,
        "i"
      )
    )
    const capturedAuditUse =
      affectedIdsCapture !== null &&
      new RegExp(`\\b${affectedIdsCapture[1]}\\b`, "i").test(auditSql)

    expect(auditIndex).toBeGreaterThan(updateCte!.index!)
    expect(directAuditUse || capturedAuditUse).toBe(true)
    expect(auditSql).toContain("'unlink'")
    expect(auditSql).toContain("performed_by")
    expect(auditSql).toContain("previous_nhom_id")
    expect(normalizedFunction).toContain("RETURN v_affected_count")
  })

  it("preserves security definer and exposes only the hardened authenticated overload", () => {
    const { normalizedFunction, normalizedMigration } = readLatestUnlinkMigration()
    const revokeStatements =
      normalizedMigration
        .match(
          /REVOKE ALL ON FUNCTION public\.dinh_muc_thiet_bi_unlink\(BIGINT\[\], BIGINT, BIGINT\)[^;]*;/gi
        )
        ?.join(" ") ?? ""
    const grantStatements =
      normalizedMigration.match(
        /GRANT EXECUTE ON FUNCTION public\.dinh_muc_thiet_bi_unlink\(BIGINT\[\], BIGINT, BIGINT\)[^;]*;/gi
      ) ?? []

    expect(normalizedFunction).toContain("SECURITY DEFINER")
    expect(normalizedFunction).toContain("SET search_path = public, pg_temp")
    expect(revokeStatements).toMatch(/\bPUBLIC\b/i)
    expect(revokeStatements).toMatch(/\banon\b/i)
    expect(grantStatements).toEqual([expect.stringMatching(/\bTO authenticated\s*;/i)])
    expect(normalizedMigration).toMatch(
      /REVOKE (?:ALL|EXECUTE) ON FUNCTION public\.dinh_muc_thiet_bi_unlink\(BIGINT\[\], BIGINT\)[^;]*authenticated[^;]*;/i
    )
    expect(normalizedMigration).toContain(
      "DROP FUNCTION IF EXISTS public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT)"
    )
    expect(normalizedMigration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.dinh_muc_thiet_bi_unlink\s*\(\s*p_thiet_bi_ids BIGINT\[\],\s*p_don_vi BIGINT/i
    )
  })
})
