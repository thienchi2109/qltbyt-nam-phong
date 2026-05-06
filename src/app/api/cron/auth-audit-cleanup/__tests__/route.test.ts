import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMocks.createClient,
}))

const ORIGINAL_ENV = { ...process.env }

async function loadRoute() {
  try {
    const routeModulePath = ['..', 'route'].join('/')
    return await import(/* @vite-ignore */ routeModulePath)
  } catch {
    return null
  }
}

describe('/api/cron/auth-audit-cleanup', () => {
  beforeEach(() => {
    vi.resetModules()
    supabaseMocks.createClient.mockReset()
    supabaseMocks.rpc.mockReset()
    process.env = {
      ...ORIGINAL_ENV,
      CRON_SECRET: 'cron-secret',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
    }
    supabaseMocks.createClient.mockReturnValue({ rpc: supabaseMocks.rpc })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('rejects requests without the Vercel cron bearer token', async () => {
    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf('function')

    const response = await mod!.GET(
      new Request('https://example.test/api/cron/auth-audit-cleanup')
    )

    expect(response.status).toBe(401)
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('calls auth_audit_log_cleanup_scheduled for an authorized cron request', async () => {
    const cleanupResult = {
      deleted_count: 3,
      oldest_remaining: '2026-02-06T03:00:00.000Z',
      batches_executed: 1,
      cutoff_date: '2026-02-05T03:00:00.000Z',
    }
    supabaseMocks.rpc.mockResolvedValue({ data: [cleanupResult], error: null })

    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf('function')

    const response = await mod!.GET(
      new Request('https://example.test/api/cron/auth-audit-cleanup', {
        headers: { Authorization: 'Bearer cron-secret' },
      })
    )

    expect(response.status).toBe(200)
    expect(supabaseMocks.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-secret',
      { auth: { persistSession: false } }
    )
    expect(supabaseMocks.rpc).toHaveBeenCalledWith('auth_audit_log_cleanup_scheduled')
    await expect(response.json()).resolves.toEqual({
      success: true,
      result: [cleanupResult],
    })
  })

  it('does not leak RPC errors in the response', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'database timeout with sensitive details' },
    })

    const mod = await loadRoute()
    expect(mod?.GET).toBeTypeOf('function')

    const response = await mod!.GET(
      new Request('https://example.test/api/cron/auth-audit-cleanup', {
        headers: { Authorization: 'Bearer cron-secret' },
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Cleanup failed' })
  })
})
