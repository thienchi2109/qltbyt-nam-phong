import { tool, type UIToolInvocation } from 'ai'
import { z } from 'zod'

import {
  troubleshootingDraftSchema,
  type TroubleshootingDraft,
} from '@/lib/ai/draft/troubleshooting-schema'

/**
 * Approved factual tool names that count as valid evidence sources.
 * The troubleshooting draft requires at least 2 distinct sources,
 * including equipmentLookup.
 */
const VALID_EVIDENCE_SOURCES = new Set([
  'equipmentLookup',
  'repairSummary',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'usageHistory',
])

/** Minimum distinct evidence sources required (must include equipmentLookup). */
const MIN_EVIDENCE_COUNT = 2

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
    evidence_refs: z
      .array(z.string().min(1))
      .min(MIN_EVIDENCE_COUNT)
      .describe('Tool names whose output was used as evidence (e.g. equipmentLookup, repairSummary)'),
    probable_causes: z.array(
      z.object({
        label: z.string().min(1),
        confidence: z.enum(['low', 'medium', 'high']),
        rationale: z.string().min(1),
      }),
    ).min(1),
    remediation_steps: z.array(
      z.object({
        step: z.string().min(1),
        type: z.enum(['inspection', 'configuration', 'maintenance', 'escalation']),
      }),
    ).min(1),
    limitations: z.array(z.string()).optional(),
  }),
  outputSchema: troubleshootingDraftSchema,
  execute: async (input): Promise<TroubleshootingDraft> => {
    // ── Runtime evidence guard ──────────────────────────────────
    const validRefs = [...new Set(input.evidence_refs)].filter(ref =>
      VALID_EVIDENCE_SOURCES.has(ref),
    )

    if (!validRefs.includes('equipmentLookup')) {
      throw new Error(
        'Troubleshooting draft requires equipmentLookup evidence. ' +
        'Please look up the equipment first.',
      )
    }

    if (validRefs.length < MIN_EVIDENCE_COUNT) {
      throw new Error(
        `Troubleshooting draft requires at least ${MIN_EVIDENCE_COUNT} evidence sources ` +
        `(got ${validRefs.length}). Include equipmentLookup plus at least one of: ` +
        'repairSummary, maintenanceSummary, maintenancePlanLookup, usageHistory.',
      )
    }

    // ── Build validated output ──────────────────────────────────
    return {
      kind: 'troubleshootingDraft',
      draftOnly: true,
      basedOnEvidence: true,
      evidenceRefs: validRefs,
      equipment_context: {
        thiet_bi_id: input.thiet_bi_id,
        ...input.equipment_context,
      },
      probable_causes: input.probable_causes,
      remediation_steps: input.remediation_steps,
      limitations: input.limitations,
    }
  },
})

/** Typed invocation for Phase 4 UI rendering. */
export type TroubleshootingDraftInvocation = UIToolInvocation<
  typeof generateTroubleshootingDraft
>
