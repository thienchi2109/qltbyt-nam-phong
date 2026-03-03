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

describe('/api/chat tenant policy', () => {
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

  it('returns guidance when privileged role has no selected facility for tool usage', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['equipmentLookup'],
      }) as never,
    )
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload).toEqual({
      error: 'Please select a facility before using assistant tools.',
    })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('ignores unsafe tenant override attempts from non-privileged roles', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'technician', don_vi: 2 },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['equipmentLookup'],
        selectedFacilityId: 999,
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(buildSystemPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({ selectedFacilityId: 2 }),
    )
  })

  it('allows privileged roles to run tools when selected facility is provided', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['equipmentLookup'],
        selectedFacilityId: 7,
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(buildSystemPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({ selectedFacilityId: 7 }),
    )
    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs?.tools).toHaveProperty('equipmentLookup')
  })
})
