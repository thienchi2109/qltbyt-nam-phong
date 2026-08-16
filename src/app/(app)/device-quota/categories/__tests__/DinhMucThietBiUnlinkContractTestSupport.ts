import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { expect } from "vitest"

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

export function getFinalUnlinkSignatures(migrationSql: string) {
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

export function getUnlinkPrivilegeActions(normalizedMigration: string) {
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

export function readAffectedMutationStatement(normalizedBody: string) {
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

export function expectConjunctivePredicates(whereClause: string, predicates: RegExp[]) {
  expect(whereClause).not.toMatch(/\bOR\b/i)
  const conjuncts = whereClause.split(/\bAND\b/i)
  expect(conjuncts.length).toBeGreaterThanOrEqual(predicates.length)
  for (const predicate of predicates) {
    expect(conjuncts.some((conjunct) => predicate.test(conjunct))).toBe(true)
  }
}

export function getDataMutationOperations(normalizedBody: string) {
  return Array.from(
    normalizedBody.matchAll(
      /\b(UPDATE|INSERT\s+INTO|DELETE\s+FROM|MERGE\s+INTO|TRUNCATE(?:\s+TABLE)?)\s+((?:public\.)?[a-z_][a-z0-9_]*)\b/gi
    ),
    (match) => `${match[1].replace(/\s+/g, " ").toUpperCase()} ${match[2].toLowerCase()}`
  )
}

export function readLatestUnlinkMigration() {
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
