/** Matches a supported qualified or unqualified SQL function identifier. */
export const FUNCTION_IDENTIFIER =
  '((?:(?:"[a-zA-Z0-9_]+"|[a-zA-Z0-9_]+)\\s*\\.\\s*)?(?:"[a-zA-Z0-9_]+"|[a-zA-Z0-9_]+))'

/** Normalizes a possibly quoted SQL identifier for static identity comparison. */
export function normalizedIdentifier(value: string): string {
  return value
    .split(/\s*\.\s*/u)
    .map((part) => {
      const trimmed = part.trim()
      return trimmed.startsWith('"') && trimmed.endsWith('"')
        ? trimmed.slice(1, -1).replaceAll('""', '"')
        : trimmed.toLowerCase()
    })
    .join(".")
}

/** Finds the closing parenthesis for a function argument list. */
export function closingParenthesis(content: string, openingIndex: number): number {
  let depth = 0

  for (let index = openingIndex; index < content.length; index += 1) {
    depth += content[index] === "(" ? 1 : content[index] === ")" ? -1 : 0
    if (depth === 0) {
      return index
    }
  }

  return content.length
}

function splitFunctionArguments(value: string): string[] {
  const argumentsList: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < value.length; index += 1) {
    depth += value[index] === "(" ? 1 : value[index] === ")" ? -1 : 0
    if (depth === 0 && value[index] === ",") {
      argumentsList.push(value.slice(start, index))
      start = index + 1
    }
  }
  argumentsList.push(value.slice(start))

  return argumentsList.map((argument) => argument.trim()).filter(Boolean)
}

function withoutArgumentDefault(value: string): string {
  let depth = 0

  for (let index = 0; index < value.length; index += 1) {
    depth += value[index] === "(" ? 1 : value[index] === ")" ? -1 : 0
    if (depth !== 0) {
      continue
    }
    if (value[index] === "=") {
      return value.slice(0, index)
    }
    if (/^default\b/iu.test(value.slice(index)) && (index === 0 || /\s/u.test(value[index - 1]))) {
      return value.slice(0, index)
    }
  }

  return value
}

function normalizeUnquotedWords(value: string): string {
  let normalized = ""
  let quoted = false

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') {
      if (quoted && value[index + 1] === '"') {
        normalized += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    normalized += quoted ? value[index] : value[index].toLowerCase()
  }

  return normalized
}

function normalizedArgumentType(value: string, declaration: boolean): string | undefined {
  let normalized = withoutArgumentDefault(value).trim().replace(/\s+/gu, " ")
  const modeMatch = /^(inout|in|out|variadic)\s+/iu.exec(normalized)
  const mode = modeMatch?.[1].toLowerCase()
  if (mode === "out") {
    return undefined
  }
  if (modeMatch !== null) {
    normalized = normalized.slice(modeMatch[0].length).trim()
  }

  if (declaration) {
    const firstSpace = normalized.indexOf(" ")
    const firstWord = firstSpace === -1 ? normalized : normalized.slice(0, firstSpace)
    const typeFirstWords = new Set([
      "bigint",
      "bit",
      "boolean",
      "box",
      "bytea",
      "character",
      "cidr",
      "date",
      "decimal",
      "double",
      "inet",
      "integer",
      "interval",
      "json",
      "jsonb",
      "macaddr",
      "money",
      "numeric",
      "real",
      "record",
      "smallint",
      "text",
      "time",
      "timestamp",
      "uuid",
      "varchar",
      "xml",
    ])
    if (
      firstSpace !== -1 &&
      !typeFirstWords.has(normalizeUnquotedWords(firstWord)) &&
      !firstWord.includes(".")
    ) {
      normalized = normalized.slice(firstSpace + 1).trim()
    }
  }

  return normalizeUnquotedWords(normalized)
    .replace(/\s*\.\s*/gu, ".")
    .replace(/\s*\[\s*\]/gu, "[]")
    .replace(/\s*\(\s*/gu, "(")
    .replace(/\s*\)\s*/gu, ")")
    .replace(/\s*,\s*/gu, ",")
}

/** Normalizes function input types from a declaration or ACL signature. */
export function normalizedArgumentTypes(value: string, declaration: boolean): string[] {
  return splitFunctionArguments(value).flatMap((argument) => {
    const type = normalizedArgumentType(argument, declaration)
    return type === undefined ? [] : [type]
  })
}

/** Builds the canonical schema-qualified function identity used for ACL replay. */
export function functionIdentity(name: string, argumentTypes: string[]): string {
  return `${name}(${argumentTypes.join(",")})`
}
