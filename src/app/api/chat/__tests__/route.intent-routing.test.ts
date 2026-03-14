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

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildMessages(text: string) {
  return [
    {
      id: 'msg_1',
      role: 'user',
      parts: [{ type: 'text', text }],
    },
  ]
}

describe('/api/chat intent routing + clarification guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 17 },
    })
    getChatModelMock.mockReturnValue('google:gemini-2.5-flash')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
    })
  })

  it('routes equipment repair-status questions to equipmentLookup instead of repairSummary', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Có bao nhiêu thiết bị đang chờ sửa chữa?'),
        requestedTools: ['equipmentLookup', 'repairSummary'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('repairSummary')
  })

  it('routes repair-request questions to repairSummary instead of equipmentLookup', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Có bao nhiêu phiếu sửa chữa đang chờ xử lý?'),
        requestedTools: ['equipmentLookup', 'repairSummary'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('repairSummary')
    expect(streamArgs.tools).not.toHaveProperty('equipmentLookup')
  })

  it('asks a clarification question before calling tools for ambiguous repair intents', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tình hình sửa chữa hiện tại thế nào?'),
        requestedTools: ['equipmentLookup', 'repairSummary'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(text).toContain('trạng thái thiết bị')
    expect(text).toContain('yêu cầu sửa chữa')
  })

  it('asks a clarification question before calling tools for ambiguous quota intents', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Kiểm tra định mức giúp tôi'),
        requestedTools: ['equipmentLookup', 'deviceQuotaLookup', 'quotaComplianceSummary'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(text).toContain('một thiết bị cụ thể')
    expect(text).toContain('tổng quan định mức của đơn vị')
  })

  it('returns clarification instead of 400 when privileged user has no facility and intent is ambiguous', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: undefined },
    })

    const res = await POST(
      buildRequest({
        // No selectedFacilityId — privileged user hasn't chosen a facility yet
        messages: buildMessages('Tình hình sửa chữa hiện tại thế nào?'),
        requestedTools: ['equipmentLookup', 'repairSummary'],
      }) as never,
    )
    const text = await res.text()

    // Clarification should fire BEFORE the facility guard
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(text).toContain('trạng thái thiết bị')
  })
})
