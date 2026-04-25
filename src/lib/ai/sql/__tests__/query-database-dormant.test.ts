import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const executeAuditedAssistantSqlMock = vi.fn()

vi.mock('@/lib/ai/sql/audited-executor', () => ({
  executeAuditedAssistantSql: (...args: unknown[]) =>
    executeAuditedAssistantSqlMock(...args),
}))

import { POST as rpcPost } from '@/app/api/rpc/[fn]/route'
import { QUERY_DATABASE_TOOL_DESCRIPTION } from '@/lib/ai/sql/schema-cheatsheet'
import { QUERY_DATABASE_TOOL_NAME } from '@/lib/ai/tools/query-database'
import { buildToolRegistry, getAllowedToolNamesForTest, getToolRpcMapping, validateRequestedTools } from '@/lib/ai/tools/registry'
import type { AssistantSqlScope } from '@/lib/ai/sql/scope'

async function invokeRpcProxy(fn: string) {
  const req = new Request(`http://localhost/api/rpc/${fn}`, { method: 'POST' })
  return rpcPost(req as never, { params: Promise.resolve({ fn }) })
}

type ExecutableTool = {
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

describe('query_database runtime rollout contract', () => {
  beforeEach(() => {
    executeAuditedAssistantSqlMock.mockReset()
    executeAuditedAssistantSqlMock.mockResolvedValue({
      rowCount: 1,
      rows: [{ total: 5 }],
      reasoning: 'unused',
    })
  })

  it('defines the rollout tool name and accepts it in the assistant registry', () => {
    expect(QUERY_DATABASE_TOOL_NAME).toBe('query_database')
    expect(getAllowedToolNamesForTest()).toContain(QUERY_DATABASE_TOOL_NAME)
    expect(validateRequestedTools([QUERY_DATABASE_TOOL_NAME])).toEqual({
      ok: true,
      requestedTools: [QUERY_DATABASE_TOOL_NAME],
    })
  })

  it('wires query_database with the server-injected assistant SQL scope', async () => {
    const scope: AssistantSqlScope = {
      effectiveFacilityId: 17,
      facilitySource: 'selected',
      normalizedRole: 'global',
      rawRole: 'admin',
      requestedFacilityId: 17,
      sessionFacilityId: undefined,
      userId: 'u-admin',
    }
    const request = new Request('http://localhost/api/chat', { method: 'POST' })

    const registry = buildToolRegistry({
      request,
      tenantId: 17,
      userId: 'u-admin',
      requestedTools: ['query_database'],
      assistantSqlScope: scope,
    })

    const queryDatabaseTool = registry.query_database as unknown as ExecutableTool
    await queryDatabaseTool.execute({
      reasoning: 'Need a reporting summary.',
      sql: 'select total from ai_readonly.reporting_summary',
    })

    expect(executeAuditedAssistantSqlMock).toHaveBeenCalledWith({
      request,
      scope,
      sql: 'select total from ai_readonly.reporting_summary',
      execute: undefined,
    })
  })

  it('exposes the canonical schema-grounded description', () => {
    const scope: AssistantSqlScope = {
      effectiveFacilityId: 17,
      facilitySource: 'selected',
      normalizedRole: 'global',
      rawRole: 'admin',
      requestedFacilityId: 17,
      sessionFacilityId: undefined,
      userId: 'u-admin',
    }
    const request = new Request('http://localhost/api/chat', { method: 'POST' })

    const registry = buildToolRegistry({
      request,
      tenantId: 17,
      userId: 'u-admin',
      requestedTools: ['query_database'],
      assistantSqlScope: scope,
    })

    const queryDatabaseTool = registry.query_database as unknown as {
      description?: string
    }

    expect(queryDatabaseTool.description).toBe(QUERY_DATABASE_TOOL_DESCRIPTION)
  })

  it('does not expose SQL execution through the RPC proxy mapping', async () => {
    expect(getToolRpcMapping()).not.toHaveProperty(QUERY_DATABASE_TOOL_NAME)
    expect(Object.values(getToolRpcMapping())).not.toContain('ai_query_database')

    const res = await invokeRpcProxy('ai_query_database')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })
})
