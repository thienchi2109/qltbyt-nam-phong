import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const getKeyPoolSizeMock = vi.fn()
const handleProviderQuotaErrorMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const reserveUsageMock = vi.fn()
const finalizeUsageMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/provider', () => ({
  getChatModel: (...args: unknown[]) => getChatModelMock(...args),
  getKeyPoolSize: (...args: unknown[]) => getKeyPoolSizeMock(...args),
  handleProviderQuotaError: (...args: unknown[]) => handleProviderQuotaErrorMock(...args),
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

import { POST } from '@/app/api/chat/route'
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

describe('/api/chat quota finalize on retry and errors', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    getKeyPoolSizeMock.mockReturnValue(1)
    getChatModelMock.mockReturnValue(makeChatModel('google:gemini-2.5-flash'))
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    reserveUsageMock.mockResolvedValue({
      allowed: true,
      reservationId: '00000000-0000-4000-8000-000000000484',
    })
    finalizeUsageMock.mockResolvedValue(undefined)
    handleProviderQuotaErrorMock.mockReturnValue(false)
  })

  it('finalizes error_no_usage when the provider fails before a stream starts', async () => {
    streamTextMock.mockImplementation(() => {
      throw new Error('Network timeout before stream')
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(500)
    expect(finalizeUsageMock).toHaveBeenCalledOnce()
    expect(finalizeUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: '00000000-0000-4000-8000-000000000484',
      status: 'error_no_usage',
      inputTokens: 0,
      outputTokens: 0,
    }))
  })

  it('keeps one reservation across provider retry and finalizes once on success', async () => {
    getKeyPoolSizeMock.mockReturnValue(2)
    getChatModelMock
      .mockReturnValueOnce(makeChatModel('google:gemini-2.5-flash'))
      .mockReturnValueOnce(makeChatModel('google:gemini-2.5-flash'))
    handleProviderQuotaErrorMock.mockReturnValueOnce(true)
    streamTextMock
      .mockImplementationOnce(() => {
        throw new Error('You exceeded your current quota')
      })
      .mockImplementationOnce((opts: Record<string, unknown>) => {
        const onFinish = opts.onFinish as
          | ((result: { usage: { inputTokens: number; outputTokens: number }; finishReason: string }) => void)
          | undefined
        onFinish?.({
          usage: { inputTokens: 7, outputTokens: 5 },
          finishReason: 'stop',
        })
        return makeReadyStreamTextResult()
      })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    expect(reserveUsageMock).toHaveBeenCalledOnce()
    expect(streamTextMock).toHaveBeenCalledTimes(2)
    expect(finalizeUsageMock).toHaveBeenCalledOnce()
    expect(finalizeUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: '00000000-0000-4000-8000-000000000484',
      status: 'success',
      inputTokens: 7,
      outputTokens: 5,
    }))
  })

  it('allows a later finalize callback to retry after a transient finalize failure', async () => {
    let onFinish:
      | ((result: { usage: { inputTokens: number; outputTokens: number }; finishReason: string }) => void)
      | undefined
    finalizeUsageMock
      .mockRejectedValueOnce(new Error('temporary quota finalize failure'))
      .mockResolvedValueOnce(undefined)
    streamTextMock.mockImplementation((opts: Record<string, unknown>) => {
      onFinish = opts.onFinish as typeof onFinish
      onFinish?.({
        usage: { inputTokens: 7, outputTokens: 5 },
        finishReason: 'stop',
      })
      return makeReadyStreamTextResult()
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    await vi.waitFor(() => expect(finalizeUsageMock).toHaveBeenCalledTimes(1))

    onFinish?.({
      usage: { inputTokens: 7, outputTokens: 5 },
      finishReason: 'stop',
    })

    await vi.waitFor(() => expect(finalizeUsageMock).toHaveBeenCalledTimes(2))
  })

  it('keeps readiness failures in error_no_usage before any stream part is ready', async () => {
    streamTextMock.mockReturnValue({
      fullStream: {
        [Symbol.asyncIterator]() {
          let index = 0
          const parts = [{ type: 'start' }]

          return {
            async next() {
              if (index >= parts.length) {
                return { done: true, value: undefined }
              }
              return { done: false, value: parts[index++] }
            },
            async return() {
              return { done: true, value: undefined }
            },
          }
        },
      },
      toUIMessageStream: () => {
        throw new Error('should not build UI stream')
      },
      steps: Promise.resolve([]),
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(500)
    expect(finalizeUsageMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error_no_usage',
      inputTokens: 0,
      outputTokens: 0,
    }))
  })
})
