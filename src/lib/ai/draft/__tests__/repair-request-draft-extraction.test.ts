import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'

import {
  buildRepairRequestDraftConversationTranscript,
  buildRepairRequestDraftInputFromExtraction,
  normalizeRepairRequestDraftExtractionResult,
} from '../repair-request-draft-extraction'

const EQUIPMENT = {
  thiet_bi_id: 42,
  ma_thiet_bi: 'TB-042',
  ten_thiet_bi: 'Máy thở ABC',
}

function makeMessage(role: 'user' | 'assistant', text: string): UIMessage {
  return {
    id: `${role}-${text}`,
    role,
    parts: [{ type: 'text', text }],
  } as UIMessage
}

describe('repair-request-draft extraction helpers', () => {
  it('builds a role-tagged transcript from conversation text parts', () => {
    const transcript = buildRepairRequestDraftConversationTranscript([
      makeMessage('user', 'Tạo phiếu sửa chữa cho máy thở ABC'),
      makeMessage('assistant', 'Anh/chị mô tả sự cố và hạng mục cần sửa.'),
      makeMessage('user', 'Máy bị mất nguồn, kiểm tra bo nguồn'),
    ])

    expect(transcript).toContain('USER: Tạo phiếu sửa chữa cho máy thở ABC')
    expect(transcript).toContain(
      'ASSISTANT: Anh/chị mô tả sự cố và hạng mục cần sửa.',
    )
  })

  it('normalizes missing required fields and clears external company unless thuê ngoài', () => {
    const normalized = normalizeRepairRequestDraftExtractionResult({
      mo_ta_su_co: null,
      hang_muc_sua_chua: '  ',
      ngay_mong_muon_hoan_thanh: null,
      don_vi_thuc_hien: 'noi_bo',
      ten_don_vi_thue: 'Công ty ABC',
      missingRequiredFields: [],
    })

    expect(normalized.missingRequiredFields).toEqual(
      expect.arrayContaining(['mo_ta_su_co', 'hang_muc_sua_chua']),
    )
    expect(normalized.ten_don_vi_thue).toBeNull()
  })

  it('assembles repair draft input when required fields are complete', () => {
    const input = buildRepairRequestDraftInputFromExtraction({
      extraction: {
        mo_ta_su_co: 'Thiết bị mất nguồn',
        hang_muc_sua_chua: 'Kiểm tra bo nguồn',
        ngay_mong_muon_hoan_thanh: '2026-04-01',
        don_vi_thuc_hien: 'thue_ngoai',
        ten_don_vi_thue: 'Công ty ABC',
        missingRequiredFields: [],
      },
      evidenceRefs: ['equipmentLookup'],
      equipment: EQUIPMENT,
    })

    expect(input).toEqual({
      draftIntent: true,
      evidenceRefs: ['equipmentLookup'],
      thiet_bi_id: 42,
      equipment_context: {
        ma_thiet_bi: 'TB-042',
        ten_thiet_bi: 'Máy thở ABC',
      },
      mo_ta_su_co: 'Thiết bị mất nguồn',
      hang_muc_sua_chua: 'Kiểm tra bo nguồn',
      ngay_mong_muon_hoan_thanh: '2026-04-01',
      don_vi_thuc_hien: 'thue_ngoai',
      ten_don_vi_thue: 'Công ty ABC',
    })
  })

  it('returns null input when required fields are still missing', () => {
    const input = buildRepairRequestDraftInputFromExtraction({
      extraction: {
        mo_ta_su_co: null,
        hang_muc_sua_chua: 'Kiểm tra bo nguồn',
        ngay_mong_muon_hoan_thanh: null,
        don_vi_thuc_hien: null,
        ten_don_vi_thue: null,
        missingRequiredFields: ['mo_ta_su_co'],
      },
      evidenceRefs: ['equipmentLookup'],
      equipment: EQUIPMENT,
    })

    expect(input).toBeNull()
  })
})

