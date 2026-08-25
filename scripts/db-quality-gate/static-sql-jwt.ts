import {
  hasSwallowedPermissionException,
  hasSwallowedPermissionExceptionAround,
  isConditionallyNested,
} from "./static-sql-control-flow"
import { tokenizeSqlSegment } from "./static-sql-tokens"
import type { SqlToken } from "./static-sql-tokens"

export type ClaimAssignment = {
  end: number
  start: number
  variable: string
}

export type FailClosedGuard = {
  end: number
  start: number
}

/** Finds the token boundary for one semicolon-terminated PL/pgSQL statement. */
export function statementEnd(tokens: SqlToken[], start: number): number {
  const semicolon = tokens.findIndex((token, index) => index > start && token.value === ";")

  return semicolon === -1 ? tokens.length : semicolon
}

/** Recognizes PL/pgSQL assignment statements using either supported operator. */
export function isAssignmentStatement(tokens: SqlToken[], index: number): boolean {
  if (!["=", ":="].includes(tokens[index + 1]?.value)) {
    return false
  }

  return index === 0 || [";", "begin", "else", "then"].includes(tokens[index - 1]?.value)
}

function isDirectClaimAssignment(expression: SqlToken[], claim: "app_role" | "user_id"): boolean {
  const values = expression.map((token) => token.value)

  return ["json", "jsonb"].some(
    (cast) =>
      JSON.stringify(values) ===
      JSON.stringify([
        "nullif",
        "(",
        "current_setting",
        "(",
        "request.jwt.claims",
        ",",
        "true",
        ")",
        "::",
        cast,
        "->>",
        claim,
        ",",
        "",
        ")",
      ])
  )
}

function hasClaimAssignment(
  tokens: SqlToken[],
  claim: "app_role" | "user_id"
): ClaimAssignment | undefined {
  let assignment: ClaimAssignment | undefined

  for (let index = 0; index < tokens.length - 2; index += 1) {
    const variable = tokens[index]
    if (variable.type !== "word" || !isAssignmentStatement(tokens, index)) {
      continue
    }

    const end = statementEnd(tokens, index + 1)
    const assignmentCount = tokens.filter(
      (token, cursor) => token.value === variable.value && isAssignmentStatement(tokens, cursor)
    ).length
    if (
      !isConditionallyNested(tokens, index) &&
      isDirectClaimAssignment(tokens.slice(index + 2, end), claim) &&
      assignmentCount === 1
    ) {
      assignment = { end, start: index, variable: variable.value }
    }
  }

  return assignment
}

/** Detects a protected variable reassignment inside a token range. */
export function hasAssignmentInRange(
  tokens: SqlToken[],
  variable: string,
  startExclusive: number,
  endExclusive: number
): boolean {
  for (let index = startExclusive + 1; index < endExclusive; index += 1) {
    if (tokens[index].value === variable && isAssignmentStatement(tokens, index)) {
      return true
    }
  }

  return false
}

/** Finds the matching END IF token for a guard that starts at THEN. */
export function guardEnd(tokens: SqlToken[], thenIndex: number): number | undefined {
  let depth = 1

  for (let index = thenIndex + 1; index < tokens.length - 1; index += 1) {
    if (tokens[index].value === "if") {
      depth += 1
    }
    if (tokens[index].value === "end" && tokens[index + 1]?.value === "if") {
      depth -= 1
      if (depth === 0) {
        return index + 1
      }
    }
  }

  return undefined
}

function isExactFailClosedCondition(
  condition: SqlToken[],
  assignment: ClaimAssignment,
  requiresEmptyRoleGuard: boolean
): boolean {
  const normalized = condition.filter((token) => !["(", ")"].includes(token.value))
  const nullCheck = [assignment.variable, "is", "null"]
  const emptyCheck = [assignment.variable, "=", ""]
  const values = normalized.map((token) => token.value)

  if (!requiresEmptyRoleGuard) {
    return JSON.stringify(values) === JSON.stringify(nullCheck)
  }

  return [
    [...nullCheck, "or", ...emptyCheck],
    [...emptyCheck, "or", ...nullCheck],
  ].some((expected) => JSON.stringify(values) === JSON.stringify(expected))
}

/** Requires a denial branch to contain only one static 42501 exception. */
export function hasOnlyStaticPermissionRaise(tokens: SqlToken[]): boolean {
  const semicolon = tokens.findIndex((token) => token.value === ";")
  if (
    tokens[0]?.value !== "raise" ||
    tokens[1]?.value !== "exception" ||
    semicolon !== tokens.length - 1
  ) {
    return false
  }

  const statement = tokens.slice(0, semicolon)
  const allowedWords = new Set([
    "column",
    "constraint",
    "datatype",
    "detail",
    "errcode",
    "exception",
    "hint",
    "message",
    "raise",
    "schema",
    "table",
    "using",
  ])
  const hasPermissionCode = statement.some(
    (token, index) =>
      token.value === "errcode" &&
      statement[index + 1]?.value === "=" &&
      statement[index + 2]?.type === "string" &&
      statement[index + 2].value === "42501"
  )

  return (
    hasPermissionCode &&
    statement.every(
      (token) =>
        token.type === "string" ||
        (token.type === "word" && allowedWords.has(token.value)) ||
        (token.type === "symbol" && [",", "="].includes(token.value))
    )
  )
}

function findFailClosedGuard(
  tokens: SqlToken[],
  assignment: ClaimAssignment,
  requiresEmptyRoleGuard: boolean
): FailClosedGuard | undefined {
  for (let index = assignment.end + 1; index < tokens.length; index += 1) {
    if (tokens[index].value !== "if") {
      continue
    }
    if (isConditionallyNested(tokens, index)) {
      continue
    }
    const thenIndex = tokens.findIndex((token, cursor) => cursor > index && token.value === "then")
    if (thenIndex === -1) {
      continue
    }
    const condition = tokens.slice(index + 1, thenIndex)
    if (!isExactFailClosedCondition(condition, assignment, requiresEmptyRoleGuard)) {
      continue
    }
    const end = guardEnd(tokens, thenIndex)
    if (end === undefined) {
      continue
    }
    const guard = tokens.slice(thenIndex + 1, end - 1)

    if (
      hasOnlyStaticPermissionRaise(guard) &&
      !hasSwallowedPermissionException(guard) &&
      !hasAssignmentInRange(tokens, assignment.variable, assignment.end, index)
    ) {
      return { end, start: index }
    }
  }

  return undefined
}

/** Detects SQL work that executes before the authorization guard begins. */
export function hasBusinessSqlBeforeGuard(tokens: SqlToken[], guard: FailClosedGuard): boolean {
  const businessWords = new Set([
    "alter",
    "analyze",
    "assert",
    "call",
    "close",
    "commit",
    "copy",
    "create",
    "delete",
    "discard",
    "do",
    "drop",
    "execute",
    "explain",
    "fetch",
    "get",
    "grant",
    "insert",
    "listen",
    "load",
    "lock",
    "merge",
    "move",
    "notify",
    "open",
    "perform",
    "prepare",
    "reassign",
    "refresh",
    "reindex",
    "reset",
    "revoke",
    "rollback",
    "return",
    "security",
    "select",
    "set",
    "show",
    "start",
    "truncate",
    "unlisten",
    "update",
    "vacuum",
    "values",
    "with",
  ])

  const allowedFunctions = new Set(["coalesce", "current_setting", "lower", "nullif"])
  const beforeGuard = tokens.slice(0, guard.start)
  const beginIndex = beforeGuard.findIndex((token) => token.value === "begin")
  const declaration = beginIndex === -1 ? [] : beforeGuard.slice(0, beginIndex)

  return (
    beforeGuard.some(
      (token, index) =>
        (token.type === "word" && businessWords.has(token.value)) ||
        (token.type === "word" &&
          beforeGuard[index + 1]?.value === "." &&
          beforeGuard[index + 2]?.type === "word" &&
          beforeGuard[index + 3]?.value === "(") ||
        (token.type === "word" &&
          beforeGuard[index + 1]?.value === "(" &&
          !allowedFunctions.has(token.value))
    ) || declaration.some((token) => ["=", ":=", "default"].includes(token.value))
  )
}

/** Requires real role/user claim extraction plus fail-closed permission guards. */
export function hasFailClosedJwtGuards(content: string): boolean {
  const tokens = tokenizeSqlSegment(content)
  const roleVariable = hasClaimAssignment(tokens, "app_role")
  const userIdVariable = hasClaimAssignment(tokens, "user_id")
  const roleGuard =
    roleVariable === undefined ? undefined : findFailClosedGuard(tokens, roleVariable, true)
  const userIdGuard =
    userIdVariable === undefined ? undefined : findFailClosedGuard(tokens, userIdVariable, false)

  return (
    roleVariable !== undefined &&
    userIdVariable !== undefined &&
    roleGuard !== undefined &&
    userIdGuard !== undefined &&
    !hasBusinessSqlBeforeGuard(tokens, roleGuard) &&
    !hasBusinessSqlBeforeGuard(tokens, userIdGuard) &&
    !hasSwallowedPermissionExceptionAround(tokens, roleGuard.start) &&
    !hasSwallowedPermissionExceptionAround(tokens, userIdGuard.start) &&
    !hasAssignmentInRange(tokens, roleVariable.variable, roleGuard.end, tokens.length) &&
    !hasAssignmentInRange(tokens, userIdVariable.variable, userIdGuard.end, tokens.length)
  )
}
