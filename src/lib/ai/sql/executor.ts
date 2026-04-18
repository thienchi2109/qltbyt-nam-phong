import { Buffer } from 'node:buffer'

import { ASSISTANT_SQL_MAX_PAYLOAD_BYTES, ASSISTANT_SQL_MAX_ROWS, ASSISTANT_SQL_SEARCH_PATH, ASSISTANT_SQL_STATEMENT_TIMEOUT_MS } from './constants'
import { getAssistantSqlDb } from './client'
import { AssistantSqlError, isAssistantSqlError } from './errors'
import { validateAssistantSql } from './guardrails'
import type { AssistantSqlScope } from './scope'

export interface AssistantSqlTransaction {
  setLocal(name: string, value: string): Promise<void>
  unsafe(statement: string): Promise<Array<Record<string, unknown>>>
}

export interface AssistantSqlDb {
  begin(
    callback: (tx: AssistantSqlTransaction) => Promise<Array<Record<string, unknown>>>,
  ): Promise<Array<Record<string, unknown>>>
}

export interface ExecuteAssistantSqlParams {
  db?: AssistantSqlDb
  maxPayloadBytes?: number
  maxRows?: number
  scope: AssistantSqlScope
  sql: string
}

export interface AssistantSqlResult {
  payloadBytes: number
  rowCount: number
  rows: Array<Record<string, unknown>>
  sqlShape: string
}

function assertScope(scope: AssistantSqlScope | undefined): AssistantSqlScope {
  if (
    scope === undefined ||
    !Number.isFinite(scope.effectiveFacilityId) ||
    !scope.userId
  ) {
    throw new AssistantSqlError(
      'scope_required',
      'Server-injected assistant SQL scope is required.',
    )
  }

  return scope
}

function mapExecutionError(error: unknown): AssistantSqlError {
  if (isAssistantSqlError(error)) {
    return error
  }

  const errorRecord = error as { code?: unknown; message?: unknown }
  const code = typeof errorRecord.code === 'string' ? errorRecord.code : undefined
  const message = typeof errorRecord.message === 'string' ? errorRecord.message : ''

  if (code === '57014' || /statement timeout/i.test(message)) {
    return new AssistantSqlError('timeout', 'Assistant SQL query timed out.')
  }

  return new AssistantSqlError('execution_error', 'Assistant SQL query failed.')
}

function buildLimitedStatement(statement: string, maxRows: number): string {
  return `select * from (${statement}) as assistant_sql_result limit ${maxRows + 1}`
}

async function applyTransactionSettings(
  tx: AssistantSqlTransaction,
  scope: AssistantSqlScope,
) {
  await tx.setLocal('statement_timeout', `${ASSISTANT_SQL_STATEMENT_TIMEOUT_MS}ms`)
  await tx.setLocal('search_path', ASSISTANT_SQL_SEARCH_PATH)
  await tx.setLocal('app.current_role', scope.normalizedRole ?? scope.rawRole ?? 'unknown')
  await tx.setLocal('app.current_user_id', scope.userId)
  await tx.setLocal('app.current_facility_id', String(scope.effectiveFacilityId))
}

export async function executeAssistantSql({
  db = getAssistantSqlDb(),
  maxPayloadBytes = ASSISTANT_SQL_MAX_PAYLOAD_BYTES,
  maxRows = ASSISTANT_SQL_MAX_ROWS,
  scope,
  sql,
}: ExecuteAssistantSqlParams): Promise<AssistantSqlResult> {
  const resolvedScope = assertScope(scope)
  const validated = validateAssistantSql(sql)

  try {
    const rows = await db.begin(async tx => {
      await applyTransactionSettings(tx, resolvedScope)
      return tx.unsafe(buildLimitedStatement(validated.statement, maxRows))
    })

    if (rows.length > maxRows) {
      throw new AssistantSqlError(
        'row_limit_exceeded',
        'Assistant SQL query returned too many rows.',
      )
    }

    const payloadBytes = Buffer.byteLength(JSON.stringify(rows), 'utf8')
    if (payloadBytes > maxPayloadBytes) {
      throw new AssistantSqlError(
        'payload_limit_exceeded',
        'Assistant SQL query returned too much data.',
      )
    }

    return {
      payloadBytes,
      rowCount: rows.length,
      rows,
      sqlShape: validated.sqlShape,
    }
  } catch (error) {
    throw mapExecutionError(error)
  }
}
