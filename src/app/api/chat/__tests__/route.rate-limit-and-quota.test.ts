import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const checkUsageLimitsMock = vi.fn()
const recordUsageMock = vi.fn()
const confirmUsageMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/provider', () => ({
  getChatModel: (...args: unknown[]) => getChatModelMock(...args),
}))

vi.mock('@/lib/ai/prompts/system', () => ({
  buildSystemPrompt: (...args: unknown[]) => buildSystemPromptMock(...args),
}))

vi.mock('@/lib/ai/limits', () => ({
  AI_MAX_OUTPUT_TOKENS: 256,
  AI_MAX_TOOL_STEPS: 4,
  AI_MAX_MESSAGES: 20,
  AI_MAX_INPUT_CHARS: 20_000,
}))

vi.mock('@/lib/ai/usage-metering', () => ({
  checkUsageLimits: (...args: unknown[]) => checkUsageLimitsMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
  confirmUsage: (...args: unknown[]) => confirmUsageMock(...args),
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => streamTextMock(...args),
    stepCountIs: (...args: unknown[]) => stepCountIsMock(...args),
  }
})

import { POST } from '../route'

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VALID_MESSAGES = [
  {
    id: 'msg_1',
    role: 'user',
    parts: [{ type: 'text', text: 'Xin chao' }],
  },
]

describe('/api/chat rate limit and quota', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue('google:gemini-2.5-flash')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    streamTextMock.mockImplementation((opts: Record<string, unknown>) => {
      // Simulate onFinish callback firing with mock usage data
      const onFinish = opts.onFinish as
        | ((result: { usage: { inputTokens: number; outputTokens: number }; finishReason: string }) => void)
        | undefined
      if (onFinish) {
        onFinish({
          usage: { inputTokens: 100, outputTokens: 50 },
          finishReason: 'stop',
        })
      }
      return {
        toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
      }
    })
  })

  it('returns 429 when rate-limited', async () => {
    checkUsageLimitsMock.mockReturnValue({
      allowed: false,
      message: 'Too many requests. Please try again later.',
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const payload = await res.json()

    expect(res.status).toBe(429)
    expect(payload).toEqual({ error: 'Too many requests. Please try again later.' })
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(recordUsageMock).not.toHaveBeenCalled()
    expect(confirmUsageMock).not.toHaveBeenCalled()
  })

  it('returns 429 when quota is exceeded', async () => {
    checkUsageLimitsMock.mockReturnValue({
      allowed: false,
      message: 'AI usage quota exceeded for this facility.',
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const payload = await res.json()

    expect(res.status).toBe(429)
    expect(payload).toEqual({ error: 'AI usage quota exceeded for this facility.' })
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(recordUsageMock).not.toHaveBeenCalled()
    expect(confirmUsageMock).not.toHaveBeenCalled()
  })

  it('records usage when request is allowed', async () => {
    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    expect(checkUsageLimitsMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tenantId: 2 }),
    )
    expect(streamTextMock).toHaveBeenCalledTimes(1)
    // recordUsage is called upfront for rate-limit tracking
    expect(recordUsageMock).toHaveBeenCalledTimes(1)
    // confirmUsage is called via onFinish after successful stream
    expect(confirmUsageMock).toHaveBeenCalledTimes(1)
    expect(confirmUsageMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', tenantId: 2 }),
      expect.objectContaining({ inputTokens: 100, outputTokens: 50 }),
    )
  })
})
