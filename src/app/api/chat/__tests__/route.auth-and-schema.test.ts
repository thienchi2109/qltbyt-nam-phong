import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()

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

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => streamTextMock(...args),
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

describe('/api/chat auth + schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getChatModelMock.mockReturnValue(makeChatModel('google:gemini-2.5-flash'))
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    streamTextMock.mockReturnValue(makeReadyStreamTextResult())
  })

  it('returns 401 when session is missing', async () => {
    getServerSessionMock.mockResolvedValue(null)

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(401)
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('returns 403 when authenticated role is not allowed', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'auditor' } })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)
    const text = await res.text()

    expect(res.status).toBe(403)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).toBe('Forbidden')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(buildSystemPromptMock).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed payload', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } })

    const res = await POST(buildRequest({}) as never)

    expect(res.status).toBe(400)
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('returns 400 when messages array is empty', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } })

    const res = await POST(buildRequest({ messages: [] }) as never)
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(text).toBe('Invalid request payload')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(buildSystemPromptMock).not.toHaveBeenCalled()
  })

  it('returns 400 for malformed messages item', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'user' } })

    const res = await POST(buildRequest({ messages: [{}] }) as never)

    expect(res.status).toBe(400)
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('uses model call path for authenticated valid payload', async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: 'u1', role: 'admin' } })

    const res = await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledTimes(1)
    expect(getChatModelMock).toHaveBeenCalledTimes(1)
  })

  it('uses buildSystemPrompt output as streamText system prompt', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })

    await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(buildSystemPromptMock).toHaveBeenCalledTimes(1)
    const streamTextArgs = streamTextMock.mock.calls[0]?.[0] as {
      system?: string
    }
    expect(streamTextArgs?.system).toBe('SYSTEM_PROMPT_V1')
  })

  it('normalizes string tenant IDs when deriving facility context', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: '2' },
    })

    await POST(buildRequest({ messages: VALID_MESSAGES }) as never)

    expect(buildSystemPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({ selectedFacilityId: 2 }),
    )
  })
})
