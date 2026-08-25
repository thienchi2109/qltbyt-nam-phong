import {
  guardEnd,
  hasAssignmentInRange,
  hasBusinessSqlBeforeGuard,
  hasOnlyStaticPermissionRaise,
  isAssignmentStatement,
  statementEnd,
} from "./static-sql-jwt"
import type { ClaimAssignment, FailClosedGuard } from "./static-sql-jwt"
import {
  hasSwallowedPermissionException,
  hasSwallowedPermissionExceptionAround,
  isConditionallyNested,
} from "./static-sql-control-flow"
import { tokenizeSqlSegment } from "./static-sql-tokens"
import type { SqlToken } from "./static-sql-tokens"

function claimSourceAssignments(tokens: SqlToken[]): Map<string, ClaimAssignment> {
  const assignments = new Map<string, ClaimAssignment>()

  for (let index = 0; index < tokens.length - 2; index += 1) {
    if (tokens[index].type !== "word" || !isAssignmentStatement(tokens, index)) {
      continue
    }
    const end = statementEnd(tokens, index + 1)
    const expression = tokens.slice(index + 2, end)
    const values = expression.map((token) => token.value)
    const variable = tokens[index].value
    const assignmentCount = tokens.filter(
      (token, cursor) => token.value === variable && isAssignmentStatement(tokens, cursor)
    ).length

    if (
      !isConditionallyNested(tokens, index) &&
      JSON.stringify(values) ===
        JSON.stringify([
          "coalesce",
          "(",
          "nullif",
          "(",
          "current_setting",
          "(",
          "request.jwt.claims",
          ",",
          "true",
          ")",
          ",",
          "",
          ")",
          ",",
          "{}",
          ")",
          "::",
          "jsonb",
        ]) &&
      assignmentCount === 1
    ) {
      assignments.set(variable, { end, start: index, variable })
    }
  }

  return assignments
}

function indirectClaimAssignment(
  tokens: SqlToken[],
  claim: "app_role" | "user_id",
  claimSources: Map<string, ClaimAssignment>,
  allowRoleClaimFallback: boolean
): ClaimAssignment | undefined {
  let assignment: ClaimAssignment | undefined

  for (let index = 0; index < tokens.length - 2; index += 1) {
    const variable = tokens[index]
    if (variable.type !== "word" || !isAssignmentStatement(tokens, index)) {
      continue
    }
    const end = statementEnd(tokens, index + 1)
    const expression = tokens.slice(index + 2, end)
    const values = expression.map((token) => token.value)
    const source = values.find(
      (value) => claimSources.has(value) && claimSources.get(value)!.end < index
    )
    const directAccess =
      source === undefined ? [] : ["nullif", "(", source, "->>", claim, ",", "", ")"]
    const exactExpressions =
      claim === "app_role"
        ? [
            directAccess,
            ["lower", "(", ...directAccess, ")"],
            ...(allowRoleClaimFallback && source !== undefined
              ? [
                  [
                    "lower",
                    "(",
                    "coalesce",
                    "(",
                    "nullif",
                    "(",
                    source,
                    "->>",
                    "app_role",
                    ",",
                    "",
                    ")",
                    ",",
                    "nullif",
                    "(",
                    source,
                    "->>",
                    "role",
                    ",",
                    "",
                    ")",
                    ")",
                    ")",
                  ],
                ]
              : []),
          ]
        : [
            directAccess,
            ...["bigint", "integer", "text"].map((cast) => [...directAccess, "::", cast]),
          ]
    const assignmentCount = tokens.filter(
      (token, cursor) => token.value === variable.value && isAssignmentStatement(tokens, cursor)
    ).length

    if (
      !isConditionallyNested(tokens, index) &&
      source !== undefined &&
      exactExpressions.some((expected) => JSON.stringify(values) === JSON.stringify(expected)) &&
      assignmentCount === 1
    ) {
      assignment = { end, start: index, variable: variable.value }
    }
  }

  return assignment
}

function stripOuterParentheses(tokens: SqlToken[]): SqlToken[] {
  let result = tokens

  while (result[0]?.value === "(" && result.at(-1)?.value === ")") {
    let depth = 0
    let closesAtEnd = false
    for (let index = 0; index < result.length; index += 1) {
      depth += result[index].value === "(" ? 1 : result[index].value === ")" ? -1 : 0
      if (depth === 0) {
        closesAtEnd = index === result.length - 1
        break
      }
    }
    if (!closesAtEnd) {
      break
    }
    result = result.slice(1, -1)
  }

  return result
}

function topLevelOrOperands(condition: SqlToken[]): SqlToken[][] {
  const operands: SqlToken[][] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < condition.length; index += 1) {
    depth += condition[index].value === "(" ? 1 : condition[index].value === ")" ? -1 : 0
    if (depth === 0 && condition[index].value === "or") {
      operands.push(condition.slice(start, index))
      start = index + 1
    }
  }
  operands.push(condition.slice(start))

  return operands
}

function isExactNullCheck(operand: SqlToken[], variable: string): boolean {
  const values = stripOuterParentheses(operand).map((token) => token.value)
  return JSON.stringify(values) === JSON.stringify([variable, "is", "null"])
}

function hasUnsafeConditionCall(condition: SqlToken[]): boolean {
  const safeCallWords = new Set(["exists", "in", "not"])

  return condition.some(
    (token, index) =>
      token.type === "word" &&
      condition[index + 1]?.value === "(" &&
      (condition[index - 1]?.value === "." || !safeCallWords.has(token.value))
  )
}

function hasFailClosedParsingHandler(tokens: SqlToken[], guardStart: number): boolean {
  const handler = tokens.slice(0, guardStart)
  const exceptionIndex = handler.findIndex((token) => token.value === "exception")
  if (exceptionIndex === -1) {
    return false
  }
  const exceptionHandler = handler.slice(exceptionIndex)
  const raiseIndex = exceptionHandler.findIndex(
    (token, index) =>
      token.value === "raise" &&
      exceptionHandler[index + 1]?.type === "word" &&
      exceptionHandler[index + 1].value === "exception"
  )
  const raiseEnd = raiseIndex === -1 ? -1 : statementEnd(exceptionHandler, raiseIndex + 1)

  return (
    raiseIndex !== -1 &&
    hasOnlyStaticPermissionRaise(exceptionHandler.slice(raiseIndex, raiseEnd + 1)) &&
    !hasSwallowedPermissionException(exceptionHandler)
  )
}

function combinedFailClosedGuard(
  tokens: SqlToken[],
  roleAssignment: ClaimAssignment,
  userIdAssignment: ClaimAssignment
): FailClosedGuard | undefined {
  const assignmentEnd = Math.max(roleAssignment.end, userIdAssignment.end)

  for (let index = assignmentEnd + 1; index < tokens.length; index += 1) {
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
    const operands = topLevelOrOperands(stripOuterParentheses(condition))
    const hasRequiredNullChecks =
      (isExactNullCheck(operands[0] ?? [], roleAssignment.variable) &&
        isExactNullCheck(operands[1] ?? [], userIdAssignment.variable)) ||
      (isExactNullCheck(operands[0] ?? [], userIdAssignment.variable) &&
        isExactNullCheck(operands[1] ?? [], roleAssignment.variable))
    if (!hasRequiredNullChecks || operands.length < 2 || hasUnsafeConditionCall(condition)) {
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
      !hasAssignmentInRange(tokens, roleAssignment.variable, roleAssignment.end, index) &&
      !hasAssignmentInRange(tokens, userIdAssignment.variable, userIdAssignment.end, index)
    ) {
      return { end, start: index }
    }
  }

  return undefined
}

/** Recognizes a claims-object guard with parse failure and combined 42501 checks. */
export function hasCanonicalClaimsObjectGuard(
  content: string,
  options: { allowRoleClaimFallback?: boolean } = {}
): boolean {
  const tokens = tokenizeSqlSegment(content)
  const claimSources = claimSourceAssignments(tokens)
  const roleAssignment = indirectClaimAssignment(
    tokens,
    "app_role",
    claimSources,
    options.allowRoleClaimFallback === true
  )
  const userIdAssignment = indirectClaimAssignment(tokens, "user_id", claimSources, false)
  if (roleAssignment === undefined || userIdAssignment === undefined) {
    return false
  }
  const guard = combinedFailClosedGuard(tokens, roleAssignment, userIdAssignment)
  const assignmentEnd = Math.max(roleAssignment.end, userIdAssignment.end)

  return (
    guard !== undefined &&
    hasFailClosedParsingHandler(tokens.slice(assignmentEnd + 1), guard.start - assignmentEnd - 1) &&
    !hasBusinessSqlBeforeGuard(tokens, guard) &&
    !hasSwallowedPermissionExceptionAround(tokens, guard.start) &&
    [...claimSources.values()].every(
      (source) => !hasAssignmentInRange(tokens, source.variable, source.end, tokens.length)
    ) &&
    !hasAssignmentInRange(tokens, roleAssignment.variable, guard.end, tokens.length) &&
    !hasAssignmentInRange(tokens, userIdAssignment.variable, guard.end, tokens.length)
  )
}
