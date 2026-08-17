export type SqlToken = {
  type: "string" | "symbol" | "word"
  value: string
}

function whitespaceMask(value: string): string {
  return value.replace(/[^\n]/g, " ")
}

function dollarQuoteDelimiter(content: string, index: number): string | undefined {
  const match = /^\$[a-zA-Z0-9_]*\$/u.exec(content.slice(index))

  return match?.[0]
}

function blockCommentEnd(content: string, index: number): number {
  let cursor = index
  let depth = 0

  while (cursor < content.length) {
    if (content.startsWith("/*", cursor)) {
      depth += 1
      cursor += 2
      continue
    }
    if (content.startsWith("*/", cursor)) {
      depth -= 1
      cursor += 2
      if (depth === 0) {
        return cursor
      }
      continue
    }
    cursor += 1
  }

  return content.length
}

/** Masks non-executable comments and quoted values while preserving source offsets. */
export function maskSqlCommentsAndLiterals(content: string): string {
  let result = ""
  let index = 0

  while (index < content.length) {
    if (content.startsWith("--", index)) {
      const end = content.indexOf("\n", index)
      const comment = content.slice(index, end === -1 ? content.length : end)
      result += whitespaceMask(comment)
      index += comment.length
      continue
    }

    if (content.startsWith("/*", index)) {
      const comment = content.slice(index, blockCommentEnd(content, index))
      result += whitespaceMask(comment)
      index += comment.length
      continue
    }

    if (content[index] === "'") {
      let end = index + 1
      while (end < content.length) {
        if (content[end] === "'" && content[end + 1] === "'") {
          end += 2
          continue
        }
        if (content[end] === "'") {
          end += 1
          break
        }
        end += 1
      }
      const literal = content.slice(index, end)
      result += whitespaceMask(literal)
      index = end
      continue
    }

    const delimiter = content[index] === "$" ? dollarQuoteDelimiter(content, index) : undefined
    if (delimiter !== undefined) {
      const bodyStart = index + delimiter.length
      const bodyEnd = content.indexOf(delimiter, bodyStart)
      const quotedBody = content.slice(
        index,
        bodyEnd === -1 ? content.length : bodyEnd + delimiter.length
      )
      result += whitespaceMask(quotedBody)
      index += quotedBody.length
      continue
    }

    result += content[index]
    index += 1
  }

  return result
}

function readQuotedString(content: string, index: number): { end: number; value: string } {
  let end = index + 1
  let value = ""

  while (end < content.length) {
    if (content[end] === "'" && content[end + 1] === "'") {
      value += "'"
      end += 2
      continue
    }
    if (content[end] === "'") {
      return { end: end + 1, value }
    }
    value += content[end]
    end += 1
  }

  return { end, value }
}

/** Tokenizes executable SQL, including dollar-quoted function bodies. */
export function tokenizeSqlSegment(content: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let index = 0

  while (index < content.length) {
    if (/\s/u.test(content[index])) {
      index += 1
      continue
    }
    if (content.startsWith("--", index)) {
      const end = content.indexOf("\n", index)
      index = end === -1 ? content.length : end
      continue
    }
    if (content.startsWith("/*", index)) {
      index = blockCommentEnd(content, index)
      continue
    }
    if (content[index] === "'") {
      const literal = readQuotedString(content, index)
      tokens.push({ type: "string", value: literal.value.toLowerCase() })
      index = literal.end
      continue
    }

    const delimiter = content[index] === "$" ? dollarQuoteDelimiter(content, index) : undefined
    if (delimiter !== undefined) {
      const bodyStart = index + delimiter.length
      const bodyEnd = content.indexOf(delimiter, bodyStart)
      if (bodyEnd !== -1) {
        tokens.push(...tokenizeSqlSegment(content.slice(bodyStart, bodyEnd)))
        index = bodyEnd + delimiter.length
        continue
      }
    }

    if (/[a-zA-Z_]/u.test(content[index])) {
      let end = index + 1
      while (end < content.length && /[a-zA-Z0-9_]/u.test(content[end])) {
        end += 1
      }
      tokens.push({ type: "word", value: content.slice(index, end).toLowerCase() })
      index = end
      continue
    }

    if (content.startsWith("->>", index)) {
      tokens.push({ type: "symbol", value: "->>" })
      index += 3
      continue
    }

    const twoCharacterSymbol = content.slice(index, index + 2)
    if ([":=", "::", "->>", "||"].includes(twoCharacterSymbol)) {
      tokens.push({ type: "symbol", value: twoCharacterSymbol })
      index += 2
      continue
    }

    tokens.push({ type: "symbol", value: content[index] })
    index += 1
  }

  return tokens
}
