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
  AI_MAX_OUTPUT_TOKENS: 111,
  AI_MAX_TOOL_STEPS: 3,
  AI_MAX_MESSAGES: 2,
  AI_MAX_INPUT_CHARS: 120,
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

function buildMessage(id: string, text = 'Xin chao') {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

describe('/api/chat limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue('google:gemini-2.5-flash')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
    })
  })

  it('applies maxOutputTokens and stopWhen guardrails to streamText', async () => {
    const res = await POST(
      buildRequest({ messages: [buildMessage('m1')] }) as never,
    )

    expect(res.status).toBe(200)
    expect(stepCountIsMock).toHaveBeenCalledWith(3)
    const streamTextArgs = streamTextMock.mock.calls[0]?.[0] as {
      maxOutputTokens?: number
      stopWhen?: unknown
    }
    expect(streamTextArgs?.maxOutputTokens).toBe(111)
    expect(streamTextArgs?.stopWhen).toBe('STOP_WHEN_SENTINEL')
  })

  it('rejects requests exceeding message count limit', async () => {
    const res = await POST(
      buildRequest({
        messages: [buildMessage('m1'), buildMessage('m2'), buildMessage('m3')],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe('Request exceeds message limit')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('rejects requests exceeding input size limit', async () => {
    const longText = 'x'.repeat(600)
    const res = await POST(
      buildRequest({ messages: [buildMessage('m1', longText)] }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe('Request exceeds input size limit')
    expect(streamTextMock).not.toHaveBeenCalled()
  })
})
