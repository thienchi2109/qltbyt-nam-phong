import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
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
import {
  AI_READONLY_FORBIDDEN_REFERENCES,
  QUERY_DATABASE_TOOL_DESCRIPTION,
} from '@/lib/ai/sql/schema-cheatsheet'
import { makeChatModel, makeReadyStreamTextResult } from './stream-text-result-test-helpers'

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/chat query_database grounding payload', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 17 },
    })
    getChatModelMock.mockReturnValue(makeChatModel('google/gemini-3.1-flash-lite-preview'))
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue(makeReadyStreamTextResult())
  })

  it('sends the strengthened query_database grounding contract to streamText', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            parts: [{ type: 'text', text: 'Thống kê số lượng thiết bị theo khoa' }],
          },
        ],
        requestedTools: ['query_database'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamTextArgs = streamTextMock.mock.calls[0]?.[0] as {
      system?: string
      tools?: Record<string, { description?: string }>
    }

    expect(streamTextArgs.system).toContain('equipment_search')
    expect(streamTextArgs.system).toContain('maintenance_facts')
    expect(streamTextArgs.system).toContain('repair_facts')
    expect(streamTextArgs.system).toContain('usage_facts')
    expect(streamTextArgs.system).toContain('quota_facts')
    expect(streamTextArgs.system).toContain('khoa_phong_quan_ly')
    expect(streamTextArgs.system).toContain('nguoi_dang_truc_tiep_quan_ly')
    expect(streamTextArgs.system).toContain('vi_tri_lap_dat')
    expect(streamTextArgs.system).toContain('phan_loai_theo_nd98')
    expect(streamTextArgs.system).toContain('ngay_dua_vao_su_dung_date')
    expect(streamTextArgs.system).toContain('ngay_dua_vao_su_dung_year')
    expect(streamTextArgs.system).toContain('ngay_dua_vao_su_dung_month')
    expect(streamTextArgs.system).toContain('ngay_dua_vao_su_dung_quarter')
    expect(streamTextArgs.system).toContain('KHÔNG dùng raw schema/tên')
    for (const ref of AI_READONLY_FORBIDDEN_REFERENCES) {
      expect(streamTextArgs.system).toContain(ref)
    }

    expect(streamTextArgs.tools?.query_database?.description).toBe(
      QUERY_DATABASE_TOOL_DESCRIPTION,
    )
    expect(streamTextArgs.tools?.query_database?.description).toContain(
      'ai_readonly.equipment_search',
    )
    expect(streamTextArgs.tools?.query_database?.description).toContain(
      'nguoi_dang_truc_tiep_quan_ly',
    )
    expect(streamTextArgs.tools?.query_database?.description).toContain(
      'ngay_dua_vao_su_dung_year',
    )
    expect(streamTextArgs.tools?.query_database?.description).toContain(
      'GROUP BY nguoi_dang_truc_tiep_quan_ly',
    )
  })
})
