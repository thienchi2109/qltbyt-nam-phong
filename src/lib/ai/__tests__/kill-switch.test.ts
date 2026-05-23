import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const callServerRpcMock = vi.fn()

vi.mock('@/lib/ai/server-rpc', () => ({
  callServerRpc: (...args: unknown[]) => callServerRpcMock(...args),
}))

describe('AI kill switch status', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-23T00:00:00.000Z'))
    vi.resetModules()
    vi.unstubAllEnvs()
    callServerRpcMock.mockReset()

    const { __resetKillSwitchCache } = await import('../kill-switch')
    __resetKillSwitchCache()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('uses env override without calling the RPC', async () => {
    vi.stubEnv('AI_KILL_SWITCH', 'on')

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: true,
      source: 'env',
    })
    expect(callServerRpcMock).not.toHaveBeenCalled()
  })

  it('returns active db status with reason', async () => {
    callServerRpcMock.mockResolvedValue([{ enabled: true, reason: 'maintenance' }])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: true,
      source: 'db',
      reason: 'maintenance',
    })
  })

  it('returns inactive db status', async () => {
    callServerRpcMock.mockResolvedValue([{ enabled: false, reason: null }])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: false,
      source: 'db',
    })
  })

  it('caches db status inside the normal TTL', async () => {
    callServerRpcMock.mockResolvedValue([{ enabled: false, reason: null }])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await isAiKillSwitchActive()
    vi.advanceTimersByTime(7_999)
    await isAiKillSwitchActive()

    expect(callServerRpcMock).toHaveBeenCalledTimes(1)
  })

  it('re-fetches db status after the normal TTL expires', async () => {
    callServerRpcMock
      .mockResolvedValueOnce([{ enabled: false, reason: null }])
      .mockResolvedValueOnce([{ enabled: true, reason: 'after ttl' }])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({ active: false, source: 'db' })
    vi.advanceTimersByTime(8_000)
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: true,
      source: 'db',
      reason: 'after ttl',
    })
    expect(callServerRpcMock).toHaveBeenCalledTimes(2)
  })

  it('env override beats cached db false without another RPC call', async () => {
    callServerRpcMock.mockResolvedValue([{ enabled: false, reason: null }])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({ active: false, source: 'db' })

    vi.stubEnv('AI_KILL_SWITCH', 'on')
    await expect(isAiKillSwitchActive()).resolves.toEqual({ active: true, source: 'env' })
    expect(callServerRpcMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed and caches RPC errors for the short TTL', async () => {
    callServerRpcMock
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce([{ enabled: false, reason: null }])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: true,
      source: 'db_error_fail_closed',
    })
    vi.advanceTimersByTime(1_999)
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: true,
      source: 'db_error_fail_closed',
    })
    expect(callServerRpcMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    await expect(isAiKillSwitchActive()).resolves.toEqual({ active: false, source: 'db' })
    expect(callServerRpcMock).toHaveBeenCalledTimes(2)
  })

  it('treats empty RPC rows as inactive db status', async () => {
    callServerRpcMock.mockResolvedValue([])

    const { isAiKillSwitchActive } = await import('../kill-switch')
    await expect(isAiKillSwitchActive()).resolves.toEqual({
      active: false,
      source: 'db',
    })
  })
})
