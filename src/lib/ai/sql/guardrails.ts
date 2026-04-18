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

const FORBIDDEN_SCHEMAS = [
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

export interface ValidatedAssistantSql {
  statement: string
  sqlShape: string
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
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'i')
    if (keywordPattern.test(maskedStatement)) {
      throw new AssistantSqlError(
        'forbidden_keyword',
        'Forbidden SQL keyword detected.',
      )
    }
  }
}

function assertNoForbiddenSchemas(maskedStatement: string) {
  for (const schema of FORBIDDEN_SCHEMAS) {
    const schemaPattern = new RegExp(`\\b${schema}\\s*\\.`, 'i')
    if (schemaPattern.test(maskedStatement)) {
      throw new AssistantSqlError(
        'forbidden_schema',
        'Only the ai_readonly schema is queryable.',
      )
    }
  }
}

function assertNoForbiddenFunctions(maskedStatement: string) {
  for (const functionName of FORBIDDEN_FUNCTIONS) {
    const functionPattern = new RegExp(`\\b${functionName}\\s*\\(`, 'i')
    if (functionPattern.test(maskedStatement)) {
      throw new AssistantSqlError(
        'forbidden_function',
        'Forbidden SQL function detected.',
      )
    }
  }
}

export function validateAssistantSql(sql: string): ValidatedAssistantSql {
  const withoutComments = stripComments(sql)
  const normalized = normalizeWhitespace(withoutComments)
  const masked = normalizeWhitespace(maskQuotedText(withoutComments))
  const maskedForForbiddenScan = normalizeWhitespace(maskQuotedText(sql))

  if (!normalized) {
    throw new AssistantSqlError('invalid_statement', 'SQL is required.')
  }

  assertSingleStatement(normalized, masked)

  const statement = withoutTrailingSemicolon(normalized)

  assertSelectOnly(statement)
  assertNoForbiddenFunctions(maskedForForbiddenScan)
  assertNoForbiddenKeywords(maskedForForbiddenScan)
  assertNoForbiddenSchemas(maskedForForbiddenScan)

  return {
    statement,
    sqlShape: statement,
  }
}
