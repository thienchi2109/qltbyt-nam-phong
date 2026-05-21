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

describe('/api/chat cost-aware failure accounting', () => {
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
  })

  it('records provider-reported usage for finishReason error', async () => {
    streamTextMock.mockImplementation((opts: Record<string, unknown>) => {
      const onFinish = opts.onFinish as
        | ((result: { usage: { inputTokens: number; outputTokens: number }; finishReason: string }) => void)
        | undefined
      onFinish?.({
        usage: { inputTokens: 17, outputTokens: 19 },
        finishReason: 'error',
      })
      return makeReadyStreamTextResult()
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    await vi.waitFor(() => expect(finalizeUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error_with_usage',
      inputTokens: 17,
      outputTokens: 19,
    })))
  })

  it('records zero tokens when the provider supplies no usage', async () => {
    streamTextMock.mockImplementation((opts: Record<string, unknown>) => {
      const onFinish = opts.onFinish as
        | ((result: { usage: { inputTokens?: number; outputTokens?: number }; finishReason: string }) => void)
        | undefined
      onFinish?.({
        usage: {},
        finishReason: 'error',
      })
      return makeReadyStreamTextResult()
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    await vi.waitFor(() => expect(finalizeUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error_with_usage',
      inputTokens: 0,
      outputTokens: 0,
    })))
  })
})
