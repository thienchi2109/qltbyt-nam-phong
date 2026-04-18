import { describe, expect, it } from 'vitest'

import { AssistantSqlError } from '../errors'
import { validateAssistantSql } from '../guardrails'

function expectSqlError(sql: string, code: string) {
  try {
    validateAssistantSql(sql)
  } catch (error) {
    expect(error).toBeInstanceOf(AssistantSqlError)
    expect((error as AssistantSqlError).code).toBe(code)
    return
  }

  throw new Error('Expected SQL validation to fail')
}

describe('query_database guardrails contract', () => {
  it('normalizes a single SELECT statement for execution', () => {
    expect(validateAssistantSql(' select equipment_id from ai_readonly.equipment_search; ')).toEqual({
      statement: 'select equipment_id from ai_readonly.equipment_search',
      sqlShape: 'select equipment_id from ai_readonly.equipment_search',
    })
  })

  it('allows table aliases while enforcing ai_readonly table references', () => {
    expect(
      validateAssistantSql(
        'select equipment.equipment_id from ai_readonly.equipment_search equipment',
      ),
    ).toEqual({
      statement:
        'select equipment.equipment_id from ai_readonly.equipment_search equipment',
      sqlShape:
        'select equipment.equipment_id from ai_readonly.equipment_search equipment',
    })
  })

  it('allows WITH queries that resolve to SELECT', () => {
    expect(
      validateAssistantSql(`
        with recent_repairs as (
          select equipment_id from ai_readonly.repair_facts limit 5
        )
        select equipment_id from recent_repairs
      `).statement,
    ).toMatch(/^with recent_repairs as/i)
  })

  it('rejects multi-statement SQL before execution', () => {
    expectSqlError('select 1; select 2', 'invalid_statement')
    expectSqlError("select ';'; select 2", 'invalid_statement')
  })

  it('rejects statements outside SELECT / WITH ... SELECT', () => {
    expectSqlError('update ai_readonly.equipment_search set status = null', 'invalid_statement')
    expectSqlError('explain analyze select 1', 'invalid_statement')
    expectSqlError('copy ai_readonly.equipment_search to stdout', 'invalid_statement')
  })

  it('rejects forbidden schema access outside ai_readonly', () => {
    expectSqlError('select id from public.thiet_bi', 'forbidden_schema')
    expectSqlError('select id from auth.users', 'forbidden_schema')
    expectSqlError('select id from some_other_schema.equipment', 'forbidden_schema')
    expectSqlError('select pg_catalog.set_config(\'app.current_facility_id\', \'2\', true)', 'forbidden_function')
  })

  it('rejects comment-obfuscated mutation attempts', () => {
    expectSqlError('select 1 /* hidden update public.users */', 'forbidden_keyword')
    expectSqlError(
      "select * from ai_readonly.equipment_search --'\nwhere set_config('app.current_facility_id', '2', true) is not null",
      'forbidden_function',
    )
    expectSqlError('with x as (delete from ai_readonly.equipment_search returning *) select * from x', 'forbidden_keyword')
    expectSqlError('select 1 where set_config(\'app.current_facility_id\', \'2\', true) is not null', 'forbidden_function')
  })

  it('rejects dollar-quoted strings instead of trying to parse them', () => {
    expectSqlError("select $$'$$ || set_config('app.current_facility_id', '2', true)", 'invalid_statement')
  })

  it('rejects PostgreSQL E-strings instead of parsing backslash escapes', () => {
    expectSqlError("select E'x\\'' from public.thiet_bi", 'invalid_statement')
  })

  it('does not reject plain string literals that contain E-quote text', () => {
    expect(
      validateAssistantSql(
        "select 'contains E'' marker' as note from ai_readonly.equipment_search",
      ),
    ).toEqual({
      statement:
        "select 'contains E'' marker' as note from ai_readonly.equipment_search",
      sqlShape:
        "select 'contains E'' marker' as note from ai_readonly.equipment_search",
    })
  })
})
