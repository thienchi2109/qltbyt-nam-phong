import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { executeRpcTool } from '../rpc-tool-executor'

const fetchMock = vi.fn()

function buildRequest() {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      cookie: 'next-auth.session-token=abc123',
      'content-type': 'application/json',
    },
  })
}

describe('executeRpcTool', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends flat RPC params (not wrapped in args)', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )

    await executeRpcTool({
      request: buildRequest(),
      rpcFunction: 'equipment_list',
      args: { p_don_vi: 2, query: 'monitor' },
    })

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      {
        body?: string
        headers?: HeadersInit
      },
    ]

    expect(url).toBe('http://localhost:3000/api/rpc/equipment_list')
    expect(init.body).toBe(JSON.stringify({ p_don_vi: 2, query: 'monitor' }))

    const headers = new Headers(init.headers)
    expect(headers.get('cookie')).toBe('next-auth.session-token=abc123')
  })
})
