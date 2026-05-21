import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const callServerRpcMock = vi.fn()

vi.mock('@/lib/ai/server-rpc', () => ({
  callServerRpc: (...args: unknown[]) => callServerRpcMock(...args),
}))

describe('distributed AI usage metering', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('AI_RATE_LIMIT_WINDOW_MS', '1234')
    vi.stubEnv('AI_RATE_LIMIT_MAX_REQUESTS', '3')
    vi.stubEnv('AI_DAILY_USER_QUOTA_REQUESTS', '4')
    vi.stubEnv('AI_DAILY_TENANT_QUOTA_REQUESTS', '5')
    vi.stubEnv('AI_DAILY_GLOBAL_QUOTA_REQUESTS', '6')
    vi.stubEnv('AI_QUOTA_RESERVATION_TTL_MS', '120000')
    callServerRpcMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('passes every quota limit and TTL to ai_quota_reserve', async () => {
    callServerRpcMock.mockResolvedValue([
      {
        allowed: true,
        reservation_id: '00000000-0000-4000-8000-000000000484',
        reason: null,
        message: null,
      },
    ])

    const { reserveUsage } = await import('../usage-metering')
    const result = await reserveUsage({
      userId: 'u1',
      tenantId: 2,
      role: 'admin',
    })

    expect(result).toEqual({
      allowed: true,
      reservationId: '00000000-0000-4000-8000-000000000484',
    })
    expect(callServerRpcMock).toHaveBeenCalledWith(
      'ai_quota_reserve',
      {
        p_user_id: 'u1',
        p_tenant_id: 2,
        p_rate_window_ms: 1234,
        p_rate_max: 3,
        p_user_daily_max: 4,
        p_tenant_daily_max: 5,
        p_global_daily_max: 6,
        p_ttl_ms: 120000,
      },
      expect.objectContaining({
        id: 'u1',
        role: 'admin',
        don_vi: 2,
      }),
    )
  })

  it('short-circuits when AI_KILL_SWITCH is on', async () => {
    vi.stubEnv('AI_KILL_SWITCH', 'on')

    const { reserveUsage } = await import('../usage-metering')
    const result = await reserveUsage({ userId: 'u1', tenantId: 2 })

    expect(result).toEqual({
      allowed: false,
      reason: 'kill_switch',
      message: 'AI usage is temporarily disabled.',
    })
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it('maps RPC global quota failures to usage limit reasons', async () => {
    callServerRpcMock.mockResolvedValue([
      {
        allowed: false,
        reservation_id: null,
        reason: 'global_quota',
        message: 'AI daily quota exceeded',
      },
    ])

    const { reserveUsage } = await import('../usage-metering')
    const result = await reserveUsage({ userId: 'u1', tenantId: 2 })

    expect(result).toEqual({
      allowed: false,
      reason: 'global_quota',
      message: 'AI daily quota exceeded',
    })
  })

  it('classifies stream failures using only provider-reported usage', async () => {
    const { classifyStreamFailure } = await import('../usage-metering')

    expect(classifyStreamFailure({
      providerUsage: { inputTokens: 11, outputTokens: 13 },
    })).toEqual({
      status: 'error_with_usage',
      inputTokens: 11,
      outputTokens: 13,
    })

    expect(classifyStreamFailure({ providerUsage: undefined })).toEqual({
      status: 'error_with_usage',
      inputTokens: 0,
      outputTokens: 0,
    })
  })
})
