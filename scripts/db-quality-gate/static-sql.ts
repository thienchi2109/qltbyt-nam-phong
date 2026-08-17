import { hasFailClosedJwtGuards } from "./static-sql-jwt"
import { hasRawLikePatternInTokens } from "./static-sql-like"
import { tokenizeSqlSegment } from "./static-sql-tokens"

export { maskSqlCommentsAndLiterals, tokenizeSqlSegment } from "./static-sql-tokens"
export type { SqlToken } from "./static-sql-tokens"

/** Detects raw concatenated LIKE/ILIKE patterns while ignoring quoted/comment decoys. */
export function hasRawLikePattern(content: string): boolean {
  return hasRawLikePatternInTokens(tokenizeSqlSegment(content))
}

export { hasFailClosedJwtGuards }
