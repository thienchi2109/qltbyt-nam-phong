import { z } from 'zod'

/**
 * Zod schema for the repairRequestDraft artifact.
 *
 * Produced by the orchestration-driven draft builder (not model-autonomous).
 * Advisory-only: never triggers create/update/delete RPC.
 * Field names align with RepairRequestsCreateSheet form state and
 * the useCreateMutation payload.
 */

const repairUnitSchema = z.enum(['noi_bo', 'thue_ngoai'])

const equipmentRefSchema = z.object({
  thiet_bi_id: z.number().int().positive().optional(),
  ma_thiet_bi: z.string().optional(),
  ten_thiet_bi: z.string().optional(),
})

const formDataSchema = z.object({
  thiet_bi_id: z.number().int().positive().optional(),
  mo_ta_su_co: z.string().min(1),
  hang_muc_sua_chua: z.string().min(1),
  ngay_mong_muon_hoan_thanh: z.string().nullable().optional(),
  don_vi_thuc_hien: repairUnitSchema.nullable().optional(),
  ten_don_vi_thue: z.string().nullable().optional(),
})

export const repairRequestDraftSchema = z.object({
  kind: z.literal('repairRequestDraft'),
  draftOnly: z.literal(true),
  source: z.literal('assistant'),
  confidence: z.enum(['low', 'medium', 'high']),
  equipment: equipmentRefSchema,
  formData: formDataSchema,
  missingFields: z.array(z.string()).optional(),
  reviewNotes: z.array(z.string()).optional(),
})

export type RepairRequestDraft = z.infer<typeof repairRequestDraftSchema>

/** Payload type for context hydration (subset used by UI). */
export type RepairRequestDraftPayload = Pick<
  RepairRequestDraft,
  'equipment' | 'formData' | 'missingFields' | 'reviewNotes'
>
