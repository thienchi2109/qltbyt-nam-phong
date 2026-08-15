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
  return stripSqlComments(source).replace(/\s+/g, " ").trim()
}

function stripSqlComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => " ".repeat(comment.length))
    .replace(/--[^\n]*/g, (comment) => " ".repeat(comment.length))
}

function normalizeUnlinkSignature(argumentsSql: string) {
  return argumentsSql
    .split(",")
    .map((argument) => argument.match(/\bBIGINT(?:\[\])?\b/i)?.[0].toUpperCase() ?? "")
    .join(",")
}

function getFinalUnlinkSignatures(migrationSql: string) {
  const signatures = new Set(["BIGINT[],BIGINT"])
  const executableSql = stripSqlComments(migrationSql)
  const statements = Array.from(
    executableSql.matchAll(
      /(CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION|DROP\s+FUNCTION(?:\s+IF\s+EXISTS)?)\s+public\.dinh_muc_thiet_bi_unlink\s*\(([^)]*)\)/gi
    )
  )

  expect(statements.length).toBeGreaterThan(0)
  for (const [, operation, argumentsSql] of statements) {
    const signature = normalizeUnlinkSignature(argumentsSql)
    if (operation.toUpperCase().startsWith("DROP")) {
      signatures.delete(signature)
    } else {
      signatures.add(signature)
    }
  }

  return [...signatures].sort()
}

function extractLatestFunctionDefinition(source: string) {
  const executableSql = stripSqlComments(source)
  const starts = Array.from(
    executableSql.matchAll(
      /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink\s*\(/gi
    )
  )
  expect(starts.length).toBeGreaterThan(0)

  const start = starts.at(-1)!.index
  const sourceFromFunction = executableSql.slice(start)
  const openingDelimiter = sourceFromFunction.match(/\bAS\s+(\$[a-zA-Z0-9_]*\$)/i)
  expect(openingDelimiter).not.toBeNull()

  const delimiter = openingDelimiter![1]
  const bodyStart = start + openingDelimiter!.index! + openingDelimiter![0].length
  const bodyEnd = executableSql.indexOf(delimiter, bodyStart)
  expect(bodyEnd).toBeGreaterThan(bodyStart)

  const statementEnd = executableSql.indexOf(";", bodyEnd + delimiter.length)
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
      /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink/i.test(
        stripSqlComments(readFileSync(file, "utf8"))
      )
    )
    .sort()

  expect(matches.length).toBeGreaterThan(0)
  const migrationPath = matches.at(-1)!
  const migrationSql = readFileSync(migrationPath, "utf8")
  const { functionBody, functionSql } = extractLatestFunctionDefinition(migrationSql)

  return {
    migrationSql,
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
    const failClosedGuards = [
      /IF\s+v_role\s+IS NULL\s+OR\s+v_role\s*=\s*''\s+THEN\s+RAISE EXCEPTION\s+'Missing role claim'[\s\S]*?END IF;/i,
      /IF\s+v_user_id\s+IS NULL\s+THEN\s+RAISE EXCEPTION\s+'Missing user_id claim'[\s\S]*?END IF;/i,
      /IF\s+v_role\s+NOT IN\s*\('global',\s*'admin',\s*'to_qltb'\)\s+THEN\s+RAISE EXCEPTION[\s\S]*?END IF;/i,
    ]
    const normalizedUserIdClaim = normalizedFunction.match(
      /v_user_id[\s\S]*?NULLIF\(current_setting\('request\.jwt\.claims', true\)::json->>'user_id', ''\)/i
    )
    const tenantClaim = normalizedFunction.match(
      /v_don_vi[\s\S]*?current_setting\('request\.jwt\.claims', true\)::json->>'don_vi'/i
    )
    const effectiveTenantBinding = normalizedFunction.match(
      /IF\s+(?:v_role\s*=\s*'to_qltb'|v_role\s+NOT IN\s*\('global',\s*'admin'\))\s+THEN\s+p_don_vi\s*:=\s*NULLIF\(v_don_vi,\s*''\)::BIGINT\s*;[\s\S]*?END IF;/i
    )
    const effectiveTenantRequired = normalizedFunction.match(
      /IF\s+p_don_vi\s+IS NULL\s+THEN\s+RAISE EXCEPTION[\s\S]*?END IF;/i
    )
    const categoryGuard = normalizedFunction.match(
      /IF\s+NOT\s+EXISTS\s*\(\s*SELECT[\s\S]*?FROM public\.nhom_thiet_bi(?:\s+(?:AS\s+)?[a-z_][a-z0-9_]*)?\s+WHERE[\s\S]*?(?:[a-z_][a-z0-9_]*\.)?id\s*=\s*p_nhom_id[\s\S]*?(?:[a-z_][a-z0-9_]*\.)?don_vi_id\s*=\s*p_don_vi[\s\S]*?\)\s+THEN\s+RAISE EXCEPTION\s+'[^']*(?:category|nhóm)[^']*'[\s\S]*?END IF;/i
    )

    expect(mutationIndex).toBeGreaterThan(-1)
    for (const guard of failClosedGuards) {
      const matchedGuard = normalizedFunction.match(guard)
      expect(matchedGuard).not.toBeNull()
      expect(matchedGuard!.index).toBeLessThan(mutationIndex)
    }
    expect(normalizedUserIdClaim).not.toBeNull()
    expect(tenantClaim).not.toBeNull()
    expect(effectiveTenantBinding).not.toBeNull()
    expect(effectiveTenantRequired).not.toBeNull()
    expect(effectiveTenantBinding!.index).toBeLessThan(effectiveTenantRequired!.index!)
    expect(effectiveTenantRequired!.index).toBeLessThan(mutationIndex)
    expect(categoryGuard).not.toBeNull()
    expect(categoryGuard!.index).toBeLessThan(mutationIndex)
  })

  it("uses one tenant- and expected-category-scoped update with distinct scope failures", () => {
    const { normalizedBody } = readLatestUnlinkMigration()
    const updateStatements = normalizedBody.match(/UPDATE public\.thiet_bi\b[\s\S]*?;/gi) ?? []
    const exceptionMessages = Array.from(
      normalizedBody.matchAll(/RAISE EXCEPTION\s+'([^']+)'/gi),
      (match) => match[1]
    )

    expect(updateStatements).toHaveLength(1)
    expect(updateStatements[0]).toMatch(
      /\bSET\s+(?:[a-z_][a-z0-9_]*\.)?nhom_thiet_bi_id\s*=\s*NULL/i
    )
    const whereClause = updateStatements[0].match(/\bWHERE\b([\s\S]*?)\bRETURNING\b/i)?.[1]
    expect(whereClause).toBeDefined()
    expect(whereClause).toMatch(/(?:[a-z_][a-z0-9_]*\.)?id\s*=\s*ANY\(p_thiet_bi_ids\)/i)
    expect(whereClause).toMatch(/(?:[a-z_][a-z0-9_]*\.)?don_vi\s*=\s*p_don_vi/i)
    expect(whereClause).toMatch(/(?:[a-z_][a-z0-9_]*\.)?nhom_thiet_bi_id\s*=\s*p_nhom_id/i)
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
    const auditUsesAffectedProvenance = new RegExp(
      `INSERT INTO public\\.thiet_bi_nhom_audit_log\\s*\\(\\s*don_vi_id\\s*,\\s*thiet_bi_ids\\s*,\\s*nhom_thiet_bi_id\\s*,\\s*action\\s*,\\s*performed_by\\s*,\\s*performed_at\\s*,\\s*metadata\\s*\\)\\s*SELECT\\s+p_don_vi\\s*,\\s*ARRAY_AGG\\(\\s*(?:[a-z_][a-z0-9_]*\\.)?id\\s*\\)\\s*,\\s*p_nhom_id\\s*,\\s*'unlink'\\s*,\\s*v_user_id(?:::BIGINT)?\\s*,\\s*(?:NOW\\(\\)|CURRENT_TIMESTAMP)\\s*,\\s*jsonb_build_object\\([\\s\\S]*?'previous_nhom_id'\\s*,\\s*p_nhom_id[\\s\\S]*?\\)\\s+FROM\\s+${affectedCte}\\b(?:\\s+(?:AS\\s+)?[a-z_][a-z0-9_]*)?\\s+HAVING\\s+COUNT\\(\\s*\\*\\s*\\)\\s*>\\s*0`,
      "i"
    ).test(normalizedFunction)
    const countUsesAffectedIds = new RegExp(
      `SELECT\\s+COUNT\\(\\s*(?:\\*|(?:[a-z_][a-z0-9_]*\\.)?id)\\s*\\)(?:::[a-z_][a-z0-9_]*)?\\s+INTO\\s+v_affected_count\\s+FROM\\s+${affectedCte}\\b`,
      "i"
    ).test(normalizedFunction)
    const returnedIdsComeFromConstrainedUpdate = normalizedFunction.match(
      new RegExp(
        `WITH\\s+${affectedCte}\\s+AS\\s*\\(\\s*UPDATE public\\.thiet_bi\\b[\\s\\S]*?\\bWHERE\\b[\\s\\S]*?nhom_thiet_bi_id\\s*=\\s*p_nhom_id[\\s\\S]*?RETURNING\\s+(?:[a-z_][a-z0-9_]*\\.)?id\\s*\\)`,
        "i"
      )
    )

    expect(auditIndex).toBeGreaterThan(updateCte!.index!)
    expect(returnedIdsComeFromConstrainedUpdate).not.toBeNull()
    expect(auditUsesAffectedProvenance).toBe(true)
    expect(countUsesAffectedIds).toBe(true)
    expect(auditSql).not.toMatch(/\bthiet_bi_ids\s*,[\s\S]*?p_thiet_bi_ids/i)
    expect(normalizedFunction).toContain("RETURN v_affected_count")
  })

  it("preserves security definer and exposes only the hardened authenticated overload", () => {
    const { migrationSql, normalizedFunction, normalizedMigration } = readLatestUnlinkMigration()
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
    expect(getFinalUnlinkSignatures(migrationSql)).toEqual(["BIGINT[],BIGINT,BIGINT"])
  })
})
