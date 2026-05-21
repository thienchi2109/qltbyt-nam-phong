import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getServerSessionMock = vi.fn()
const callServerRpcMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/server-rpc', () => ({
  callServerRpc: (...args: unknown[]) => callServerRpcMock(...args),
}))

vi.mock('@/lib/ai/provider', () => ({
  getChatModel: vi.fn(),
  getKeyPoolSize: () => 1,
  handleProviderQuotaError: () => false,
}))

vi.mock('@/lib/ai/prompts/system', () => ({
  buildSystemPrompt: () => 'SYSTEM_PROMPT_V1',
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => streamTextMock(...args),
    stepCountIs: (...args: unknown[]) => stepCountIsMock(...args),
  }
})

const VALID_MESSAGES = [
  {
    id: 'msg_1',
    role: 'user',
    parts: [{ type: 'text', text: 'Xin chao' }],
  },
]

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/chat kill switch and global quota', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 429 without calling quota RPC when AI_KILL_SWITCH is on', async () => {
    vi.stubEnv('AI_KILL_SWITCH', 'on')

    const { POST } = await import('../route')
    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(429)
    expect(text).toBe('AI usage is temporarily disabled.')
    expect(callServerRpcMock).not.toHaveBeenCalled()
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('passes global daily quota to reserve RPC and returns its global quota denial', async () => {
    vi.stubEnv('AI_DAILY_GLOBAL_QUOTA_REQUESTS', '1')
    callServerRpcMock.mockResolvedValue([
      {
        allowed: false,
        reservation_id: null,
        reason: 'global_quota',
        message: 'AI daily quota exceeded',
      },
    ])

    const { POST } = await import('../route')
    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(429)
    expect(text).toBe('AI daily quota exceeded')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(callServerRpcMock).toHaveBeenCalledWith(
      'ai_quota_reserve',
      expect.objectContaining({
        p_global_daily_max: 1,
      }),
      expect.objectContaining({
        id: 'u1',
        don_vi: 2,
      }),
    )
  })
})
