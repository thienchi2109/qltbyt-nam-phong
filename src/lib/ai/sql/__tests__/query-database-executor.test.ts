import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AssistantSqlError } from '../errors'
import { executeAssistantSql, type AssistantSqlDb } from '../executor'
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

function createDb(rows: Array<Record<string, unknown>>): {
  db: AssistantSqlDb
  settings: Array<{ name: string; value: string }>
  statements: string[]
} {
  const settings: Array<{ name: string; value: string }> = []
  const statements: string[] = []
  const db: AssistantSqlDb = {
    begin: async callback =>
      callback({
        setLocal: async (name, value) => {
          settings.push({ name, value })
        },
        unsafe: async statement => {
          statements.push(statement)
          return rows
        },
      }),
  }

  return { db, settings, statements }
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

describe('query_database executor contract', () => {
  it('fails the assertion helper when no assistant SQL error is thrown', async () => {
    await expect(
      expectAssistantSqlError(async () => undefined, 'scope_required'),
    ).rejects.toThrow('Expected AssistantSqlError')
  })

  it('applies transaction-local settings for timeout, search_path, and facility scope', async () => {
    const { db, settings, statements } = createDb([{ equipment_id: 1 }])

    const result = await executeAssistantSql({
      db,
      scope,
      sql: 'select equipment_id from ai_readonly.equipment_search',
    })

    expect(result).toEqual({
      rowCount: 1,
      rows: [{ equipment_id: 1 }],
      payloadBytes: expect.any(Number),
      sqlShape: 'select equipment_id from ai_readonly.equipment_search',
    })
    expect(settings).toEqual([
      { name: 'statement_timeout', value: '5000ms' },
      { name: 'search_path', value: 'ai_readonly, pg_catalog' },
      { name: 'app.current_role', value: 'technician' },
      { name: 'app.current_user_id', value: 'u1' },
      { name: 'app.current_facility_id', value: '2' },
    ])
    expect(statements).toEqual([
      'select * from (select equipment_id from ai_readonly.equipment_search) as assistant_sql_result limit 101',
    ])
  })

  it('requires server-injected single-facility scope before execution', async () => {
    const { db } = createDb([])

    await expectAssistantSqlError(
      () =>
        executeAssistantSql({
          db,
          scope: undefined as unknown as AssistantSqlScope,
          sql: 'select 1',
        }),
      'scope_required',
    )
  })

  it('maps row and payload limits to safe error classes', async () => {
    const tooManyRows = Array.from({ length: 101 }, (_, index) => ({ id: index + 1 }))
    await expectAssistantSqlError(
      () =>
        executeAssistantSql({
          db: createDb(tooManyRows).db,
          scope,
          sql: 'select id from ai_readonly.equipment_search',
        }),
      'row_limit_exceeded',
    )

    await expectAssistantSqlError(
      () =>
        executeAssistantSql({
          db: createDb([{ value: 'x'.repeat(65 * 1024) }]).db,
          scope,
          sql: 'select value from ai_readonly.equipment_search',
        }),
      'payload_limit_exceeded',
    )
  })

  it('maps database statement timeout failures to a safe error class', async () => {
    const db: AssistantSqlDb = {
      begin: async callback =>
        callback({
          setLocal: async () => {},
          unsafe: async () => {
            throw Object.assign(new Error('canceling statement due to statement timeout'), {
              code: '57014',
            })
          },
        }),
    }

    await expectAssistantSqlError(
      () =>
        executeAssistantSql({
          db,
          scope,
          sql: 'select 1',
        }),
      'timeout',
    )
  })
})
