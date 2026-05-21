import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const reserveUsageMock = vi.fn()
const finalizeUsageMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/provider', () => ({
  getChatModel: (...args: unknown[]) => getChatModelMock(...args),
  getKeyPoolSize: () => 1,
  handleProviderQuotaError: () => false,
}))

vi.mock('@/lib/ai/prompts/system', () => ({
  buildSystemPrompt: (...args: unknown[]) => buildSystemPromptMock(...args),
}))

vi.mock('@/lib/ai/limits', () => ({
  AI_MAX_OUTPUT_TOKENS: 256,
  AI_MAX_TOOL_STEPS: 4,
  AI_MAX_MESSAGES: 20,
  AI_MAX_INPUT_CHARS: 20_000,
  AI_MAX_COMPACTED_INPUT_CHARS: 10_000,
  calculateInputChars: (messages: unknown[]) => JSON.stringify(messages).length,
}))

vi.mock('@/lib/ai/usage-metering', () => ({
  classifyStreamFailure: ({ providerUsage }: { providerUsage?: { inputTokens?: number; outputTokens?: number } }) => ({
    status: 'error_with_usage',
    inputTokens: providerUsage?.inputTokens ?? 0,
    outputTokens: providerUsage?.outputTokens ?? 0,
  }),
  reserveUsage: (...args: unknown[]) => reserveUsageMock(...args),
  finalizeUsage: (...args: unknown[]) => finalizeUsageMock(...args),
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
import {
  makeChatModel,
  makeReadyStreamTextResult,
} from './stream-text-result-test-helpers'

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
    getChatModelMock.mockReturnValue(makeChatModel('google:gemini-2.5-flash'))
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    reserveUsageMock.mockResolvedValue({
      allowed: true,
      reservationId: '00000000-0000-4000-8000-000000000484',
    })
    finalizeUsageMock.mockResolvedValue(undefined)
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
      return makeReadyStreamTextResult()
    })
  })

  it('returns 429 when rate-limited', async () => {
    reserveUsageMock.mockResolvedValue({
      allowed: false,
      reason: 'rate_limit',
      message: 'Too many requests. Please try again later.',
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(429)
    expect(text).toBe('Too many requests. Please try again later.')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(finalizeUsageMock).not.toHaveBeenCalled()
  })

  it('returns 429 when quota is exceeded', async () => {
    reserveUsageMock.mockResolvedValue({
      allowed: false,
      reason: 'tenant_quota',
      message: 'AI usage quota exceeded for this facility.',
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(429)
    expect(text).toBe('AI usage quota exceeded for this facility.')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(finalizeUsageMock).not.toHaveBeenCalled()
  })

  it('reserves before stream and finalizes provider-reported usage on finish', async () => {
    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    expect(reserveUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1',
      tenantId: 2,
      role: 'admin',
    }))
    expect(reserveUsageMock.mock.invocationCallOrder[0]).toBeLessThan(
      streamTextMock.mock.invocationCallOrder[0],
    )
    expect(streamTextMock).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(finalizeUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: '00000000-0000-4000-8000-000000000484',
      status: 'success',
      inputTokens: 100,
      outputTokens: 50,
    })))
  })
})
