import { tokenizeSqlSegment } from "./static-sql-tokens"
import type { SqlToken } from "./static-sql-tokens"

type ClaimAssignment = {
  end: number
  variable: string
}

type FailClosedGuard = {
  end: number
  start: number
}

function statementEnd(tokens: SqlToken[], start: number): number {
  const semicolon = tokens.findIndex((token, index) => index > start && token.value === ";")

  return semicolon === -1 ? tokens.length : semicolon
}

function isDirectClaimAssignment(expression: SqlToken[], claim: "app_role" | "user_id"): boolean {
  const words = expression.filter((token) => token.type === "word").map((token) => token.value)
  const strings = expression.filter((token) => token.type === "string").map((token) => token.value)
  const allowedWords = new Set(["current_setting", "json", "jsonb", "nullif", "true"])

  return (
    expression[0]?.value === "nullif" &&
    expression[1]?.value === "(" &&
    words.every((word) => allowedWords.has(word)) &&
    strings.length === 3 &&
    strings[0] === "request.jwt.claims" &&
    strings[1] === claim &&
    strings[2] === "" &&
    expression.some((token) => token.value === "->>") &&
    expression.some((token) => token.value === "true")
  )
}

function hasClaimAssignment(
  tokens: SqlToken[],
  claim: "app_role" | "user_id"
): ClaimAssignment | undefined {
  let assignment: ClaimAssignment | undefined

  for (let index = 0; index < tokens.length - 2; index += 1) {
    const variable = tokens[index]
    if (variable.type !== "word" || tokens[index + 1]?.value !== ":=") {
      continue
    }

    const end = statementEnd(tokens, index + 1)
    if (isDirectClaimAssignment(tokens.slice(index + 2, end), claim)) {
      assignment = { end, variable: variable.value }
    }
  }

  return assignment
}

function hasAssignmentInRange(
  tokens: SqlToken[],
  variable: string,
  startExclusive: number,
  endExclusive: number
): boolean {
  return tokens
    .slice(startExclusive + 1, endExclusive)
    .some(
      (token, index) =>
        token.value === variable && tokens[startExclusive + index + 2]?.value === ":="
    )
}

function guardEnd(tokens: SqlToken[], thenIndex: number): number | undefined {
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
  const checksNull = condition.some(
    (token, index) =>
      token.value === assignment.variable &&
      condition[index + 1]?.value === "is" &&
      condition[index + 2]?.value === "null"
  )
  const checksEmpty = condition.some(
    (token, index) =>
      token.value === assignment.variable &&
      condition[index + 1]?.value === "=" &&
      condition[index + 2]?.type === "string" &&
      condition[index + 2].value === ""
  )
  const permitted = new Set([assignment.variable, "is", "null", "or", "=", "(", ")"])

  return (
    checksNull &&
    (!requiresEmptyRoleGuard || checksEmpty) &&
    condition.every((token) =>
      token.type === "string" ? token.value === "" : permitted.has(token.value)
    )
  )
}

function hasSwallowedPermissionException(guard: SqlToken[]): boolean {
  return guard.some(
    (token, index) =>
      token.value === "exception" &&
      guard[index + 1]?.value === "when" &&
      !guard.slice(index + 1).some((handlerToken) => handlerToken.value === "raise")
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
    const raisesException = guard.some(
      (token, cursor) =>
        token.value === "raise" &&
        guard[cursor + 1]?.type === "word" &&
        guard[cursor + 1].value === "exception"
    )
    const hasPermissionCode = guard.some(
      (token, cursor) =>
        token.value === "errcode" &&
        guard[cursor + 1]?.value === "=" &&
        guard[cursor + 2]?.type === "string" &&
        guard[cursor + 2].value === "42501"
    )

    if (
      raisesException &&
      hasPermissionCode &&
      !hasSwallowedPermissionException(guard) &&
      !hasAssignmentInRange(tokens, assignment.variable, assignment.end, index)
    ) {
      return { end, start: index }
    }
  }

  return undefined
}

function hasBusinessSqlBeforeGuard(tokens: SqlToken[], guard: FailClosedGuard): boolean {
  const businessWords = new Set([
    "call",
    "delete",
    "execute",
    "insert",
    "merge",
    "perform",
    "return",
    "select",
    "update",
  ])

  return tokens
    .slice(0, guard.start)
    .some((token) => token.type === "word" && businessWords.has(token.value))
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
    !hasAssignmentInRange(tokens, roleVariable.variable, roleGuard.end, tokens.length) &&
    !hasAssignmentInRange(tokens, userIdVariable.variable, userIdGuard.end, tokens.length)
  )
}
