import { z } from 'zod'

import {
  repairRequestDraftSchema,
  type RepairRequestDraft,
} from '@/lib/ai/draft/repair-request-draft-schema'

/**
 * Input schema for the repair request draft builder.
 *
 * This is NOT an autonomous AI SDK tool. It is an orchestration-driven
 * builder that the route/orchestrator invokes explicitly when:
 * 1. User has expressed explicit draft/create intent, AND
 * 2. Sufficient factual evidence has been collected.
 */
export const repairRequestDraftInputSchema = z.object({
  thiet_bi_id: z.number().int().positive(),
  equipment_context: z
    .object({
      ma_thiet_bi: z.string().optional(),
      ten_thiet_bi: z.string().optional(),
    })
    .optional(),
  mo_ta_su_co: z.string().min(1),
  hang_muc_sua_chua: z.string().min(1),
  ngay_mong_muon_hoan_thanh: z.string().nullable().optional(),
  don_vi_thuc_hien: z.enum(['noi_bo', 'thue_ngoai']).nullable().optional(),
  ten_don_vi_thue: z.string().nullable().optional(),
})

export type RepairRequestDraftInput = z.infer<typeof repairRequestDraftInputSchema>

/**
 * Build a schema-validated repair request draft from collected evidence.
 *
 * Orchestration-driven: called by route/orchestrator, NOT by the model.
 * Returns a validated RepairRequestDraft artifact.
 */
export function buildRepairRequestDraft(
  input: RepairRequestDraftInput,
): RepairRequestDraft {
  const draft: RepairRequestDraft = {
    kind: 'repairRequestDraft',
    draftOnly: true,
    source: 'assistant',
    confidence: 'medium',
    equipment: {
      thiet_bi_id: input.thiet_bi_id,
      ...input.equipment_context,
    },
    formData: {
      thiet_bi_id: input.thiet_bi_id,
      mo_ta_su_co: input.mo_ta_su_co,
      hang_muc_sua_chua: input.hang_muc_sua_chua,
      ngay_mong_muon_hoan_thanh: input.ngay_mong_muon_hoan_thanh ?? null,
      don_vi_thuc_hien: input.don_vi_thuc_hien ?? null,
      ten_don_vi_thue: input.ten_don_vi_thue ?? null,
    },
    missingFields: [],
    reviewNotes: [
      'Đây là bản nháp do AI trợ lý tạo. Vui lòng kiểm tra kỹ trước khi gửi.',
    ],
  }

  // Validate output against strict schema before returning
  return repairRequestDraftSchema.parse(draft)
}
