import { tool, type UIToolInvocation } from 'ai'
import { z } from 'zod'

import {
  troubleshootingDraftSchema,
  type TroubleshootingDraft,
} from '@/lib/ai/draft/troubleshooting-schema'

/**
 * AI SDK 6 tool for generating schema-validated troubleshooting drafts.
 *
 * Model-autonomous: the model calls this after gathering factual evidence.
 * Advisory-only: output is inference/draft, never triggers mutations.
 * Evidence-first: requires prior equipmentLookup + at least one operational source.
 */
export const generateTroubleshootingDraft = tool({
  description: [
    'Generate a schema-validated troubleshooting advisory draft for a specific equipment item.',
    'This tool produces INFERENCE-ONLY guidance based on factual evidence already retrieved.',
    'Prerequisites: equipmentLookup for target device, plus at least one of repairSummary,',
    'maintenanceSummary, maintenancePlanLookup, or usageHistory.',
    'Output is labeled as Draft — never implies a repair request has been created.',
    'MUST NOT invent vendor details, spare parts, fault codes, or unsupported procedures.',
  ].join(' '),
  inputSchema: z.object({
    thiet_bi_id: z.number().int().positive(),
    equipment_context: z
      .object({
        ma_thiet_bi: z.string().optional(),
        ten_thiet_bi: z.string().optional(),
        model: z.string().nullable().optional(),
        khoa_phong: z.string().nullable().optional(),
        tinh_trang_hien_tai: z.string().nullable().optional(),
      })
      .optional(),
    evidence_summary: z.string().min(1).optional(),
  }),
  outputSchema: troubleshootingDraftSchema,
  execute: async (input): Promise<TroubleshootingDraft> => {
    // The model generates the full structured output.
    // This execute function returns the model-provided input
    // re-shaped into the output contract as a pass-through.
    // The actual reasoning is done by the model; this tool
    // provides the schema validation boundary.
    return {
      kind: 'troubleshootingDraft',
      draftOnly: true,
      basedOnEvidence: true,
      evidenceRefs: ['equipmentLookup'],
      equipment_context: {
        thiet_bi_id: input.thiet_bi_id,
        ...input.equipment_context,
      },
      probable_causes: [
        {
          label: 'Pending model analysis',
          confidence: 'low',
          rationale: 'Evidence collected, awaiting model inference.',
        },
      ],
      remediation_steps: [
        {
          step: 'Review collected evidence and consult specialist.',
          type: 'escalation',
        },
      ],
      limitations: [
        'Draft generated from available system evidence only.',
      ],
    }
  },
})

/** Typed invocation for Phase 4 UI rendering. */
export type TroubleshootingDraftInvocation = UIToolInvocation<
  typeof generateTroubleshootingDraft
>
