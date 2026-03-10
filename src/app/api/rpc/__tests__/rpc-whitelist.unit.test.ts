import { describe, it, expect } from 'vitest'

import { POST } from '../[fn]/route'

async function invokeRpcProxy(fn: string) {
  const req = new Request(`http://localhost/api/rpc/${fn}`, { method: 'POST' })
  return POST(req as never, { params: Promise.resolve({ fn }) })
}

describe('RPC proxy whitelist', () => {
  it('rejects unknown RPC functions', async () => {
    const res = await invokeRpcProxy('unknown_rpc_fn')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })

  it('allows equipment_bulk_delete through whitelist checks', async () => {
    const res = await invokeRpcProxy('equipment_bulk_delete')

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it.each([
    'ai_equipment_lookup',
    'ai_maintenance_summary',
    'ai_maintenance_plan_lookup',
    'ai_repair_summary',
  ])('allows AI RPC "%s" through whitelist checks', async (fn) => {
    const res = await invokeRpcProxy(fn)

    // Whitelist check passed; next guard is missing Content-Length.
    expect(res.status).toBe(411)
    await expect(res.json()).resolves.toEqual({ error: 'Content-Length header required' })
  })

  it('rejects non-existent AI RPC', async () => {
    const res = await invokeRpcProxy('ai_does_not_exist')
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Function not allowed' })
  })
})
