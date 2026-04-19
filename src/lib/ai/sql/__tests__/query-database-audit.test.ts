import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AssistantSqlError } from '../errors'
import {
  executeAuditedAssistantSql,
  type AssistantSqlAuditWriter,
} from '../audited-executor'
import type { AssistantSqlResult } from '../executor'
import type { AssistantSqlScope } from '../scope'

const scope: AssistantSqlScope = {
  effectiveFacilityId: 2,
  facilitySource: 'session',
  normalizedRole: 'technician',
  rawRole: 'technician',
  requestedFacilityId: undefined,
  sessionFacilityId: 2,
  userId: 'u1',
}

const request = new Request('http://localhost/api/chat', {
  headers: { cookie: 'next-auth.session-token=test' },
})

const successResult: AssistantSqlResult = {
  payloadBytes: 42,
  rowCount: 1,
  rows: [{ equipment_id: 10 }],
  sqlShape: 'select equipment_id from ai_readonly.equipment_search',
}

async function expectAssistantSqlError(
  action: () => Promise<unknown>,
  code: string,
) {
  try {
    await action()
  } catch (error) {
    expect(error).toBeInstanceOf(AssistantSqlError)
    expect((error as AssistantSqlError).code).toBe(code)
    return
  }

  throw new Error(`Expected AssistantSqlError with code '${code}'`)
}

describe('query_database audit contract', () => {
  it('emits sanitized audit payloads for successful executions', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_037)
    const execute = vi.fn(async () => successResult)
    const writeAudit = vi.fn<AssistantSqlAuditWriter>(async () => undefined)

    const result = await executeAuditedAssistantSql({
      execute,
      request,
      scope,
      sql: 'select equipment_id from ai_readonly.equipment_search',
      writeAudit,
    })

    expect(result).toBe(successResult)
    expect(execute).toHaveBeenCalledWith({
      scope,
      sql: 'select equipment_id from ai_readonly.equipment_search',
    })
    expect(writeAudit).toHaveBeenCalledWith({
      request,
      details: {
        effective_facility_id: 2,
        error_class: null,
        facility_source: 'session',
        latency_ms: 37,
        normalized_role: 'technician',
        payload_bytes: 42,
        raw_role: 'technician',
        requested_facility_id: null,
        row_count: 1,
        session_facility_id: 2,
        sql_shape: 'select equipment_id from ai_readonly.equipment_search',
        status: 'success',
        tool_path: 'query_database',
      },
    })
  })

  it('emits sanitized audit payloads for rejected executions', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_011)
    const execute = vi.fn(async () => {
      throw new AssistantSqlError('timeout', 'Assistant SQL query timed out.')
    })
    const writeAudit = vi.fn<AssistantSqlAuditWriter>(async () => undefined)

    await expectAssistantSqlError(
      () =>
        executeAuditedAssistantSql({
          execute,
          request,
          scope,
          sql: 'select pg_sleep(10)',
          writeAudit,
        }),
      'timeout',
    )

    expect(writeAudit).toHaveBeenCalledWith({
      request,
      details: {
        effective_facility_id: 2,
        error_class: 'timeout',
        facility_source: 'session',
        latency_ms: 11,
        normalized_role: 'technician',
        payload_bytes: null,
        raw_role: 'technician',
        requested_facility_id: null,
        row_count: null,
        session_facility_id: 2,
        sql_shape: 'select pg_sleep(10)',
        status: 'failure',
        tool_path: 'query_database',
      },
    })
  })

  it('fails closed when audit writing fails', async () => {
    const execute = vi.fn(async () => successResult)
    const writeAudit = vi.fn<AssistantSqlAuditWriter>(async () => {
      throw new Error('audit write failed')
    })

    await expectAssistantSqlError(
      () =>
        executeAuditedAssistantSql({
          execute,
          request,
          scope,
          sql: 'select equipment_id from ai_readonly.equipment_search',
          writeAudit,
        }),
      'audit_error',
    )
  })

  it('preserves execution errors when failure audit writing fails', async () => {
    const execute = vi.fn(async () => {
      throw new AssistantSqlError('timeout', 'Assistant SQL query timed out.')
    })
    const writeAudit = vi.fn<AssistantSqlAuditWriter>(async () => {
      throw new Error('audit write failed')
    })

    await expectAssistantSqlError(
      () =>
        executeAuditedAssistantSql({
          execute,
          request,
          scope,
          sql: 'select pg_sleep(10)',
          writeAudit,
        }),
      'timeout',
    )
  })
})
