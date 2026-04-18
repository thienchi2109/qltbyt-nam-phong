import { AssistantSqlError } from './errors'

const FORBIDDEN_KEYWORDS = [
  'alter',
  'analyze',
  'call',
  'cluster',
  'comment',
  'copy',
  'create',
  'delete',
  'drop',
  'execute',
  'grant',
  'insert',
  'listen',
  'merge',
  'notify',
  'refresh',
  'reindex',
  'revoke',
  'set',
  'truncate',
  'update',
  'vacuum',
] as const

const ALLOWED_SCHEMA = 'ai_readonly'

const KNOWN_FORBIDDEN_SCHEMAS = [
  'auth',
  'extensions',
  'graphql_public',
  'information_schema',
  'pg_catalog',
  'pg_temp',
  'public',
  'storage',
] as const

const FORBIDDEN_FUNCTIONS = ['set_config'] as const
const DOLLAR_QUOTED_STRING_PATTERN = /\$[A-Za-z_][\w$]*\$|\$\$/
const FORBIDDEN_KEYWORD_PATTERN = new RegExp(
  String.raw`\b(?:${FORBIDDEN_KEYWORDS.join('|')})\b`,
  'i',
)
const FORBIDDEN_FUNCTION_PATTERN = new RegExp(
  String.raw`\b(?:${FORBIDDEN_FUNCTIONS.join('|')})\s*\(`,
  'i',
)
const KNOWN_FORBIDDEN_SCHEMA_PATTERN = new RegExp(
  String.raw`\b(?:${KNOWN_FORBIDDEN_SCHEMAS.join('|')})\s*\.`,
  'i',
)
const TABLE_REFERENCE_SCHEMA_PATTERN =
  /\b(?:from|join)\s+([A-Za-z_][\w$]*)\s*\./gi
const FUNCTION_SCHEMA_PATTERN = /\b([A-Za-z_][\w$]*)\s*\.\s*[A-Za-z_][\w$]*\s*\(/gi

export interface ValidatedAssistantSql {
  statement: string
  sqlShape: string
}

function extractCommentText(sql: string): string {
  const comments: string[] = []

  for (const match of sql.matchAll(/\/\*([\s\S]*?)\*\//g)) {
    comments.push(match[1] ?? '')
  }

  for (const match of sql.matchAll(/--([^\n\r]*)/g)) {
    comments.push(match[1] ?? '')
  }

  return comments.join(' ')
}

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n\r]*/g, ' ')
}

function maskQuotedText(sql: string): string {
  let masked = ''
  let quote: "'" | '"' | null = null

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (quote === null) {
      if (char === "'" || char === '"') {
        quote = char
        masked += ' '
      } else {
        masked += char
      }
      continue
    }

    if (char === quote) {
      if (quote === "'" && next === "'") {
        masked += '  '
        index += 1
        continue
      }
      quote = null
    }
    masked += ' '
  }

  return masked
}

function normalizeWhitespace(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim()
}

function withoutTrailingSemicolon(statement: string): string {
  return statement.endsWith(';') ? statement.slice(0, -1).trim() : statement
}

function countSemicolons(sql: string): number {
  return (sql.match(/;/g) ?? []).length
}

function isIdentifierChar(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$]/.test(char)
}

function hasEscapeStringOutsideQuotedText(sql: string): boolean {
  let quote: "'" | '"' | null = null

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (quote === null) {
      if (char === "'" || char === '"') {
        quote = char
        continue
      }

      if (
        (char === 'E' || char === 'e') &&
        !isIdentifierChar(sql[index - 1])
      ) {
        let nextNonSpaceIndex = index + 1
        while (/\s/.test(sql[nextNonSpaceIndex] ?? '')) {
          nextNonSpaceIndex += 1
        }

        if (sql[nextNonSpaceIndex] === "'") {
          return true
        }
      }

      continue
    }

    if (char === quote) {
      if (quote === "'" && next === "'") {
        index += 1
        continue
      }
      quote = null
    }
  }

  return false
}

function assertNoDollarQuotedStrings(sql: string) {
  if (DOLLAR_QUOTED_STRING_PATTERN.test(sql)) {
    throw new AssistantSqlError(
      'invalid_statement',
      'Dollar-quoted strings are not allowed.',
    )
  }
}

function assertNoEscapeStrings(sql: string) {
  if (hasEscapeStringOutsideQuotedText(sql)) {
    throw new AssistantSqlError(
      'invalid_statement',
      'PostgreSQL escape strings are not allowed.',
    )
  }
}

function assertSingleStatement(normalized: string, masked: string) {
  const semicolonCount = countSemicolons(masked)
  if (semicolonCount > 1 || (semicolonCount === 1 && !normalized.endsWith(';'))) {
    throw new AssistantSqlError(
      'invalid_statement',
      'Only one SQL statement is allowed.',
    )
  }
}

function assertSelectOnly(statement: string) {
  if (!/^(select|with)\b/i.test(statement)) {
    throw new AssistantSqlError(
      'invalid_statement',
      'Only SELECT statements are allowed.',
    )
  }
}

function assertNoForbiddenKeywords(maskedStatement: string) {
  if (FORBIDDEN_KEYWORD_PATTERN.test(maskedStatement)) {
    throw new AssistantSqlError(
      'forbidden_keyword',
      'Forbidden SQL keyword detected.',
    )
  }
}

function assertNoForbiddenSchemas(maskedStatement: string) {
  if (KNOWN_FORBIDDEN_SCHEMA_PATTERN.test(maskedStatement)) {
    throw new AssistantSqlError(
      'forbidden_schema',
      'Only the ai_readonly schema is queryable.',
    )
  }

  for (const match of maskedStatement.matchAll(TABLE_REFERENCE_SCHEMA_PATTERN)) {
    if (match[1]?.toLowerCase() !== ALLOWED_SCHEMA) {
      throw new AssistantSqlError(
        'forbidden_schema',
        'Only the ai_readonly schema is queryable.',
      )
    }
  }

  for (const match of maskedStatement.matchAll(FUNCTION_SCHEMA_PATTERN)) {
    if (match[1]?.toLowerCase() !== ALLOWED_SCHEMA) {
      throw new AssistantSqlError(
        'forbidden_schema',
        'Only the ai_readonly schema is queryable.',
      )
    }
  }
}

function assertNoForbiddenFunctions(maskedStatement: string) {
  if (FORBIDDEN_FUNCTION_PATTERN.test(maskedStatement)) {
    throw new AssistantSqlError(
      'forbidden_function',
      'Forbidden SQL function detected.',
    )
  }
}

export function validateAssistantSql(sql: string): ValidatedAssistantSql {
  assertNoDollarQuotedStrings(sql)

  const commentText = normalizeWhitespace(extractCommentText(sql))
  const withoutComments = stripComments(sql)
  const normalized = normalizeWhitespace(withoutComments)
  const masked = normalizeWhitespace(maskQuotedText(withoutComments))

  if (!normalized) {
    throw new AssistantSqlError('invalid_statement', 'SQL is required.')
  }

  assertSingleStatement(normalized, masked)
  assertNoEscapeStrings(withoutComments)

  const statement = withoutTrailingSemicolon(normalized)

  assertSelectOnly(statement)
  assertNoForbiddenFunctions(commentText)
  assertNoForbiddenKeywords(commentText)
  assertNoForbiddenSchemas(commentText)
  assertNoForbiddenFunctions(masked)
  assertNoForbiddenKeywords(masked)
  assertNoForbiddenSchemas(masked)

  return {
    statement,
    sqlShape: statement,
  }
}
