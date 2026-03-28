import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'

import { collectRepairRequestDraftEvidence } from '../repair-request-draft-evidence'
import type { ToolResponseEnvelope } from '@/lib/ai/tools/tool-response-envelope'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelopeOutput(overrides: {
  modelSummary?: { summaryText: string; itemCount?: number }
  followUpContext?: Record<string, unknown>
}): ToolResponseEnvelope {
  return {
    modelSummary: overrides.modelSummary ?? {
      summaryText: 'completed.',
      itemCount: 0,
    },
    ...('followUpContext' in overrides && {
      followUpContext: overrides.followUpContext,
    }),
  }
}

function makeAssistantToolMessage(
  toolName: string,
  output: unknown,
): UIMessage {
  return {
    id: `assistant-${toolName}`,
    role: 'assistant',
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId: `${toolName}-1`,
        toolName,
        state: 'output-available',
        output,
      },
    ],
  } as UIMessage
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('repair-request-draft evidence collection', () => {
  it('returns no equipment when equipmentLookup followUpContext has empty equipment', () => {
    const output = makeEnvelopeOutput({
      modelSummary: { summaryText: 'equipmentLookup: 0 result(s).', itemCount: 0 },
      followUpContext: { equipment: [] },
    })

    const result = collectRepairRequestDraftEvidence({
      messages: [makeAssistantToolMessage('equipmentLookup', output)],
      steps: [],
    })

    expect(result.evidenceRefs).toEqual(['equipmentLookup'])
    expect(result.equipmentResolution).toBe('none')
    expect(result.equipment).toBeNull()
  })

  it('normalizes exactly one equipment target from accumulated tool results', () => {
    const equipmentOutput = makeEnvelopeOutput({
      modelSummary: { summaryText: 'equipmentLookup: 1 result(s).', itemCount: 1 },
      followUpContext: {
        equipment: [
          {
            thiet_bi_id: 42,
            ma_thiet_bi: 'TB-042',
            ten_thiet_bi: 'Máy thở ABC',
          },
        ],
      },
    })

    const repairOutput = makeEnvelopeOutput({
      modelSummary: { summaryText: 'repairSummary: 2 result(s).', itemCount: 2 },
      followUpContext: { evidenceRef: 'repairSummary' },
    })

    const result = collectRepairRequestDraftEvidence({
      messages: [makeAssistantToolMessage('equipmentLookup', equipmentOutput)],
      steps: [
        {
          toolResults: [
            {
              toolName: 'repairSummary',
              output: repairOutput,
            },
          ],
        },
      ],
    })

    expect(result.evidenceRefs).toEqual(
      expect.arrayContaining(['equipmentLookup', 'repairSummary']),
    )
    expect(result.equipmentResolution).toBe('single')
    expect(result.equipment).toEqual({
      thiet_bi_id: 42,
      ma_thiet_bi: 'TB-042',
      ten_thiet_bi: 'Máy thở ABC',
    })
  })

  it('marks multiple equipment candidates as ambiguous', () => {
    const output = makeEnvelopeOutput({
      modelSummary: { summaryText: 'equipmentLookup: 2 result(s).', itemCount: 2 },
      followUpContext: {
        equipment: [
          { thiet_bi_id: 1, ma_thiet_bi: 'TB-001', ten_thiet_bi: 'Máy A' },
          { thiet_bi_id: 2, ma_thiet_bi: 'TB-002', ten_thiet_bi: 'Máy B' },
        ],
      },
    })

    const result = collectRepairRequestDraftEvidence({
      messages: [],
      steps: [
        {
          toolResults: [
            {
              toolName: 'equipmentLookup',
              output,
            },
          ],
        },
      ],
    })

    expect(result.equipmentResolution).toBe('multiple')
    expect(result.equipmentMatches).toHaveLength(2)
    expect(result.equipment).toBeNull()
  })

  it('detects evidence refs via followUpContext.evidenceRef', () => {
    const output = makeEnvelopeOutput({
      followUpContext: { evidenceRef: 'maintenanceSummary' },
    })

    const result = collectRepairRequestDraftEvidence({
      messages: [],
      steps: [
        {
          toolResults: [
            { toolName: 'maintenanceSummary', output },
          ],
        },
      ],
    })

    expect(result.evidenceRefs).toContain('maintenanceSummary')
  })

  it('ignores envelope without followUpContext or data for equipment extraction', () => {
    const output = makeEnvelopeOutput({
      modelSummary: { summaryText: 'equipmentLookup: 1 result(s).' },
      // No followUpContext, no data — equipment extraction should return empty
    })

    const result = collectRepairRequestDraftEvidence({
      messages: [makeAssistantToolMessage('equipmentLookup', output)],
      steps: [],
    })

    expect(result.equipmentResolution).toBe('none')
    expect(result.equipment).toBeNull()
  })

  it('falls back to output.data for pre-deployment history messages', () => {
    // Old raw RPC format — no followUpContext, equipment in output.data
    const oldFormatOutput = {
      data: [
        { thiet_bi_id: 99, ma_thiet_bi: 'TB-099', ten_thiet_bi: 'Máy cũ' },
      ],
      total: 1,
    }

    const result = collectRepairRequestDraftEvidence({
      messages: [makeAssistantToolMessage('equipmentLookup', oldFormatOutput)],
      steps: [],
    })

    expect(result.equipmentResolution).toBe('single')
    expect(result.equipment).toEqual({
      thiet_bi_id: 99,
      ma_thiet_bi: 'TB-099',
      ten_thiet_bi: 'Máy cũ',
    })
  })
})
