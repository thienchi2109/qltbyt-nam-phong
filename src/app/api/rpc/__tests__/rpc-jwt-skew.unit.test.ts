import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const jwtSignMock = vi.fn()
const fetchMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: (...args: unknown[]) => jwtSignMock(...args),
  },
}))

import { POST } from '../[fn]/route'

function buildRequest(body: Record<string, unknown>) {
  const encodedBody = JSON.stringify(body)
  return new Request('http://localhost/api/rpc/ai_equipment_lookup', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(encodedBody)),
    },
    body: encodedBody,
  })
}

describe('RPC proxy JWT signing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T00:00:00.000Z'))

    vi.stubEnv('SUPABASE_JWT_SECRET', 'test-secret')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')

    getServerSessionMock.mockReset()
    jwtSignMock.mockReset()
    fetchMock.mockReset()

    vi.stubGlobal('fetch', fetchMock)

    getServerSessionMock.mockResolvedValue({
      user: {
        id: '31',
        role: 'to_qltb',
        don_vi: 17,
        dia_ban_id: 10,
        khoa_phong: 'ICU',
      },
    })

    jwtSignMock.mockReturnValue('signed-jwt')
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
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

  it('backdates JWT iat slightly to tolerate small clock skew with Supabase', async () => {
    const res = await POST(buildRequest({ query: 'SpO2' }) as never, {
      params: Promise.resolve({ fn: 'ai_equipment_lookup' }),
    })

    expect(res.status).toBe(200)
    expect(jwtSignMock).toHaveBeenCalledOnce()

    const [claims, secret, options] = jwtSignMock.mock.calls[0] as [
      Record<string, unknown>,
      string,
      Record<string, unknown>,
    ]

    expect(secret).toBe('test-secret')
    expect(options).toMatchObject({ algorithm: 'HS256' })
    expect(options).not.toHaveProperty('expiresIn')
    expect(claims).toMatchObject({
      role: 'authenticated',
      app_role: 'to_qltb',
      don_vi: '17',
      user_id: '31',
      dia_ban: '10',
      khoa_phong: 'ICU',
      sub: '31',
    })
    const now = Math.floor(Date.now() / 1000)
    expect(claims.iat).toBe(now - 60)
    // exp should be 2 minutes from actual signing time, not from backdated iat
    expect(claims.exp).toBe(now + 120)
  })
})
