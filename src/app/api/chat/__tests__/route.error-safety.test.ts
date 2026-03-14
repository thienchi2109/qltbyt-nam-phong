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
  getKeyPoolSize: () => 1,
  handleProviderQuotaError: () => false,
}))

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

describe('/api/chat error safety — non-stream contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getChatModelMock.mockReturnValue('google:gemini-2.5-flash')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
    })
  })

  it('returns text/plain for privileged user with tools but no facility (undefined)', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: undefined },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['equipmentLookup'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).toBe('Please select a facility before using assistant tools.')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('returns text/plain for privileged user with tools but facility null', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['equipmentLookup'],
        selectedFacilityId: null,
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).toBe('Please select a facility before using assistant tools.')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('returns text/plain 429 when rate-limited', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    checkUsageLimitsMock.mockReturnValue({
      allowed: false,
      message: 'Too many requests. Please try again later.',
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(429)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).toBe('Too many requests. Please try again later.')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('returns text/plain for all non-stream error statuses', async () => {
    // 401 - no session
    getServerSessionMock.mockResolvedValue(null)
    const res401 = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    expect(res401.status).toBe(401)
    expect(res401.headers.get('content-type')).toContain('text/plain')

    // 403 - invalid role
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'auditor' } })
    const res403 = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    expect(res403.status).toBe(403)
    expect(res403.headers.get('content-type')).toContain('text/plain')

    // 400 - malformed payload
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } })
    const res400 = await POST(buildRequest({}) as never)
    expect(res400.status).toBe(400)
    expect(res400.headers.get('content-type')).toContain('text/plain')
  })
})

describe('/api/chat error safety — sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue('google:gemini-2.5-flash')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
  })

  it('sanitizes pre-stream errors containing API keys', async () => {
    streamTextMock.mockImplementation(() => {
      throw new Error('Connection failed: API_KEY=sk-abc123xyz provider error')
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).not.toContain('sk-')
    expect(text).not.toContain('API_KEY')
  })

  it('sanitizes pre-stream errors containing file paths', async () => {
    streamTextMock.mockImplementation(() => {
      throw new Error('Error at C:\\Users\\dev\\node_modules\\ai\\src\\index.ts:42')
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(text).not.toContain('C:\\Users')
    expect(text).not.toContain('node_modules')
  })

  it('passes onError callback to toUIMessageStreamResponse', async () => {
    let capturedOnError: unknown = undefined
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: (opts?: { onError?: unknown }) => {
        capturedOnError = opts?.onError
        return new Response(null, { status: 200 })
      },
    })

    await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(capturedOnError).toBeTypeOf('function')
  })

  it('returns generic message even for clean-looking provider errors (deny-by-default)', async () => {
    streamTextMock.mockImplementation(() => {
      throw new Error('Model overloaded, please retry')
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(text).toBe('Đã xảy ra lỗi. Vui lòng thử lại.')
    expect(text).not.toContain('Model overloaded')
  })

  it('returns a clear quota message for provider quota exceeded errors', async () => {
    streamTextMock.mockImplementation(() => {
      throw new Error(
        'responseBody: {"error":{"code":429,"message":"You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-2.5-flash Please retry in 16.292864906s."}}',
      )
    })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(500)
    expect(text).toBe(
      'Model AI đang vượt hạn mức sử dụng của nhà cung cấp. Vui lòng chờ khoảng 17 giây rồi thử lại.',
    )
    expect(text).not.toContain('generativelanguage.googleapis.com')
    expect(text).not.toContain('gemini-2.5-flash')
  })
})
