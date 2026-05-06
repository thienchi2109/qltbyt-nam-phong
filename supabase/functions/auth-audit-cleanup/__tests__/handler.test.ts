import { describe, expect, it, vi } from 'vitest'

type CleanupResult = {
  deleted_count: number
  oldest_remaining: string | null
  batches_executed: number
  cutoff_date: string
}

async function loadHandler() {
  try {
    const handlerModulePath = ['..', 'handler'].join('/')
    return await import(/* @vite-ignore */ handlerModulePath)
  } catch {
    return null
  }
}

describe('auth-audit-cleanup Edge Function handler', () => {
  it('rejects requests without the cron bearer token before calling the RPC', async () => {
    const mod = await loadHandler()
    expect(mod?.handleAuthAuditCleanupRequest).toBeTypeOf('function')

    const rpc = vi.fn()
    const logger = { error: vi.fn(), log: vi.fn() }
    const response = await mod!.handleAuthAuditCleanupRequest(
      new Request('https://example.test/auth-audit-cleanup', { method: 'POST' }),
      {
        env: {
          cronSecret: 'cron-secret',
          supabaseUrl: 'https://example.supabase.co',
          serviceRoleKey: 'service-role-secret',
        },
        createRpcClient: () => ({ rpc }),
        logger,
      }
    )

    expect(response.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      'Unauthorized auth audit cleanup attempt',
      { ip: null, userAgent: null }
    )
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('calls auth_audit_log_cleanup_scheduled for an authorized cron request', async () => {
    const mod = await loadHandler()
    expect(mod?.handleAuthAuditCleanupRequest).toBeTypeOf('function')

    const cleanupResult: CleanupResult = {
      deleted_count: 7,
      oldest_remaining: '2026-02-06T03:00:00.000Z',
      batches_executed: 1,
      cutoff_date: '2026-02-05T03:00:00.000Z',
    }
    const rpc = vi.fn().mockResolvedValue({ data: [cleanupResult], error: null })
    const logger = { error: vi.fn(), log: vi.fn() }
    const response = await mod!.handleAuthAuditCleanupRequest(
      new Request('https://example.test/auth-audit-cleanup', {
        method: 'POST',
        headers: { Authorization: 'Bearer cron-secret' },
      }),
      {
        env: {
          cronSecret: 'cron-secret',
          supabaseUrl: 'https://example.supabase.co',
          serviceRoleKey: 'service-role-secret',
        },
        createRpcClient: () => ({ rpc }),
        logger,
      }
    )

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('auth_audit_log_cleanup_scheduled')
    expect(logger.log).toHaveBeenCalledWith('Auth audit cleanup completed', {
      result: [cleanupResult],
    })
    await expect(response.json()).resolves.toEqual({
      success: true,
      result: [cleanupResult],
    })
  })

  it('returns a generic failure when the cleanup RPC fails', async () => {
    const mod = await loadHandler()
    expect(mod?.handleAuthAuditCleanupRequest).toBeTypeOf('function')

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'database timeout with secret details' },
    })
    const logger = { error: vi.fn(), log: vi.fn() }
    const response = await mod!.handleAuthAuditCleanupRequest(
      new Request('https://example.test/auth-audit-cleanup', {
        method: 'POST',
        headers: { Authorization: 'Bearer cron-secret' },
      }),
      {
        env: {
          cronSecret: 'cron-secret',
          supabaseUrl: 'https://example.supabase.co',
          serviceRoleKey: 'service-role-secret',
        },
        createRpcClient: () => ({ rpc }),
        logger,
      }
    )

    expect(response.status).toBe(500)
    expect(logger.error).toHaveBeenCalledWith('Auth audit cleanup failed')
    await expect(response.json()).resolves.toEqual({ error: 'Cleanup failed' })
  })
})
