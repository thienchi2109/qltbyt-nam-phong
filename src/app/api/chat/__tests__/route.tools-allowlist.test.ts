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

describe('/api/chat tools allowlist policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue('google:gemini-2.5-flash')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
    })
  })

  it('blocks unknown tool names', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['toolDoesNotExist'],
      }) as never,
    )
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload).toEqual({ error: 'Unknown tool requested: toolDoesNotExist' })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('blocks known tools that are not in the v1 allowlist', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['systemDiagnostics'],
      }) as never,
    )
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload).toEqual({ error: 'Tool is not allowed in v1: systemDiagnostics' })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('blocks write-intent tool names', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['repairRequestCreate'],
      }) as never,
    )
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload).toEqual({
      error: 'Write-intent tool names are blocked: repairRequestCreate',
    })
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('allows maintenancePlanLookup when explicitly requested', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['maintenancePlanLookup'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()
  })
})
