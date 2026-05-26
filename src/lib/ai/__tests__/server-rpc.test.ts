import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const jwtSignMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => jwtSignMock(...args),
  },
}))

import { callServerRpc, mintSupabaseJwt } from '../server-rpc'

describe('AI server RPC helper', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T08:00:00.000Z'))
    vi.stubEnv('SUPABASE_JWT_SECRET', 'test-secret')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
    vi.stubGlobal('fetch', fetchMock)

    jwtSignMock.mockReset()
    jwtSignMock.mockReturnValue('signed-jwt')
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ allowed: true }]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('mints Supabase JWT claims with the same shape as the RPC proxy', () => {
    const token = mintSupabaseJwt({
      id: '31',
      role: 'admin',
      don_vi: 17,
      dia_ban_id: 10,
      khoa_phong: 'ICU',
    })

    expect(token).toBe('signed-jwt')
    expect(jwtSignMock).toHaveBeenCalledOnce()

    const [claims, secret, options] = jwtSignMock.mock.calls[0] as [
      Record<string, unknown>,
      string,
      Record<string, unknown>,
    ]

    expect(secret).toBe('test-secret')
    expect(options).toEqual({ algorithm: 'HS256' })
    expect(claims).toMatchObject({
      role: 'authenticated',
      app_role: 'global',
      don_vi: '17',
      user_id: '31',
      dia_ban: '10',
      khoa_phong: 'ICU',
      sub: '31',
    })

    const now = Math.floor(Date.now() / 1000)
    expect(claims.iat).toBe(now - 60)
    expect(claims.exp).toBe(now + 120)
  })

  it('rejects missing user id before minting a Supabase JWT', () => {
    expect(() => mintSupabaseJwt({ role: 'user' })).toThrow(
      'Cannot mint Supabase RPC JWT without user id',
    )
    expect(jwtSignMock).not.toHaveBeenCalled()
  })

  it('rejects missing role before minting a Supabase JWT', () => {
    expect(() => mintSupabaseJwt({ id: '31', role: '' })).toThrow(
      'Cannot mint Supabase RPC JWT without app_role',
    )
    expect(jwtSignMock).not.toHaveBeenCalled()
  })

  it('calls Supabase PostgREST RPC with the minted JWT and anon API key', async () => {
    await expect(
      callServerRpc('ai_quota_reserve', { p_user_id: 'u1' }, {
        id: 'u1',
        role: 'user',
        don_vi: 2,
      }),
    ).resolves.toEqual([{ allowed: true }])

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/ai_quota_reserve',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ p_user_id: 'u1' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer signed-jwt',
          apikey: 'test-anon-key',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })
})
