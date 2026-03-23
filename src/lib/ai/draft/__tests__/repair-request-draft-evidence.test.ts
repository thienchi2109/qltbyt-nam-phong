import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'

import { collectRepairRequestDraftEvidence } from '../repair-request-draft-evidence'

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

describe('repair-request-draft evidence collection', () => {
  it('returns no equipment when equipmentLookup has no matches', () => {
    const result = collectRepairRequestDraftEvidence({
      messages: [makeAssistantToolMessage('equipmentLookup', { data: [], total: 0 })],
      steps: [],
    })

    expect(result.evidenceRefs).toEqual(['equipmentLookup'])
    expect(result.equipmentResolution).toBe('none')
    expect(result.equipment).toBeNull()
  })

  it('normalizes exactly one equipment target from accumulated tool results', () => {
    const result = collectRepairRequestDraftEvidence({
      messages: [
        makeAssistantToolMessage('equipmentLookup', {
          data: [
            {
              thiet_bi_id: 42,
              ma_thiet_bi: 'TB-042',
              ten_thiet_bi: 'Máy thở ABC',
            },
          ],
          total: 1,
        }),
      ],
      steps: [
        {
          toolResults: [
            {
              toolName: 'repairSummary',
              output: { total: 2 },
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
    const result = collectRepairRequestDraftEvidence({
      messages: [],
      steps: [
        {
          toolResults: [
            {
              toolName: 'equipmentLookup',
              output: {
                data: [
                  { thiet_bi_id: 1, ma_thiet_bi: 'TB-001', ten_thiet_bi: 'Máy A' },
                  { thiet_bi_id: 2, ma_thiet_bi: 'TB-002', ten_thiet_bi: 'Máy B' },
                ],
                total: 2,
              },
            },
          ],
        },
      ],
    })

    expect(result.equipmentResolution).toBe('multiple')
    expect(result.equipmentMatches).toHaveLength(2)
    expect(result.equipment).toBeNull()
  })
})

