import { maskSqlCommentsAndLiterals } from "./static-sql"
import {
  closingParenthesis,
  FUNCTION_IDENTIFIER,
  functionIdentity,
  normalizedArgumentTypes,
  normalizedIdentifier,
} from "./static-sql-function-identity"

export type SqlFunctionBlock = {
  argumentTypes: string[]
  body: string
  bodyStart: number
  declaration: string
  identity: string
  name: string
  start: number
}

export type SqlDoBlock = {
  body: string
  bodyStart: number
}

/** Extracts function declarations and bodies while retaining original body offsets. */
export function functionBlocks(content: string): SqlFunctionBlock[] {
  const statementSql = maskSqlCommentsAndLiterals(content)
  const matches = [
    ...statementSql.matchAll(
      new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+${FUNCTION_IDENTIFIER}\\s*\\(`, "gi")
    ),
  ]

  return matches.map((match, index) => {
    const functionStart = match.index ?? 0
    const functionContent = content.slice(functionStart, matches[index + 1]?.index)
    const argumentStart = functionStart + match[0].lastIndexOf("(") + 1
    const argumentEnd = closingParenthesis(statementSql, argumentStart - 1)
    const argumentTypes = normalizedArgumentTypes(
      statementSql.slice(argumentStart, argumentEnd),
      true
    )
    const bodyMatch = /\bAS\s+(\$[a-zA-Z0-9_]*\$)/iu.exec(functionContent)
    const bodyStart =
      bodyMatch?.index === undefined
        ? undefined
        : functionStart + bodyMatch.index + bodyMatch[0].length
    const bodyEnd =
      bodyStart === undefined ? undefined : content.indexOf(bodyMatch?.[1] ?? "", bodyStart)

    const name = normalizedIdentifier(match[1])

    return {
      argumentTypes,
      body:
        bodyStart === undefined || bodyEnd === undefined || bodyEnd === -1
          ? ""
          : content.slice(bodyStart, bodyEnd),
      bodyStart: bodyStart ?? functionStart,
      declaration:
        bodyMatch?.index === undefined
          ? functionContent
          : functionContent.slice(0, bodyMatch.index),
      identity: functionIdentity(name, argumentTypes),
      name,
      start: functionStart,
    }
  })
}

/** Lists normalized function names from executable CREATE FUNCTION declarations. */
export function functionNames(content: string): string[] {
  return functionBlocks(content).map((block) => block.name)
}

/** Lists function names whose overloads make name-only ACL analysis ambiguous. */
export function ambiguousFunctionNames(blocks: SqlFunctionBlock[]): Set<string> {
  const counts = new Map<string, number>()
  for (const block of blocks) {
    counts.set(block.name, (counts.get(block.name) ?? 0) + 1)
  }

  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name))
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

type FunctionAclEvent = {
  action: "grant" | "revoke"
  grantees: string[]
  index: number
}

function normalizedGrantees(value: string): string[] {
  return value
    .replace(/\s+WITH\s+GRANT\s+OPTION\s*$/iu, "")
    .split(",")
    .map((grantee) => {
      const trimmed = grantee.trim()
      return trimmed.startsWith('"') && trimmed.endsWith('"')
        ? trimmed.slice(1, -1).replaceAll('""', '"')
        : trimmed.toLowerCase()
    })
    .filter(Boolean)
}

function functionAclEvents(content: string, functionBlock: SqlFunctionBlock): FunctionAclEvent[] {
  const statementSql = maskSqlCommentsAndLiterals(content)
  const events: FunctionAclEvent[] = []
  const schema = functionBlock.name.split(".")[0]
  let statementStart = 0

  for (let index = 0; index < statementSql.length; index += 1) {
    if (statementSql[index] !== ";") {
      continue
    }
    const statement = statementSql.slice(statementStart, index + 1)
    const actionMatch = /^\s*(GRANT|REVOKE)\s+(?:EXECUTE|ALL(?:\s+PRIVILEGES)?)\s+ON\s+/iu.exec(
      statement
    )
    if (actionMatch === null) {
      statementStart = index + 1
      continue
    }
    const action = actionMatch[1].toLowerCase() as FunctionAclEvent["action"]
    const objectMatch = new RegExp(
      `\\bFUNCTION\\s+${FUNCTION_IDENTIFIER}\\s*\\(([\\s\\S]*)\\)\\s+(TO|FROM)\\s+([^;]+);`,
      "iu"
    ).exec(statement)
    if (objectMatch !== null) {
      const name = normalizedIdentifier(objectMatch[1])
      const identity = functionIdentity(name, normalizedArgumentTypes(objectMatch[2], false))
      if (identity === functionBlock.identity) {
        events.push({
          action,
          grantees: normalizedGrantees(objectMatch[4]),
          index: statementStart + (actionMatch.index ?? 0),
        })
      }
      statementStart = index + 1
      continue
    }

    const schemaMatch = new RegExp(
      `\\bALL\\s+FUNCTIONS\\s+IN\\s+SCHEMA\\s+("[a-zA-Z0-9_]+"|[a-zA-Z0-9_]+)\\s+(TO|FROM)\\s+([^;]+);`,
      "iu"
    ).exec(statement)
    if (
      schemaMatch !== null &&
      normalizedIdentifier(schemaMatch[1]) === schema &&
      statementStart > functionBlock.start
    ) {
      events.push({
        action,
        grantees: normalizedGrantees(schemaMatch[3]),
        index: statementStart + (actionMatch.index ?? 0),
      })
    }
    statementStart = index + 1
  }

  return events.sort((left, right) => left.index - right.index)
}

/** Lists roles with execution privilege after replaying migration ACL statements. */
export function functionGrantGrantees(
  content: string,
  functionBlock: SqlFunctionBlock
): Set<string> {
  const granted = new Set<string>()
  for (const event of functionAclEvents(content, functionBlock)) {
    for (const grantee of event.grantees) {
      if (event.action === "grant") {
        granted.add(grantee)
      } else {
        granted.delete(grantee)
      }
    }
  }

  return granted
}

/** Lists roles explicitly revoked from executing a function. */
export function functionRevokeGrantees(
  content: string,
  functionBlock: SqlFunctionBlock
): Set<string> {
  const revoked = new Set<string>()
  for (const event of functionAclEvents(content, functionBlock)) {
    for (const grantee of event.grantees) {
      if (event.action === "revoke") {
        revoked.add(grantee)
      } else {
        revoked.delete(grantee)
      }
    }
  }

  return revoked
}

/** Verifies a function has an explicit PUBLIC execute revoke. */
export function hasPublicFunctionRevoke(content: string, functionBlock: SqlFunctionBlock): boolean {
  return functionRevokeGrantees(content, functionBlock).has("public")
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

/** Identifies a public non-trigger function subject to JWT authorization checks. */
export function isPublicNonTriggerFunction(functionBlock: SqlFunctionBlock): boolean {
  return (
    functionBlock.name.startsWith("public.") &&
    !/\bRETURNS\s+(?:SETOF\s+)?trigger\b/iu.test(
      maskSqlCommentsAndLiterals(functionBlock.declaration)
    )
  )
}

/** Identifies an underscore-prefixed public function reserved for internal delegation. */
export function isInternalPublicHelper(functionBlock: SqlFunctionBlock): boolean {
  return (
    isPublicNonTriggerFunction(functionBlock) &&
    functionBlock.name.slice("public.".length).startsWith("_")
  )
}

/** Identifies a public Data API RPC entrypoint rather than an internal helper. */
export function isCallablePublicRpc(functionBlock: SqlFunctionBlock): boolean {
  return isPublicNonTriggerFunction(functionBlock) && !isInternalPublicHelper(functionBlock)
}
