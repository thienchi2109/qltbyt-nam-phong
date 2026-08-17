import type { SqlToken } from "./static-sql-tokens"

function statementEnd(tokens: SqlToken[], start: number): number {
  const semicolon = tokens.findIndex((token, index) => index > start && token.value === ";")

  return semicolon === -1 ? tokens.length : semicolon
}

function findClosingParenthesis(tokens: SqlToken[], openingIndex: number): number | undefined {
  let depth = 0

  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index].value === "(") {
      depth += 1
    } else if (tokens[index].value === ")") {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }

  return undefined
}

function isSanitizerDerivedExpression(expression: SqlToken[]): boolean {
  const sanitizerIndex = expression.findIndex(
    (token) => token.type === "word" && token.value === "_sanitize_ilike_pattern"
  )
  if (sanitizerIndex === -1 || expression[sanitizerIndex + 1]?.value !== "(") {
    return false
  }

  const closingParenthesis = findClosingParenthesis(expression, sanitizerIndex + 1)
  if (closingParenthesis === undefined) {
    return false
  }

  const prefix = expression.slice(0, sanitizerIndex)
  const suffix = expression.slice(closingParenthesis + 1)
  const prefixAllowed = prefix.every(
    (token) => token.value === "(" || token.value === "." || token.value === "public"
  )
  const typeWords = new Set(["character", "json", "jsonb", "text", "varchar"])
  const suffixAllowed = suffix.every(
    (token) =>
      token.value === ")" ||
      token.value === "::" ||
      (token.type === "word" && typeWords.has(token.value))
  )

  return prefixAllowed && suffixAllowed
}

function functionScopeStart(tokens: SqlToken[], beforeIndex: number): number {
  let start = 0

  for (let index = 0; index < beforeIndex; index += 1) {
    if (
      tokens[index]?.value === "function" &&
      tokens.slice(Math.max(0, index - 3), index).some((token) => token.value === "create")
    ) {
      start = index + 1
    }
  }

  return start
}

function sanitizerDerivedVariables(tokens: SqlToken[], beforeIndex: number): Set<string> {
  const assignments = new Map<string, boolean>()
  const scopeStart = functionScopeStart(tokens, beforeIndex)

  for (let index = scopeStart; index < beforeIndex - 1; index += 1) {
    if (tokens[index].type !== "word" || tokens[index + 1]?.value !== ":=") {
      continue
    }
    const expression = tokens.slice(index + 2, statementEnd(tokens, index + 1))
    assignments.set(tokens[index].value, isSanitizerDerivedExpression(expression))
  }

  return new Set(
    [...assignments].flatMap(([variable, sanitizerDerived]) => (sanitizerDerived ? [variable] : []))
  )
}

function expressionOperands(tokens: SqlToken[]): SqlToken[][] {
  const operands: SqlToken[][] = []
  let start = 0

  for (let index = 0; index <= tokens.length; index += 1) {
    if (index !== tokens.length && tokens[index].value !== "||") {
      continue
    }
    operands.push(tokens.slice(start, index))
    start = index + 1
  }

  return operands
}

function isVerifiedLikeOperand(operand: SqlToken[], sanitizedVariables: Set<string>): boolean {
  const words = operand.filter((token) => token.type === "word").map((token) => token.value)
  if (words.length === 0) {
    return true
  }
  if (isSanitizerDerivedExpression(operand)) {
    return true
  }

  const typeWords = new Set(["as", "character", "json", "jsonb", "text", "varchar"])
  return words.filter((word) => !typeWords.has(word)).every((word) => sanitizedVariables.has(word))
}

/** Detects unverified dynamic operands in LIKE and ILIKE expressions. */
export function hasRawLikePatternInTokens(tokens: SqlToken[]): boolean {
  return tokens.some((token, index) => {
    if (token.type !== "word" || (token.value !== "ilike" && token.value !== "like")) {
      return false
    }

    let depth = 0
    let expressionEnd = tokens.length
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const candidate = tokens[cursor]
      if (candidate.value === "(") {
        depth += 1
      } else if (candidate.value === ")" && depth > 0) {
        depth -= 1
      } else if (
        depth === 0 &&
        (candidate.value === ";" ||
          candidate.value === "and" ||
          candidate.value === "or" ||
          candidate.value === "escape")
      ) {
        expressionEnd = cursor
        break
      }
    }

    const sanitizedVariables = sanitizerDerivedVariables(tokens, index)
    return expressionOperands(tokens.slice(index + 1, expressionEnd)).some(
      (operand) => !isVerifiedLikeOperand(operand, sanitizedVariables)
    )
  })
}
