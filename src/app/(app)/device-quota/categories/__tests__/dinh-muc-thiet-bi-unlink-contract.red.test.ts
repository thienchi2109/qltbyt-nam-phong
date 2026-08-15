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
    .map((argument) => argument.match(/\bBIGINT(?:\[\])?/i)?.[0].toUpperCase() ?? "")
    .join(",")
}

function getFinalUnlinkSignatures(migrationSql: string) {
  const signatures = new Set<string>()
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

function getUnlinkPrivilegeActions(normalizedMigration: string) {
  return Array.from(
    normalizedMigration.matchAll(
      /\b(GRANT\s+EXECUTE|REVOKE\s+(?:ALL|EXECUTE))\s+ON\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink\s*\(\s*BIGINT\[\]\s*,\s*BIGINT\s*,\s*BIGINT\s*\)\s+(?:TO|FROM)\s+([^;]+);/gi
    ),
    (match) => ({
      action: match[1].toUpperCase().startsWith("GRANT") ? "GRANT" : "REVOKE",
      index: match.index,
      roles: match[2].split(",").map((role) => role.trim().toLowerCase()),
    })
  )
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

function readAffectedMutationStatement(normalizedBody: string) {
  const statementStart = normalizedBody.match(
    /WITH\s+([a-z_][a-z0-9_]*)\s+AS\s*\(\s*UPDATE public\.thiet_bi\b/i
  )
  expect(statementStart).not.toBeNull()

  const statementEnd = normalizedBody.indexOf(";", statementStart!.index)
  expect(statementEnd).toBeGreaterThan(statementStart!.index!)

  return {
    affectedCte: statementStart![1],
    statement: normalizedBody.slice(statementStart!.index, statementEnd + 1),
  }
}

function expectConjunctivePredicates(whereClause: string, predicates: RegExp[]) {
  expect(whereClause).not.toMatch(/\bOR\b/i)
  const conjuncts = whereClause.split(/\bAND\b/i)
  expect(conjuncts.length).toBeGreaterThanOrEqual(predicates.length)
  for (const predicate of predicates) {
    expect(conjuncts.some((conjunct) => predicate.test(conjunct))).toBe(true)
  }
}

function getDataMutationOperations(normalizedBody: string) {
  return Array.from(
    normalizedBody.matchAll(
      /\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?)\s+((?:public\.)?[a-z_][a-z0-9_]*)\b/gi
    ),
    (match) => `${match[1].replace(/\s+/g, " ").toUpperCase()} ${match[2].toLowerCase()}`
  )
}

function readLatestUnlinkMigration() {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations")
  const migrations = findMigrationFiles(migrationsDir)
    .sort()
    .map((file) => ({ file, sql: readFileSync(file, "utf8") }))
  const relevantMigrations = migrations.filter(({ sql }) =>
    /\b(?:CREATE(?:\s+OR\s+REPLACE)?|DROP)\s+FUNCTION\b[\s\S]*?public\.dinh_muc_thiet_bi_unlink|(?:GRANT|REVOKE)[\s\S]*?public\.dinh_muc_thiet_bi_unlink/i.test(
      stripSqlComments(sql)
    )
  )
  const definitionMigrations = relevantMigrations.filter(({ sql }) =>
    /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink/i.test(
      stripSqlComments(sql)
    )
  )

  expect(definitionMigrations.length).toBeGreaterThan(0)
  const latestDefinition = definitionMigrations.at(-1)!
  const migrationSql = relevantMigrations.map(({ sql }) => sql).join("\n")
  const { functionBody, functionSql } = extractLatestFunctionDefinition(latestDefinition.sql)

  return {
    migrationSql,
    migrationPath: path.relative(process.cwd(), latestDefinition.file),
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
    const appRoleClaim = normalizedFunction.match(
      /v_role\s+TEXT\s*:=\s*current_setting\('request\.jwt\.claims', true\)::json->>'app_role'/i
    )
    const fallbackRoleClaim = normalizedFunction.match(
      /IF\s+v_role\s+IS NULL\s+OR\s+v_role\s*=\s*''\s+THEN\s+v_role\s*:=\s*current_setting\('request\.jwt\.claims', true\)::json->>'role'\s*;[\s\S]*?END IF;/i
    )
    const userIdClaim = normalizedFunction.match(
      /v_user_id\s+TEXT\s*:=\s*NULLIF\(current_setting\('request\.jwt\.claims', true\)::json->>'user_id', ''\)/i
    )
    const tenantClaim = normalizedFunction.match(
      /v_don_vi\s+TEXT\s*:=\s*current_setting\('request\.jwt\.claims', true\)::json->>'don_vi'/i
    )
    const roleGuard = normalizedFunction.match(
      /IF\s+v_role\s+IS NULL\s+OR\s+v_role\s*=\s*''\s+THEN\s+RAISE EXCEPTION\s+'Missing role claim'\s+USING\s+errcode\s*=\s*'42501'\s*;\s*END IF;/i
    )
    const userIdGuard = normalizedFunction.match(
      /IF\s+v_user_id\s+IS NULL\s+THEN\s+RAISE EXCEPTION\s+'Missing user_id claim'\s+USING\s+errcode\s*=\s*'42501'\s*;\s*END IF;/i
    )
    const authorizationGuard = normalizedFunction.match(
      /IF\s+v_role\s+NOT IN\s*\('global',\s*'admin',\s*'to_qltb'\)\s+THEN\s+RAISE EXCEPTION[^;]*\s+USING\s+errcode\s*=\s*'42501'\s*;\s*END IF;/i
    )
    const effectiveTenantBinding = normalizedFunction.match(
      /IF\s+(?:v_role\s*=\s*'to_qltb'|v_role\s+NOT IN\s*\('global',\s*'admin'\))\s+THEN\s+p_don_vi\s*:=\s*NULLIF\(v_don_vi,\s*''\)::BIGINT\s*;[\s\S]*?END IF;/i
    )
    const effectiveTenantRequired = normalizedFunction.match(
      /IF\s+p_don_vi\s+IS NULL\s+THEN\s+RAISE EXCEPTION[^;]*\s+USING\s+errcode\s*=\s*'42501'\s*;\s*END IF;/i
    )
    const categoryGuard = normalizedFunction.match(
      /IF\s+NOT\s+EXISTS\s*\(\s*SELECT[\s\S]*?FROM public\.nhom_thiet_bi(?:\s+(?:AS\s+)?[a-z_][a-z0-9_]*)?\s+WHERE[\s\S]*?\)\s+THEN\s+RAISE EXCEPTION\s+'[^']*(?:category|nhóm)[^']*'\s+USING\s+errcode\s*=\s*'42501'\s*;\s*END IF;/i
    )
    const categoryWhereClause = categoryGuard?.[0].match(
      /\bWHERE\b([\s\S]*?)\)\s+THEN\s+RAISE EXCEPTION/i
    )?.[1]

    expect(mutationIndex).toBeGreaterThan(-1)
    expect(appRoleClaim).not.toBeNull()
    expect(fallbackRoleClaim).not.toBeNull()
    expect(userIdClaim).not.toBeNull()
    expect(tenantClaim).not.toBeNull()
    expect(roleGuard).not.toBeNull()
    expect(userIdGuard).not.toBeNull()
    expect(authorizationGuard).not.toBeNull()
    expect(effectiveTenantBinding).not.toBeNull()
    expect(effectiveTenantRequired).not.toBeNull()
    expect(categoryGuard).not.toBeNull()
    expect(categoryGuard![0]).toMatch(/\bFOR (?:SHARE|UPDATE)\b/i)
    expect(categoryWhereClause).toBeDefined()
    expect(appRoleClaim!.index).toBeLessThan(fallbackRoleClaim!.index!)
    expect(fallbackRoleClaim!.index).toBeLessThan(roleGuard!.index!)
    expect(roleGuard!.index).toBeLessThan(authorizationGuard!.index!)
    expect(userIdClaim!.index).toBeLessThan(userIdGuard!.index!)
    expect(userIdGuard!.index).toBeLessThan(mutationIndex)
    expect(authorizationGuard!.index).toBeLessThan(mutationIndex)
    expect(tenantClaim!.index).toBeLessThan(effectiveTenantBinding!.index!)
    expect(effectiveTenantBinding!.index).toBeLessThan(effectiveTenantRequired!.index!)
    for (const sessionStep of [
      roleGuard,
      userIdGuard,
      authorizationGuard,
      effectiveTenantBinding,
      effectiveTenantRequired,
    ]) {
      expect(sessionStep!.index).toBeLessThan(categoryGuard!.index!)
    }
    expect(categoryGuard!.index).toBeLessThan(mutationIndex)
    expectConjunctivePredicates(categoryWhereClause!, [
      /(?:[a-z_][a-z0-9_]*\.)?id\s*=\s*p_nhom_id/i,
      /(?:[a-z_][a-z0-9_]*\.)?don_vi_id\s*=\s*p_don_vi/i,
    ])
  })

  it("rejects cross-tenant categories but returns zero for tenant-scoped equipment misses", () => {
    const { normalizedBody } = readLatestUnlinkMigration()
    const { statement } = readAffectedMutationStatement(normalizedBody)
    const statementIndex = normalizedBody.indexOf(statement)
    const preMutationBody = normalizedBody.slice(0, statementIndex)
    const updateStatements = statement.match(/UPDATE public\.thiet_bi\b/gi) ?? []
    const updateClause = statement.match(
      /UPDATE public\.thiet_bi\b[\s\S]*?RETURNING\s+(?:[a-z_][a-z0-9_]*\.)?id/i
    )
    const exceptionMessages = Array.from(
      normalizedBody.matchAll(/RAISE EXCEPTION\s+'([^']+)'/gi),
      (match) => match[1]
    )

    expect(updateStatements).toHaveLength(1)
    expect(updateClause).not.toBeNull()
    expect(updateClause![0]).toMatch(/\bSET\s+(?:[a-z_][a-z0-9_]*\.)?nhom_thiet_bi_id\s*=\s*NULL/i)
    const whereClause = updateClause![0].match(/\bWHERE\b([\s\S]*?)\bRETURNING\b/i)?.[1]
    expect(whereClause).toBeDefined()
    expectConjunctivePredicates(whereClause!, [
      /(?:[a-z_][a-z0-9_]*\.)?id\s*=\s*ANY\(p_thiet_bi_ids\)/i,
      /(?:[a-z_][a-z0-9_]*\.)?don_vi\s*=\s*p_don_vi/i,
      /(?:[a-z_][a-z0-9_]*\.)?nhom_thiet_bi_id\s*=\s*p_nhom_id/i,
    ])
    expect(exceptionMessages.some((message) => /category|nhóm/i.test(message))).toBe(true)
    expect(preMutationBody).not.toMatch(/\bFROM\s+(?:public\.)?thiet_bi\b/i)
    expect(preMutationBody).not.toMatch(
      /RAISE EXCEPTION\s+'[^']*(?:equipment|thiết bị|thiet bi)[^']*'/i
    )
    expect(normalizedBody.slice(normalizedBody.indexOf(statement) + statement.length)).not.toMatch(
      /RAISE EXCEPTION/i
    )
    expect(normalizedBody).toContain("RETURN v_affected_count")
  })

  it("audits IDs returned by the constrained update and returns their affected count", () => {
    const { normalizedBody, normalizedFunction } = readLatestUnlinkMigration()
    const { affectedCte, statement } = readAffectedMutationStatement(normalizedBody)
    const auditStatements = statement.match(/INSERT INTO public\.thiet_bi_nhom_audit_log\b/gi) ?? []
    const auditIndex = statement.search(/INSERT INTO public\.thiet_bi_nhom_audit_log/i)
    const auditUsesAffectedProvenance = new RegExp(
      `INSERT INTO public\\.thiet_bi_nhom_audit_log\\s*\\(\\s*don_vi_id\\s*,\\s*thiet_bi_ids\\s*,\\s*nhom_thiet_bi_id\\s*,\\s*action\\s*,\\s*performed_by\\s*,\\s*performed_at\\s*,\\s*metadata\\s*\\)\\s*SELECT\\s+p_don_vi\\s*,\\s*ARRAY_AGG\\(\\s*(?:[a-z_][a-z0-9_]*\\.)?id\\s*\\)\\s*,\\s*p_nhom_id\\s*,\\s*'unlink'\\s*,\\s*v_user_id(?:::BIGINT)?\\s*,\\s*(?:NOW\\(\\)|CURRENT_TIMESTAMP)\\s*,\\s*jsonb_build_object\\([\\s\\S]*?'previous_nhom_id'\\s*,\\s*p_nhom_id[\\s\\S]*?\\)\\s+FROM\\s+${affectedCte}\\b(?:\\s+(?:AS\\s+)?[a-z_][a-z0-9_]*)?\\s+HAVING\\s+COUNT\\(\\s*\\*\\s*\\)\\s*>\\s*0`,
      "i"
    ).test(statement)
    const countUsesAffectedIds = new RegExp(
      `SELECT\\s+COUNT\\(\\s*(?:\\*|(?:[a-z_][a-z0-9_]*\\.)?id)\\s*\\)(?:::[a-z_][a-z0-9_]*)?\\s+INTO\\s+v_affected_count\\s+FROM\\s+${affectedCte}\\b`,
      "i"
    ).test(statement)
    const returnedIdsComeFromConstrainedUpdate = statement.match(
      new RegExp(
        `WITH\\s+${affectedCte}\\s+AS\\s*\\(\\s*UPDATE public\\.thiet_bi\\b[\\s\\S]*?\\bWHERE\\b[\\s\\S]*?nhom_thiet_bi_id\\s*=\\s*p_nhom_id[\\s\\S]*?RETURNING\\s+(?:[a-z_][a-z0-9_]*\\.)?id\\s*\\)`,
        "i"
      )
    )

    expect(auditStatements).toHaveLength(1)
    expect(getDataMutationOperations(normalizedBody)).toEqual([
      "UPDATE public.thiet_bi",
      "INSERT INTO public.thiet_bi_nhom_audit_log",
    ])
    expect(auditIndex).toBeGreaterThan(statement.search(/UPDATE public\.thiet_bi\b/i))
    expect(returnedIdsComeFromConstrainedUpdate).not.toBeNull()
    expect(auditUsesAffectedProvenance).toBe(true)
    expect(countUsesAffectedIds).toBe(true)
    expect(normalizedFunction).toContain("RETURN v_affected_count")
  })

  it("preserves security definer and exposes only the hardened authenticated overload", () => {
    const { migrationSql, normalizedFunction, normalizedMigration } = readLatestUnlinkMigration()
    const privilegeActions = getUnlinkPrivilegeActions(normalizedMigration)
    const hardenedDefinitions = Array.from(
      normalizedMigration.matchAll(
        /CREATE(?:\s+OR\s+REPLACE)?\s+FUNCTION\s+public\.dinh_muc_thiet_bi_unlink\s*\(\s*p_thiet_bi_ids BIGINT\[\],\s*p_nhom_id BIGINT,\s*p_don_vi BIGINT DEFAULT NULL\s*\)/gi
      )
    )
    const latestDefinitionIndex = hardenedDefinitions.at(-1)?.index ?? -1
    const finalActionFor = (role: string) =>
      privilegeActions.filter((action) => action.roles.includes(role)).at(-1)
    const publicAction = finalActionFor("public")
    const anonAction = finalActionFor("anon")
    const authenticatedAction = finalActionFor("authenticated")
    const grantedRolesAfterLatestDefinition = privilegeActions
      .filter((action) => action.action === "GRANT" && action.index > latestDefinitionIndex)
      .flatMap((action) => action.roles)

    expect(normalizedFunction).toContain("SECURITY DEFINER")
    expect(normalizedFunction).toContain("SET search_path = public, pg_temp")
    expect(latestDefinitionIndex).toBeGreaterThan(-1)
    expect(publicAction).toMatchObject({ action: "REVOKE" })
    expect(anonAction).toMatchObject({ action: "REVOKE" })
    expect(authenticatedAction).toMatchObject({ action: "GRANT" })
    expect(publicAction!.index).toBeGreaterThan(latestDefinitionIndex)
    expect(anonAction!.index).toBeGreaterThan(latestDefinitionIndex)
    expect(authenticatedAction!.index).toBeGreaterThan(latestDefinitionIndex)
    expect([...new Set(grantedRolesAfterLatestDefinition)]).toEqual(["authenticated"])
    expect(normalizedMigration).toMatch(
      /REVOKE (?:ALL|EXECUTE) ON FUNCTION public\.dinh_muc_thiet_bi_unlink\(BIGINT\[\], BIGINT\)[^;]*authenticated[^;]*;/i
    )
    expect(normalizedMigration).toContain(
      "DROP FUNCTION IF EXISTS public.dinh_muc_thiet_bi_unlink(BIGINT[], BIGINT)"
    )
    expect(getFinalUnlinkSignatures(migrationSql)).toEqual(["BIGINT[],BIGINT,BIGINT"])
  })
})
