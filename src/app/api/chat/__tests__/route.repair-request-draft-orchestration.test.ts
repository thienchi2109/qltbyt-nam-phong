import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const checkUsageLimitsMock = vi.fn()
const recordUsageMock = vi.fn()
const confirmUsageMock = vi.fn()
const generateObjectMock = vi.fn()

vi.mock('server-only', () => ({}))

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
    generateObject: (...args: unknown[]) => generateObjectMock(...args),
  }
})

import { POST } from '../route'
import {
  makeReadyStreamTextResult,
  parseSseJsonChunks,
} from './stream-text-result-test-helpers'

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

function makeChatModel(model: string) {
  return {
    model,
    keyIndex: 0,
    config: {
      capability: 'default_chat',
      provider: 'google',
      model,
    },
    providerOptions: {
      google: {
        thinkingConfig: { thinkingLevel: 'medium' },
      },
    },
  }
}

function getToolChunks(payload: string) {
  return parseSseJsonChunks(payload).filter(
    chunk =>
      chunk.type === 'tool-input-available' ||
      chunk.type === 'tool-output-available',
  )
}

describe('/api/chat repair-request draft orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 17 },
    })
    getChatModelMock.mockReturnValue(makeChatModel('gemini-2.5-flash'))
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
  })

  it('emits a synthetic repair-request draft after the base stream when evidence is complete', async () => {
    streamTextMock.mockReturnValue(
      makeReadyStreamTextResult({
        steps: [
          {
            toolResults: [
              {
                toolName: 'equipmentLookup',
                output: {
                  modelSummary: {
                    summaryText: 'equipmentLookup: 1 result(s).',
                    itemCount: 1,
                  },
                  followUpContext: {
                    equipment: [
                      {
                        thiet_bi_id: 42,
                        ma_thiet_bi: 'TB-042',
                        ten_thiet_bi: 'May tho ABC',
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }),
    )
    generateObjectMock.mockResolvedValue({
      object: {
        mo_ta_su_co: 'Thiet bi mat nguon khi khoi dong',
        hang_muc_sua_chua: 'Kiem tra bo nguon',
        ngay_mong_muon_hoan_thanh: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        missingRequiredFields: [],
      },
    })

    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages(
          'Tạo phiếu yêu cầu sửa chữa thiết bị máy thở ABC. Mô tả sự cố: thiết bị mất nguồn khi khởi động. Hạng mục sửa chữa: kiểm tra bo nguồn.',
        ),
        requestedTools: [
          'equipmentLookup',
          'repairSummary',
          'generateRepairRequestDraft',
        ],
      }) as never,
    )
    const payload = await res.text()
    const toolChunks = getToolChunks(payload)

    expect(res.status).toBe(200)
    expect(generateObjectMock).toHaveBeenCalledOnce()
    expect(toolChunks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-input-available',
          toolName: 'generateRepairRequestDraft',
          toolCallId: 'generateRepairRequestDraft-42',
          input: expect.objectContaining({
            thiet_bi_id: 42,
            draftIntent: true,
          }),
        }),
        expect.objectContaining({
          type: 'tool-output-available',
          toolCallId: 'generateRepairRequestDraft-42',
          output: expect.objectContaining({
            kind: 'repairRequestDraft',
          }),
        }),
      ]),
    )

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).toHaveProperty('repairSummary')
    expect(streamArgs.tools).not.toHaveProperty('generateRepairRequestDraft')
  })

  it('does not emit a repair-request draft when required fields are still missing', async () => {
    streamTextMock.mockReturnValue(
      makeReadyStreamTextResult({
        steps: [
          {
            toolResults: [
              {
                toolName: 'equipmentLookup',
                output: {
                  modelSummary: {
                    summaryText: 'equipmentLookup: 1 result(s).',
                    itemCount: 1,
                  },
                  followUpContext: {
                    equipment: [{ thiet_bi_id: 42 }],
                  },
                },
              },
            ],
          },
        ],
      }),
    )
    generateObjectMock.mockResolvedValue({
      object: {
        mo_ta_su_co: null,
        hang_muc_sua_chua: 'Kiem tra bo nguon',
        ngay_mong_muon_hoan_thanh: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        missingRequiredFields: ['mo_ta_su_co'],
      },
    })

    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tạo phiếu yêu cầu sửa chữa thiết bị máy thở ABC'),
        requestedTools: [
          'equipmentLookup',
          'repairSummary',
          'generateRepairRequestDraft',
        ],
      }) as never,
    )
    const payload = await res.text()

    expect(res.status).toBe(200)
    expect(generateObjectMock).toHaveBeenCalledOnce()
    expect(getToolChunks(payload)).toEqual([])
  })

  it('does not emit a repair-request draft when equipment lookup stays ambiguous', async () => {
    streamTextMock.mockReturnValue(
      makeReadyStreamTextResult({
        steps: [
          {
            toolResults: [
              {
                toolName: 'equipmentLookup',
                output: {
                  modelSummary: {
                    summaryText: 'equipmentLookup: 2 result(s).',
                    itemCount: 2,
                  },
                  followUpContext: {
                    equipment: [
                      { thiet_bi_id: 1 },
                      { thiet_bi_id: 2 },
                    ],
                  },
                },
              },
            ],
          },
        ],
      }),
    )

    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tạo phiếu yêu cầu sửa chữa thiết bị'),
        requestedTools: [
          'equipmentLookup',
          'repairSummary',
          'generateRepairRequestDraft',
        ],
      }) as never,
    )
    const payload = await res.text()

    expect(res.status).toBe(200)
    expect(generateObjectMock).not.toHaveBeenCalled()
    expect(getToolChunks(payload)).toEqual([])
  })

  it('skips repair-request draft orchestration entirely when the request did not ask for a draft', async () => {
    streamTextMock.mockReturnValue(
      makeReadyStreamTextResult({
        steps: [
          {
            toolResults: [
              {
                toolName: 'equipmentLookup',
                output: {
                  modelSummary: {
                    summaryText: 'equipmentLookup: 1 result(s).',
                    itemCount: 1,
                  },
                  followUpContext: {
                    equipment: [{ thiet_bi_id: 42 }],
                  },
                },
              },
            ],
          },
        ],
      }),
    )

    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tra cứu thông tin thiết bị monitor CMS8000'),
        requestedTools: ['equipmentLookup'],
      }) as never,
    )
    const payload = await res.text()

    expect(res.status).toBe(200)
    expect(generateObjectMock).not.toHaveBeenCalled()
    expect(getToolChunks(payload)).toEqual([])
  })
})
