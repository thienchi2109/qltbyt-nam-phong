import type { UIMessage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generateObjectMock = vi.fn()

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    generateObject: (...args: unknown[]) => generateObjectMock(...args),
  }
})

import { maybeBuildRepairRequestDraftArtifact } from '../repair-request-draft-orchestrator'

const MODEL = 'google:gemini-2.5-flash' as never

function makeUserMessage(text: string): UIMessage {
  return {
    id: text,
    role: 'user',
    parts: [{ type: 'text', text }],
  } as UIMessage
}

describe('repair-request-draft orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a repair draft artifact when session, evidence, and extraction are complete', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        mo_ta_su_co: 'Thiết bị mất nguồn',
        hang_muc_sua_chua: 'Kiểm tra bo nguồn',
        ngay_mong_muon_hoan_thanh: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        missingRequiredFields: [],
      },
    })

    const result = await maybeBuildRepairRequestDraftArtifact({
      model: MODEL,
      messages: [makeUserMessage('Tạo phiếu yêu cầu sửa chữa thiết bị')],
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
                      ten_thiet_bi: 'Máy thở ABC',
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    })

    expect(result?.toolCallId).toBe('generateRepairRequestDraft-42')
    expect(result?.output.kind).toBe('repairRequestDraft')
    expect(result?.input.thiet_bi_id).toBe(42)
  })

  it('returns null when equipment resolution is ambiguous', async () => {
    const result = await maybeBuildRepairRequestDraftArtifact({
      model: MODEL,
      messages: [makeUserMessage('Tạo phiếu sửa chữa')],
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
    })

    expect(result).toBeNull()
    expect(generateObjectMock).not.toHaveBeenCalled()
  })

  it('returns null when extraction still reports missing required fields', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        mo_ta_su_co: null,
        hang_muc_sua_chua: 'Kiểm tra bo nguồn',
        ngay_mong_muon_hoan_thanh: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        missingRequiredFields: ['mo_ta_su_co'],
      },
    })

    const result = await maybeBuildRepairRequestDraftArtifact({
      model: MODEL,
      messages: [makeUserMessage('Tạo phiếu sửa chữa cho máy thở ABC')],
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
    })

    expect(result).toBeNull()
  })
})

