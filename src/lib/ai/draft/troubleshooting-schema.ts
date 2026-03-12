import { z } from 'zod'

/**
 * Zod schema for the troubleshootingDraft artifact.
 *
 * Returned by the AI diagnostic draft path. Advisory-only output:
 * - Never triggers navigation, mutation, or repair-request creation.
 * - Must be labeled as Draft/Inference, never Fact.
 * - Requires prior factual evidence from approved read-only tools.
 */

const confidenceLevel = z.enum(['low', 'medium', 'high'])

const probableCauseSchema = z.object({
  label: z.string().min(1),
  confidence: confidenceLevel,
  rationale: z.string().min(1),
})

const remediationStepType = z.enum([
  'inspection',
  'configuration',
  'maintenance',
  'escalation',
])

const remediationStepSchema = z.object({
  step: z.string().min(1),
  type: remediationStepType,
})

const equipmentContextSchema = z.object({
  thiet_bi_id: z.number().int().positive().optional(),
  ma_thiet_bi: z.string().optional(),
  ten_thiet_bi: z.string().optional(),
  model: z.string().nullable().optional(),
  khoa_phong: z.string().nullable().optional(),
  tinh_trang_hien_tai: z.string().nullable().optional(),
})

export const troubleshootingDraftSchema = z.object({
  kind: z.literal('troubleshootingDraft'),
  draftOnly: z.literal(true),
  basedOnEvidence: z.literal(true),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  equipment_context: equipmentContextSchema,
  probable_causes: z.array(probableCauseSchema).min(1),
  remediation_steps: z.array(remediationStepSchema).min(1),
  limitations: z.array(z.string()).optional(),
})

export type TroubleshootingDraft = z.infer<typeof troubleshootingDraftSchema>
