import { maskSqlCommentsAndLiterals } from "./static-sql"

export type TopLevelSqlStatement = {
  end: number
  sql: string
  start: number
}

/** Splits executable top-level SQL while retaining offsets into the original source. */
export function topLevelStatements(content: string): TopLevelSqlStatement[] {
  const executableSql = maskSqlCommentsAndLiterals(content)
  const statements: TopLevelSqlStatement[] = []
  let start = 0

  for (let index = 0; index < executableSql.length; index += 1) {
    if (executableSql[index] !== ";") {
      continue
    }
    if (executableSql.slice(start, index).trim().length > 0) {
      statements.push({ end: index + 1, sql: executableSql.slice(start, index + 1), start })
    }
    start = index + 1
  }

  return statements
}
