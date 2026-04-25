import type { LanguageModel, UIMessage } from 'ai'
import { generateObject } from 'ai'
import { z } from 'zod'

import type { DefaultChatProviderOptions } from '../provider-options'
import type { RepairRequestDraftEquipmentContext } from './repair-request-draft-evidence'
import type { RepairRequestDraftInput } from './repair-request-draft-tool'

const REQUIRED_REPAIR_REQUEST_DRAFT_FIELDS = [
  'mo_ta_su_co',
  'hang_muc_sua_chua',
] as const

const requiredFieldSchema = z.enum(REQUIRED_REPAIR_REQUEST_DRAFT_FIELDS)

export const repairRequestDraftExtractionSchema = z.object({
  mo_ta_su_co: z.string().trim().min(1).nullable(),
  hang_muc_sua_chua: z.string().trim().min(1).nullable(),
  ngay_mong_muon_hoan_thanh: z.string().trim().min(1).nullable(),
  don_vi_thuc_hien: z.enum(['noi_bo', 'thue_ngoai']).nullable(),
  ten_don_vi_thue: z.string().trim().min(1).nullable(),
  missingRequiredFields: z.array(requiredFieldSchema).default([]),
})

export type RepairRequestDraftExtractionResult = z.infer<
  typeof repairRequestDraftExtractionSchema
>

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function getMessageText(message: UIMessage): string {
  if (!Array.isArray(message.parts)) {
    return ''
  }

  return message.parts
    .map(part => {
      if (
        part &&
        typeof part === 'object' &&
        'type' in part &&
        part.type === 'text' &&
        'text' in part &&
        typeof part.text === 'string'
      ) {
        return part.text.trim()
      }

      return ''
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function buildRepairRequestDraftConversationTranscript(
  messages: UIMessage[],
): string {
  return messages
    .map(message => {
      const text = getMessageText(message)
      if (!text) {
        return null
      }

      const speaker = message.role === 'assistant' ? 'ASSISTANT' : 'USER'
      return `${speaker}: ${text}`
    })
    .filter((line): line is string => line !== null)
    .join('\n')
}

export function normalizeRepairRequestDraftExtractionResult(
  result: RepairRequestDraftExtractionResult,
): RepairRequestDraftExtractionResult {
  const moTaSuCo = normalizeOptionalString(result.mo_ta_su_co)
  const hangMucSuaChua = normalizeOptionalString(result.hang_muc_sua_chua)
  const donViThucHien = result.don_vi_thuc_hien ?? null
  const missingRequiredFields = new Set(result.missingRequiredFields)

  if (moTaSuCo === null) {
    missingRequiredFields.add('mo_ta_su_co')
  } else {
    missingRequiredFields.delete('mo_ta_su_co')
  }

  if (hangMucSuaChua === null) {
    missingRequiredFields.add('hang_muc_sua_chua')
  } else {
    missingRequiredFields.delete('hang_muc_sua_chua')
  }

  return {
    mo_ta_su_co: moTaSuCo,
    hang_muc_sua_chua: hangMucSuaChua,
    ngay_mong_muon_hoan_thanh: normalizeOptionalString(
      result.ngay_mong_muon_hoan_thanh,
    ),
    don_vi_thuc_hien: donViThucHien,
    ten_don_vi_thue:
      donViThucHien === 'thue_ngoai'
        ? normalizeOptionalString(result.ten_don_vi_thue)
        : null,
    missingRequiredFields: Array.from(missingRequiredFields),
  }
}

function buildRepairRequestDraftExtractionPrompt({
  conversationTranscript,
  equipment,
}: {
  conversationTranscript: string
  equipment: RepairRequestDraftEquipmentContext
}): string {
  const equipmentContext = [
    `- thiet_bi_id: ${equipment.thiet_bi_id}`,
    equipment.ma_thiet_bi ? `- ma_thiet_bi: ${equipment.ma_thiet_bi}` : null,
    equipment.ten_thiet_bi ? `- ten_thiet_bi: ${equipment.ten_thiet_bi}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return [
    'Trích xuất dữ liệu bản nháp yêu cầu sửa chữa từ hội thoại sau.',
    'Chỉ dùng thông tin mà người dùng nói rõ trong hội thoại.',
    'KHÔNG suy luận mo_ta_su_co hoặc hang_muc_sua_chua từ metadata thiết bị hoặc lịch sử sửa chữa.',
    'Nếu người dùng chưa cung cấp một trường bắt buộc, trả về null cho trường đó và thêm tên trường vào missingRequiredFields.',
    'Chỉ trả ten_don_vi_thue khi don_vi_thuc_hien = "thue_ngoai" và người dùng nêu rõ tên đơn vị.',
    '',
    'Thiết bị đã được route xác định:',
    equipmentContext,
    '',
    'Hội thoại:',
    conversationTranscript || '(không có nội dung hội thoại)',
  ].join('\n')
}

export async function extractRepairRequestDraftFields({
  model,
  messages,
  equipment,
  providerOptions,
}: {
  model: LanguageModel
  messages: UIMessage[]
  equipment: RepairRequestDraftEquipmentContext
  providerOptions?: DefaultChatProviderOptions
}): Promise<RepairRequestDraftExtractionResult> {
  const conversationTranscript =
    buildRepairRequestDraftConversationTranscript(messages)

  const result = await generateObject({
    model,
    schema: repairRequestDraftExtractionSchema,
    prompt: buildRepairRequestDraftExtractionPrompt({
      conversationTranscript,
      equipment,
    }),
    maxOutputTokens: 300,
    providerOptions,
  })

  return normalizeRepairRequestDraftExtractionResult(result.object)
}

export function buildRepairRequestDraftInputFromExtraction({
  extraction,
  evidenceRefs,
  equipment,
}: {
  extraction: RepairRequestDraftExtractionResult
  evidenceRefs: string[]
  equipment: RepairRequestDraftEquipmentContext
}): RepairRequestDraftInput | null {
  if (
    extraction.missingRequiredFields.includes('mo_ta_su_co') ||
    extraction.missingRequiredFields.includes('hang_muc_sua_chua') ||
    extraction.mo_ta_su_co === null ||
    extraction.hang_muc_sua_chua === null
  ) {
    return null
  }

  return {
    draftIntent: true,
    evidenceRefs,
    thiet_bi_id: equipment.thiet_bi_id,
    equipment_context: {
      ma_thiet_bi: equipment.ma_thiet_bi,
      ten_thiet_bi: equipment.ten_thiet_bi,
    },
    mo_ta_su_co: extraction.mo_ta_su_co,
    hang_muc_sua_chua: extraction.hang_muc_sua_chua,
    ngay_mong_muon_hoan_thanh: extraction.ngay_mong_muon_hoan_thanh,
    don_vi_thuc_hien: extraction.don_vi_thuc_hien,
    ten_don_vi_thue: extraction.ten_don_vi_thue,
  }
}
