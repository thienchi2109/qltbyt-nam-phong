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
})
