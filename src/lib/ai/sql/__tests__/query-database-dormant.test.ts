import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { POST as rpcPost } from '@/app/api/rpc/[fn]/route'
import { QUERY_DATABASE_TOOL_NAME } from '@/lib/ai/tools/query-database'
import { getAllowedToolNamesForTest, getToolRpcMapping, validateRequestedTools } from '@/lib/ai/tools/registry'

async function invokeRpcProxy(fn: string) {
  const req = new Request(`http://localhost/api/rpc/${fn}`, { method: 'POST' })
  return rpcPost(req as never, { params: Promise.resolve({ fn }) })
}

describe('query_database dormant Batch 3 contract', () => {
  it('defines the dormant tool name without adding it to the assistant registry', () => {
    expect(QUERY_DATABASE_TOOL_NAME).toBe('query_database')
    expect(getAllowedToolNamesForTest()).not.toContain(QUERY_DATABASE_TOOL_NAME)
    expect(validateRequestedTools([QUERY_DATABASE_TOOL_NAME])).toEqual({
      ok: false,
      message: 'Unknown tool requested: query_database',
    })
  })

  it('does not expose SQL execution through the RPC proxy mapping', async () => {
    expect(getToolRpcMapping()).not.toHaveProperty(QUERY_DATABASE_TOOL_NAME)
    expect(Object.values(getToolRpcMapping())).not.toContain('ai_query_database')

    const res = await invokeRpcProxy('ai_query_database')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })
})
