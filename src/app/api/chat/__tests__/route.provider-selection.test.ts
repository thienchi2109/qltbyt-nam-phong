import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatProviderConfigMock = vi.fn()
const getChatModelMock = vi.fn()
const getKeyPoolSizeMock = vi.fn()
const handleProviderQuotaErrorMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const checkUsageLimitsMock = vi.fn()
const recordUsageMock = vi.fn()
const confirmUsageMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/provider', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/ai/provider')
  return {
    ...actual,
    getChatProviderConfig: (...args: unknown[]) => getChatProviderConfigMock(...args),
    getChatModel: (...args: unknown[]) => getChatModelMock(...args),
    getKeyPoolSize: (...args: unknown[]) => getKeyPoolSizeMock(...args),
    handleProviderQuotaError: (...args: unknown[]) => handleProviderQuotaErrorMock(...args),
  }
})

vi.mock('@/lib/ai/prompts/system', () => ({
  buildSystemPrompt: (...args: unknown[]) => buildSystemPromptMock(...args),
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

const ORIGINAL_ENV = { ...process.env }

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

function makeReadyStream() {
  return {
    fullStream: {
      [Symbol.asyncIterator]() {
        let done = false
        return {
          async next() {
            if (done) {
              return { done: true, value: undefined }
            }

            done = true
            return { done: false, value: { type: 'start-step' } }
          },
          async return() {
            return { done: true, value: undefined }
          },
        }
      },
    },
    toUIMessageStreamResponse: vi.fn(() => new Response(null, { status: 200 })),
  }
}

describe('/api/chat provider selection', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV }

    const actualProvider = await vi.importActual<Record<string, unknown>>('@/lib/ai/provider')
    getChatProviderConfigMock.mockImplementation(() => {
      const getter = actualProvider.getChatProviderConfig
      if (typeof getter !== 'function') {
        throw new Error('Missing test hook: getChatProviderConfig')
      }

      return getter()
    })

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue({ model: 'provider-model', keyIndex: 0 })
    getKeyPoolSizeMock.mockReturnValue(1)
    handleProviderQuotaErrorMock.mockReturnValue(false)
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    recordUsageMock.mockReturnValue(undefined)
    streamTextMock.mockReturnValue(makeReadyStream())
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('includes Google-only provider options for Google requests', async () => {
    process.env.AI_PROVIDER = 'google'
    process.env.GOOGLE_GENERATIVE_AI_MODEL = 'gemini-test-model'

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    expect(getChatProviderConfigMock).toHaveBeenCalledOnce()
    expect(streamTextMock).toHaveBeenCalledOnce()
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: 'medium' },
          },
        },
      }),
    )
  })

  it('omits providerOptions.google for Groq requests', async () => {
    process.env.AI_PROVIDER = 'groq'
    process.env.GROQ_MODEL = 'groq-test-model'

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    expect(getChatProviderConfigMock).toHaveBeenCalledOnce()
    expect(streamTextMock).toHaveBeenCalledOnce()
    const call = streamTextMock.mock.calls[0]?.[0] as {
      providerOptions?: Record<string, unknown>
    }
    expect(call.providerOptions?.google).toBeUndefined()
  })

  it('logs the active provider and configured model when an attempt starts', async () => {
    process.env.AI_PROVIDER = 'groq'
    process.env.GROQ_MODEL = 'groq-test-model'
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    try {
        const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

        expect(res.status).toBe(200)
        expect(getChatProviderConfigMock).toHaveBeenCalledOnce()
        expect(infoSpy).toHaveBeenCalledWith(
          '[chat] Model attempt start',
          expect.objectContaining({
          attempt: 1,
          maxAttempts: 1,
          keyIndex: 0,
          provider: 'groq',
          model: 'groq-test-model',
        }),
      )
    } finally {
      infoSpy.mockRestore()
    }
  })

  it('returns an explicit provider configuration error for invalid AI_PROVIDER values', async () => {
    process.env.AI_PROVIDER = 'openai'

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(getChatProviderConfigMock).toHaveBeenCalledOnce()
    expect(text).toBe('Unsupported AI provider: openai')
    expect(text).not.toContain('All API keys exhausted')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('sanitizes provider configuration errors instead of echoing raw exception text', async () => {
    getChatProviderConfigMock.mockImplementation(() => {
      throw new Error(
        'Unsupported AI provider: openai internal=/tmp/provider-secret stack=boom',
      )
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(getChatProviderConfigMock).toHaveBeenCalledOnce()
    expect(text).toBe('Unsupported AI provider: openai')
    expect(text).not.toContain('internal=')
    expect(text).not.toContain('/tmp/provider-secret')
    expect(text).not.toContain('stack=boom')
    expect(streamTextMock).not.toHaveBeenCalled()
  })
})
