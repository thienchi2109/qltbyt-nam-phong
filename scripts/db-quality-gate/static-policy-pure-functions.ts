import { maskSqlCommentsAndLiterals } from "./static-sql"
import { tokenizeSqlSegment } from "./static-sql-tokens"
import type { SqlFunctionBlock } from "./static-policy-objects"

const PURE_SQL_BUILTINS = new Set([
  "btrim",
  "coalesce",
  "lower",
  "nullif",
  "normalize",
  "regexp_replace",
  "translate",
])
const PURE_SQL_FORBIDDEN_WORDS = new Set([
  "copy",
  "delete",
  "execute",
  "from",
  "insert",
  "into",
  "join",
  "merge",
  "notify",
  "perform",
  "table",
  "truncate",
  "update",
])

/** Recognizes only immutable internal SQL helpers with a small, non-sensitive call surface. */
export function isPureImmutableInternalFunction(functionBlock: SqlFunctionBlock): boolean {
  const declaration = maskSqlCommentsAndLiterals(functionBlock.declaration)
  if (
    !functionBlock.name.startsWith("public._") ||
    !/\bLANGUAGE\s+SQL\b/iu.test(declaration) ||
    !/\bIMMUTABLE\b/iu.test(declaration) ||
    /\bSECURITY\s+DEFINER\b/iu.test(declaration)
  ) {
    return false
  }

  const tokens = tokenizeSqlSegment(functionBlock.body)
  if (tokens.some((token) => token.type === "word" && PURE_SQL_FORBIDDEN_WORDS.has(token.value))) {
    return false
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index].type !== "word" || tokens[index + 1]?.value !== "(") {
      continue
    }
    if (!PURE_SQL_BUILTINS.has(tokens[index].value)) {
      return false
    }
  }
  for (let index = 0; index < tokens.length - 3; index += 1) {
    if (
      tokens[index].type === "word" &&
      tokens[index + 1]?.value === "." &&
      tokens[index + 2]?.type === "word" &&
      tokens[index + 3]?.value === "(" &&
      (tokens[index].value !== "pg_catalog" || !PURE_SQL_BUILTINS.has(tokens[index + 2].value))
    ) {
      return false
    }
  }

  return true
}
