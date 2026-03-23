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
import { makeReadyStreamTextResult } from './stream-text-result-test-helpers'

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

describe('/api/chat usageHistory tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue({ model: 'google:gemini-3-flash-preview', keyIndex: 0 })
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue(makeReadyStreamTextResult())
  })

  it('accepts usageHistory when explicitly requested', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['usageHistory'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs?.tools).toHaveProperty('usageHistory')
  })

  it('blocks usageHistory without facility context for privileged role', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['usageHistory'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe(
      'Anh/chị vui lòng chọn cơ sở y tế tại bộ lọc đơn vị trên thanh điều hướng (phía trên bên trái màn hình) trước khi sử dụng trợ lý tra cứu.',
    )
    expect(streamTextMock).not.toHaveBeenCalled()
  })
})
