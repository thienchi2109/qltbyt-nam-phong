import { afterEach, describe, expect, it, vi } from 'vitest'

import { callRpc } from '@/lib/rpc-client'

const originalFetch = global.fetch

function mockJsonResponse(payload: unknown, init: ResponseInit = {}) {
  return {
    ok: init.status ? init.status >= 200 && init.status < 300 : true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response
}

function mockInvalidJsonResponse(init: ResponseInit = {}) {
  return {
    ok: false,
    status: init.status ?? 500,
    json: vi.fn().mockRejectedValue(new Error('invalid json')),
  } as unknown as Response
}

describe('callRpc', () => {
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('serializes {} when args are omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ ok: true }))
    global.fetch = fetchMock as typeof fetch

    await callRpc({ fn: 'ping' })

    expect(fetchMock).toHaveBeenCalledWith('/api/rpc/ping', expect.objectContaining({
      method: 'POST',
      body: '{}',
    }))
  })

  it('serializes object args unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse({ ok: true }))
    global.fetch = fetchMock as typeof fetch

    await callRpc({ fn: 'ping', args: { p_id: 1, q: 'x' } })

    expect(fetchMock).toHaveBeenCalledWith('/api/rpc/ping', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ p_id: 1, q: 'x' }),
    }))
  })

  it('returns parsed JSON on success', async () => {
    const payload = { rows: [{ id: 1 }] }
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse(payload)) as typeof fetch

    const result = await callRpc<typeof payload>({ fn: 'list' })

    expect(result).toEqual(payload)
  })

  it('uses string error payload as the thrown message', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({ error: 'bad request' }, { status: 400 })) as typeof fetch

    await expect(callRpc({ fn: 'broken' })).rejects.toThrow('bad request')
  })

  it('prefers object error message over hint and details', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({
      error: { message: 'message wins', hint: 'hint value', details: 'details value' },
    }, { status: 400 })) as typeof fetch

    await expect(callRpc({ fn: 'broken' })).rejects.toThrow('message wins')
  })

  it('falls back to error hint when message is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({
      error: { hint: 'hint value', details: 'details value' },
    }, { status: 400 })) as typeof fetch

    await expect(callRpc({ fn: 'broken' })).rejects.toThrow('hint value')
  })

  it('falls back to error details when message and hint are missing', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockJsonResponse({
      error: { details: 'details value' },
    }, { status: 400 })) as typeof fetch

    await expect(callRpc({ fn: 'broken' })).rejects.toThrow('details value')
  })

  it('falls back to the default message when the error body is invalid JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockInvalidJsonResponse({ status: 500 })) as typeof fetch

    await expect(callRpc({ fn: 'broken' })).rejects.toThrow('RPC broken failed (500)')
  })
})
