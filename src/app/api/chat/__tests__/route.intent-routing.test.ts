import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const checkUsageLimitsMock = vi.fn()
const recordUsageMock = vi.fn()
const confirmUsageMock = vi.fn()
const executeAuditedAssistantSqlMock = vi.fn()

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

vi.mock('@/lib/ai/sql/audited-executor', () => ({
  executeAuditedAssistantSql: (...args: unknown[]) =>
    executeAuditedAssistantSqlMock(...args),
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
    getChatModelMock.mockReturnValue({ model: 'google:gemini-2.5-flash', keyIndex: 0 })
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue(makeReadyStreamTextResult())
    executeAuditedAssistantSqlMock.mockResolvedValue({
      rowCount: 1,
      rows: [{ total: 3 }],
      sqlShape: 'select total from ai_readonly.reporting_summary',
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
    expect(streamArgs.tools).not.toHaveProperty('query_database')
  })

  it('asks a clarification question for mixed repair and quota prompts before calling tools', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages(
          'Có bao nhiêu phiếu sửa chữa và thiết bị vượt định mức trong đơn vị hiện tại?',
        ),
        requestedTools: [
          'equipmentLookup',
          'repairSummary',
          'deviceQuotaLookup',
          'quotaComplianceSummary',
          'query_database',
        ],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(text).toContain('ý chính')
    expect(text).toContain('sửa chữa')
    expect(text).toContain('định mức')
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

  it('keeps query_database out of quota-summary routing decisions', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tổng quan định mức của đơn vị hiện tại thế nào?'),
        requestedTools: ['deviceQuotaLookup', 'quotaComplianceSummary', 'query_database'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('quotaComplianceSummary')
    expect(streamArgs.tools).not.toHaveProperty('deviceQuotaLookup')
    expect(streamArgs.tools).not.toHaveProperty('query_database')
  })

  it('keeps clear repair prompts on curated tools when the panel sends the full tool list', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Có bao nhiêu phiếu sửa chữa đang chờ xử lý?'),
        requestedTools: [
          'equipmentLookup',
          'maintenanceSummary',
          'maintenancePlanLookup',
          'repairSummary',
          'usageHistory',
          'attachmentLookup',
          'deviceQuotaLookup',
          'quotaComplianceSummary',
          'query_database',
        ],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('repairSummary')
    expect(streamArgs.tools).toHaveProperty('maintenanceSummary')
    expect(streamArgs.tools).toHaveProperty('quotaComplianceSummary')
    expect(streamArgs.tools).not.toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('query_database')
  })

  it('asks for a concrete equipment identifier before calling equipmentLookup on ambiguous device lookup prompts', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tra cứu thông tin thiết bị X'),
        requestedTools: ['equipmentLookup'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(streamTextMock).not.toHaveBeenCalled()
    expect(text).toContain('thiết bị nào')
    expect(text).toContain('mã thiết bị')
    expect(text).toContain('serial')
  })

  it('narrows tool exposure to equipmentLookup for specific device info lookups', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tra cứu thông tin thiết bị monitor CMS8000'),
        requestedTools: [
          'equipmentLookup',
          'maintenanceSummary',
          'repairSummary',
          'usageHistory',
          'attachmentLookup',
          'deviceQuotaLookup',
        ],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('maintenanceSummary')
    expect(streamArgs.tools).not.toHaveProperty('repairSummary')
    expect(streamArgs.tools).not.toHaveProperty('usageHistory')
    expect(streamArgs.tools).not.toHaveProperty('attachmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('deviceQuotaLookup')
    expect(streamArgs.tools).not.toHaveProperty('query_database')
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

  it('routes narrow reporting prompts to query_database only', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages(
          'Báo cáo tổng hợp số lượng thiết bị theo trạng thái của đơn vị hiện tại',
        ),
        requestedTools: [
          'equipmentLookup',
          'maintenanceSummary',
          'repairSummary',
          'usageHistory',
          'query_database',
        ],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('query_database')
    expect(streamArgs.tools).not.toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('maintenanceSummary')
    expect(streamArgs.tools).not.toHaveProperty('repairSummary')
    expect(streamArgs.tools).not.toHaveProperty('usageHistory')
  })

  it('routes detailed reporting prompts with chi tiết to query_database only', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages(
          'Báo cáo chi tiết tình trạng thiết bị theo khoa trong đơn vị hiện tại',
        ),
        requestedTools: [
          'equipmentLookup',
          'maintenanceSummary',
          'repairSummary',
          'usageHistory',
          'query_database',
        ],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('query_database')
    expect(streamArgs.tools).not.toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('maintenanceSummary')
    expect(streamArgs.tools).not.toHaveProperty('repairSummary')
    expect(streamArgs.tools).not.toHaveProperty('usageHistory')
  })

  it('fails closed for query_database when a privileged user has not selected a facility', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: undefined },
    })

    const res = await POST(
      buildRequest({
        messages: buildMessages(
          'Báo cáo tổng hợp số lượng thiết bị theo trạng thái của đơn vị hiện tại',
        ),
        requestedTools: ['query_database'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toContain('vui lòng chọn cơ sở y tế')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('uses the server-injected facility scope when query_database executes', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 17 },
    })

    const res = await POST(
      buildRequest({
        selectedFacilityId: 999,
        messages: buildMessages('Cho tôi báo cáo tổng hợp số lượng thiết bị theo trạng thái'),
        requestedTools: ['query_database'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<
        string,
        {
          execute?: (input: Record<string, unknown>) => Promise<unknown>
        }
      >
    }
    await streamArgs.tools?.query_database?.execute?.({
      reasoning: 'Need a facility-scoped status summary.',
      sql: 'select total from ai_readonly.reporting_summary',
    })

    expect(executeAuditedAssistantSqlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: expect.objectContaining({
          effectiveFacilityId: 17,
          facilitySource: 'session',
          requestedFacilityId: 999,
          sessionFacilityId: 17,
          userId: 'u1',
        }),
      }),
    )
  })
})
