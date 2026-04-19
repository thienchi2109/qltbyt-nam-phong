import 'server-only'

import { ASSISTANT_SQL_TOOL_NAME } from './constants'
import { AssistantSqlError, isAssistantSqlError } from './errors'
import {
  executeAssistantSql,
  type AssistantSqlResult,
} from './executor'
import type { AssistantSqlScope } from './scope'

export type AssistantSqlAuditStatus = 'failure' | 'success'

export interface AssistantSqlAuditDetails {
  effective_facility_id: number
  error_class: string | null
  facility_source: AssistantSqlScope['facilitySource']
  latency_ms: number
  normalized_role: string | null
  payload_bytes: number | null
  raw_role: string | null
  requested_facility_id: number | null
  row_count: number | null
  session_facility_id: number | null
  sql_shape: string
  status: AssistantSqlAuditStatus
  tool_path: typeof ASSISTANT_SQL_TOOL_NAME
  user_id: string
}

export interface AssistantSqlAuditEvent {
  details: AssistantSqlAuditDetails
  request: Request
}

export type AssistantSqlAuditWriter = (
  event: AssistantSqlAuditEvent,
) => Promise<void>

export interface ExecuteAuditedAssistantSqlParams {
  execute?: (params: {
    scope: AssistantSqlScope
    sql: string
  }) => Promise<AssistantSqlResult>
  request: Request
  scope: AssistantSqlScope
  sql: string
  writeAudit?: AssistantSqlAuditWriter
}

function nullableNumber(value: number | undefined): number | null {
  return value === undefined ? null : value
}

function nullableString(value: string | undefined): string | null {
  return value === undefined ? null : value
}

function getErrorClass(error: unknown): string {
  if (isAssistantSqlError(error)) {
    return error.code
  }

  return 'execution_error'
}

function getAuditSqlShape(sql: string, result?: AssistantSqlResult): string {
  if (result !== undefined) {
    return result.sqlShape
  }

  return sql.replace(/\s+/g, ' ').trim().slice(0, 1_000)
}

function buildAuditDetails({
  errorClass,
  latencyMs,
  result,
  scope,
  sql,
  status,
}: {
  errorClass: string | null
  latencyMs: number
  result?: AssistantSqlResult
  scope: AssistantSqlScope
  sql: string
  status: AssistantSqlAuditStatus
}): AssistantSqlAuditDetails {
  return {
    effective_facility_id: scope.effectiveFacilityId,
    error_class: errorClass,
    facility_source: scope.facilitySource,
    latency_ms: Math.max(0, Math.round(latencyMs)),
    normalized_role: nullableString(scope.normalizedRole),
    payload_bytes: result?.payloadBytes ?? null,
    raw_role: nullableString(scope.rawRole),
    requested_facility_id: nullableNumber(scope.requestedFacilityId),
    row_count: result?.rowCount ?? null,
    session_facility_id: nullableNumber(scope.sessionFacilityId),
    sql_shape: getAuditSqlShape(sql, result),
    status,
    tool_path: ASSISTANT_SQL_TOOL_NAME,
    user_id: scope.userId,
  }
}

function buildAuditRpcUrl(request: Request): string {
  const origin = new URL(request.url).origin
  return new URL('/api/rpc/assistant_query_database_audit_log', origin).toString()
}

export async function writeAssistantSqlAudit({
  details,
  request,
}: AssistantSqlAuditEvent): Promise<void> {
  const headers = new Headers({ 'content-type': 'application/json' })
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  const response = await fetch(buildAuditRpcUrl(request), {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({
      p_effective_facility_id: details.effective_facility_id,
      p_error_class: details.error_class,
      p_facility_source: details.facility_source,
      p_latency_ms: details.latency_ms,
      p_payload_bytes: details.payload_bytes,
      p_raw_role: details.raw_role,
      p_requested_facility_id: details.requested_facility_id,
      p_row_count: details.row_count,
      p_session_facility_id: details.session_facility_id,
      p_sql_shape: details.sql_shape,
      p_status: details.status,
      p_tool_path: details.tool_path,
    }),
  })

  if (!response.ok) {
    throw new AssistantSqlError(
      'audit_error',
      'Assistant SQL audit logging failed.',
    )
  }
}

async function writeAuditOrThrow(
  writeAudit: AssistantSqlAuditWriter,
  event: AssistantSqlAuditEvent,
) {
  try {
    await writeAudit(event)
  } catch (error) {
    if (isAssistantSqlError(error) && error.code === 'audit_error') {
      throw error
    }

    throw new AssistantSqlError(
      'audit_error',
      'Assistant SQL audit logging failed.',
    )
  }
}

export async function executeAuditedAssistantSql({
  execute = executeAssistantSql,
  request,
  scope,
  sql,
  writeAudit = writeAssistantSqlAudit,
}: ExecuteAuditedAssistantSqlParams): Promise<AssistantSqlResult> {
  const startedAt = Date.now()

  try {
    const result = await execute({ scope, sql })
    await writeAuditOrThrow(writeAudit, {
      request,
      details: buildAuditDetails({
        errorClass: null,
        latencyMs: Date.now() - startedAt,
        result,
        scope,
        sql,
        status: 'success',
      }),
    })
    return result
  } catch (error) {
    if (isAssistantSqlError(error) && error.code === 'audit_error') {
      throw error
    }

    await writeAuditOrThrow(writeAudit, {
      request,
      details: buildAuditDetails({
        errorClass: getErrorClass(error),
        latencyMs: Date.now() - startedAt,
        scope,
        sql,
        status: 'failure',
      }),
    })
    throw error
  }
}
