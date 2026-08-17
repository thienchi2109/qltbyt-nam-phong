import { maskSqlCommentsAndLiterals } from "./static-sql"

export type SqlFunctionBlock = {
  body: string
  bodyStart: number
  declaration: string
  name: string
}

export type SqlDoBlock = {
  body: string
  bodyStart: number
}

/** Extracts function declarations and bodies while retaining original body offsets. */
export function functionBlocks(content: string): SqlFunctionBlock[] {
  const statementSql = maskSqlCommentsAndLiterals(content)
  const matches = [
    ...statementSql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_".]+)/gi),
  ]

  return matches.map((match, index) => {
    const functionStart = match.index ?? 0
    const functionContent = content.slice(functionStart, matches[index + 1]?.index)
    const bodyMatch = /\bAS\s+(\$[a-zA-Z0-9_]*\$)/iu.exec(functionContent)
    const bodyStart =
      bodyMatch?.index === undefined
        ? undefined
        : functionStart + bodyMatch.index + bodyMatch[0].length
    const bodyEnd =
      bodyStart === undefined ? undefined : content.indexOf(bodyMatch?.[1] ?? "", bodyStart)

    return {
      body:
        bodyStart === undefined || bodyEnd === undefined || bodyEnd === -1
          ? ""
          : content.slice(bodyStart, bodyEnd),
      bodyStart: bodyStart ?? functionStart,
      declaration:
        bodyMatch?.index === undefined
          ? functionContent
          : functionContent.slice(0, bodyMatch.index),
      name: match[1].replaceAll('"', "").toLowerCase(),
    }
  })
}

/** Lists normalized function names from executable CREATE FUNCTION declarations. */
export function functionNames(content: string): string[] {
  return functionBlocks(content).map((block) => block.name)
}

/** Extracts dollar-quoted DO bodies only when the outer DO is executable SQL. */
export function doBlocks(content: string): SqlDoBlock[] {
  const statementSql = maskSqlCommentsAndLiterals(content)

  return [...statementSql.matchAll(/\bDO\b/gi)].flatMap((match) => {
    const statementStart = match.index ?? 0
    const statementEnd = statementSql.indexOf(";", statementStart)
    const statement = content.slice(
      statementStart,
      statementEnd === -1 ? content.length : statementEnd + 1
    )
    const delimiterMatch = /\$[a-zA-Z0-9_]*\$/u.exec(statement)
    if (delimiterMatch?.index === undefined) {
      return []
    }
    const delimiter = delimiterMatch[0]
    const bodyStart = statementStart + delimiterMatch.index + delimiter.length
    const bodyEnd = content.indexOf(delimiter, bodyStart)
    if (bodyEnd === -1 || (statementEnd !== -1 && bodyEnd > statementEnd)) {
      return []
    }

    return [{ body: content.slice(bodyStart, bodyEnd), bodyStart }]
  })
}

function escapedFunctionName(functionName: string): string {
  return functionName.replace(".", "\\.")
}

/** Lists roles granted direct or schema-wide execution for a function. */
export function functionGrantGrantees(content: string, functionName: string): Set<string> {
  const statementSql = maskSqlCommentsAndLiterals(content)
  const escapedName = escapedFunctionName(functionName)
  const grantPattern = new RegExp(
    `GRANT\\s+(?:EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+FUNCTION\\s+${escapedName}\\s*\\([^)]*\\)\\s+TO\\s+([^;]+);`,
    "gi"
  )
  const schema = functionName.split(".")[0]
  const schemaGrantPattern = new RegExp(
    `GRANT\\s+(?:EXECUTE|ALL(?:\\s+PRIVILEGES)?)\\s+ON\\s+ALL\\s+FUNCTIONS\\s+IN\\s+SCHEMA\\s+${schema}\\s+TO\\s+([^;]+);`,
    "gi"
  )

  return new Set(
    [...statementSql.matchAll(grantPattern), ...statementSql.matchAll(schemaGrantPattern)].flatMap(
      (match) =>
        match[1]
          .split(",")
          .map((grantee) => grantee.trim().replaceAll('"', "").toLowerCase())
          .filter(Boolean)
    )
  )
}

/** Verifies a function has an explicit PUBLIC execute revoke. */
export function hasPublicFunctionRevoke(content: string, functionName: string): boolean {
  const statementSql = maskSqlCommentsAndLiterals(content)
  const escapedName = escapedFunctionName(functionName)
  const revokePattern = new RegExp(
    `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${escapedName}\\s*\\([^)]*\\)\\s+FROM\\s+PUBLIC\\s*;`,
    "i"
  )

  return revokePattern.test(statementSql)
}

function createdTableReferences(content: string): string[] {
  const statementSql = maskSqlCommentsAndLiterals(content)
  return [
    ...statementSql.matchAll(
      /CREATE\s+(?:UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"?[a-zA-Z0-9_]+"?\s*\.\s*)?"?[a-zA-Z0-9_]+"?)/gi
    ),
  ].map((match) => match[1].replaceAll('"', "").replace(/\s+/g, "").toLowerCase())
}

/** Lists explicitly public tables created by supported CREATE TABLE forms. */
export function tableNames(content: string): string[] {
  return createdTableReferences(content).filter((tableName) => tableName.startsWith("public."))
}

/** Lists CREATE TABLE targets whose schema cannot be proven statically. */
export function unqualifiedTableNames(content: string): string[] {
  return createdTableReferences(content).filter((tableName) => !tableName.includes("."))
}

function escapedTableReference(tableName: string): string {
  const [schema, table] = tableName.split(".")

  return `"?${schema}"?\\s*\\.\\s*"?${table}"?`
}

/** Checks the deny-by-default grant contract for a public table. */
export function isExplicitGrantContractPresent(content: string, tableName: string): boolean {
  const statementSql = maskSqlCommentsAndLiterals(content)
  const escapedTable = escapedTableReference(tableName)
  const revokePattern = new RegExp(
    `REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+${escapedTable}\\s+FROM\\s+([^;]+);`,
    "gi"
  )
  const revokeGrantees = new Set(
    [...statementSql.matchAll(revokePattern)].flatMap((match) =>
      match[1]
        .split(",")
        .map((grantee) => grantee.trim().replaceAll('"', "").toLowerCase())
        .filter(Boolean)
    )
  )
  const grantAll = new RegExp(
    `GRANT\\s+ALL(?:\\s+PRIVILEGES)?\\s+ON\\s+TABLE\\s+${escapedTable}`,
    "i"
  )

  return (
    ["anon", "authenticated", "public"].every((grantee) => revokeGrantees.has(grantee)) &&
    !grantAll.test(statementSql)
  )
}

/** Identifies a public non-trigger function that is callable as an RPC. */
export function isCallablePublicRpc(functionBlock: SqlFunctionBlock): boolean {
  return (
    functionBlock.name.startsWith("public.") &&
    !/\bRETURNS\s+(?:SETOF\s+)?trigger\b/iu.test(
      maskSqlCommentsAndLiterals(functionBlock.declaration)
    )
  )
}
