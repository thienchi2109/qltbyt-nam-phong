import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'

import { compactUIMessages } from '../compact-ui-messages'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEnvelopeOutput(extra?: Record<string, unknown>) {
  return {
    modelSummary: {
      summaryText: 'equipmentLookup: 1 result(s).',
      itemCount: 1,
    },
    followUpContext: {
      equipment: [{ thiet_bi_id: 42, ten_thiet_bi: 'May tho ABC' }],
    },
    uiArtifact: {
      rawPayload: {
        data: [
          {
            thiet_bi_id: 42,
            ten_thiet_bi: 'May tho ABC',
            ma_thiet_bi: 'TB-042',
            xuong: 'Khoa HSTC',
            trang_thai: 'active',
            extra_field_1: 'a'.repeat(500),
          },
        ],
        total: 1,
      },
    },
    ...extra,
  }
}

function makeUserMessage(id: string, text = 'Xin chao'): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

function makeAssistantTextMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text }],
  }
}

function makeAssistantToolMessage(
  id: string,
  toolName: string,
  output: unknown,
): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId: `tc-${id}`,
        toolName,
        state: 'output-available',
        output,
      } as never,
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compactUIMessages', () => {
  it('compacts envelope-wrapped tool outputs (strips uiArtifact)', () => {
    const messages: UIMessage[] = [
      makeUserMessage('u1', 'Tra cuu thiet bi'),
      makeAssistantToolMessage('a1', 'equipmentLookup', makeEnvelopeOutput()),
    ]

    const result = compactUIMessages(messages)

    // User message unchanged
    expect(result[0]).toBe(messages[0])

    // Assistant tool output compacted — uiArtifact stripped
    const toolPart = result[1].parts[0] as Record<string, unknown>
    expect(toolPart.output).toEqual({
      modelSummary: {
        summaryText: 'equipmentLookup: 1 result(s).',
        itemCount: 1,
      },
      followUpContext: {
        equipment: [{ thiet_bi_id: 42, ten_thiet_bi: 'May tho ABC' }],
      },
    })
    expect(toolPart.output).not.toHaveProperty('uiArtifact')
  })

  it('passes through draft-tool outputs unchanged', () => {
    const draftOutput = {
      kind: 'troubleshootingDraft',
      draftOnly: true,
      source: 'assistant',
    }
    const messages: UIMessage[] = [
      makeAssistantToolMessage('a1', 'generateTroubleshootingDraft', draftOutput),
    ]

    const result = compactUIMessages(messages)
    const toolPart = result[0].parts[0] as Record<string, unknown>

    expect(toolPart.output).toBe(draftOutput) // same reference
  })

  it('passes through repair request draft outputs unchanged', () => {
    const draftOutput = {
      kind: 'repairRequestDraft',
      draftOnly: true,
      source: 'assistant',
      equipment: { thiet_bi_id: 42 },
      formData: { thiet_bi_id: 42, mo_ta_su_co: 'Mat nguon' },
    }
    const messages: UIMessage[] = [
      makeAssistantToolMessage('a1', 'generateRepairRequestDraft', draftOutput),
    ]

    const result = compactUIMessages(messages)
    const toolPart = result[0].parts[0] as Record<string, unknown>

    expect(toolPart.output).toBe(draftOutput) // same reference
  })

  it('passes through non-envelope (un-migrated) tool outputs unchanged', () => {
    const rawOutput = { data: [{ id: 1, name: 'test' }], total: 1 }
    const messages: UIMessage[] = [
      makeAssistantToolMessage('a1', 'maintenancePlanLookup', rawOutput),
    ]

    const result = compactUIMessages(messages)
    const toolPart = result[0].parts[0] as Record<string, unknown>

    expect(toolPart.output).toBe(rawOutput) // same reference — not an envelope
  })

  it('passes through user and system messages unchanged', () => {
    const messages: UIMessage[] = [
      makeUserMessage('u1', 'Hello'),
      { id: 'sys1', role: 'system', parts: [{ type: 'text', text: 'Sys prompt' }] },
    ]

    const result = compactUIMessages(messages)

    expect(result[0]).toBe(messages[0])
    expect(result[1]).toBe(messages[1])
  })

  it('handles an empty messages array', () => {
    expect(compactUIMessages([])).toEqual([])
  })

  it('does not mutate the original messages array', () => {
    const original: UIMessage[] = [
      makeUserMessage('u1', 'Xin chao'),
      makeAssistantToolMessage('a1', 'equipmentLookup', makeEnvelopeOutput()),
    ]
    const originalOutput = (original[1].parts[0] as Record<string, unknown>).output

    compactUIMessages(original)

    // Original still has uiArtifact
    const afterOutput = (original[1].parts[0] as Record<string, unknown>).output
    expect(afterOutput).toBe(originalOutput)
    expect(afterOutput).toHaveProperty('uiArtifact')
  })

  it('passes through tool parts not in output-available state', () => {
    const msg: UIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-equipmentLookup',
          toolCallId: 'tc-1',
          toolName: 'equipmentLookup',
          state: 'input-available',
          input: { search: 'may tho' },
        } as never,
      ],
    }

    const result = compactUIMessages([msg])
    expect(result[0].parts[0]).toBe(msg.parts[0]) // same reference
  })

  it('passes through assistant text-only messages without scanning parts', () => {
    const msg = makeAssistantTextMessage('a1', 'This is just text')

    const result = compactUIMessages([msg])

    // No tool parts → should return original message reference
    expect(result[0]).toBe(msg)
  })
})
