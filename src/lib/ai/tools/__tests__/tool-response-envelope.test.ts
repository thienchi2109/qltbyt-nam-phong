import { describe, expect, it } from 'vitest'

import {
  compactToolOutput,
  DRAFT_TOOL_NAMES_SET,
  isToolResponseEnvelope,
  type ToolResponseEnvelope,
} from '../tool-response-envelope'

function makeEnvelope(overrides?: Partial<ToolResponseEnvelope>): ToolResponseEnvelope {
  return {
    modelSummary: {
      summaryText: 'Found 3 items.',
      itemCount: 3,
    },
    ...overrides,
  }
}

describe('tool-response-envelope', () => {
  // ── isToolResponseEnvelope ───────────────────────────────────────────

  describe('isToolResponseEnvelope', () => {
    it('returns true for a valid envelope with modelSummary', () => {
      expect(isToolResponseEnvelope(makeEnvelope())).toBe(true)
    })

    it('returns true for an envelope with followUpContext', () => {
      const envelope = makeEnvelope({
        followUpContext: { evidenceRef: 'repairSummary' },
      })
      expect(isToolResponseEnvelope(envelope)).toBe(true)
    })

    it('returns true for an envelope with uiArtifact', () => {
      const envelope = makeEnvelope({
        uiArtifact: { artifactId: 'a1', kind: 'categoryList' },
      })
      expect(isToolResponseEnvelope(envelope)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isToolResponseEnvelope(null)).toBe(false)
    })

    it('returns false for an array', () => {
      expect(isToolResponseEnvelope([1, 2, 3])).toBe(false)
    })

    it('returns false for a raw RPC payload (no modelSummary)', () => {
      expect(isToolResponseEnvelope({ data: [], total: 0 })).toBe(false)
    })

    it('returns false when modelSummary lacks summaryText', () => {
      expect(
        isToolResponseEnvelope({ modelSummary: { itemCount: 3 } }),
      ).toBe(false)
    })
  })

  // ── compactToolOutput ────────────────────────────────────────────────

  describe('compactToolOutput', () => {
    it('strips uiArtifact from an envelope output', () => {
      const envelope = makeEnvelope({
        followUpContext: { evidenceRef: 'repairSummary' },
        uiArtifact: { artifactId: 'a1', kind: 'categoryList' },
      })

      const compacted = compactToolOutput('equipmentLookup', envelope)

      expect(compacted).toEqual({
        modelSummary: envelope.modelSummary,
        followUpContext: { evidenceRef: 'repairSummary' },
      })
      expect(compacted).not.toHaveProperty('uiArtifact')
    })

    it('preserves followUpContext when present', () => {
      const envelope = makeEnvelope({
        followUpContext: {
          equipment: [{ thiet_bi_id: 42, ma_thiet_bi: 'TB-042' }],
        },
      })

      const compacted = compactToolOutput('equipmentLookup', envelope) as Record<string, unknown>

      expect(compacted.followUpContext).toEqual({
        equipment: [{ thiet_bi_id: 42, ma_thiet_bi: 'TB-042' }],
      })
    })

    it('omits followUpContext key when not present in envelope', () => {
      const envelope = makeEnvelope()
      const compacted = compactToolOutput('equipmentLookup', envelope)

      expect(compacted).not.toHaveProperty('followUpContext')
    })

    it('passes through draft tool outputs unchanged', () => {
      const draftOutput = { kind: 'troubleshootingDraft', data: { foo: 'bar' } }

      for (const draftTool of DRAFT_TOOL_NAMES_SET) {
        const result = compactToolOutput(draftTool, draftOutput)
        expect(result).toBe(draftOutput) // strict identity
      }
    })

    it('passes through non-envelope (raw/pending) outputs unchanged', () => {
      const rawOutput = { data: [{ thiet_bi_id: 1 }], total: 1 }
      const result = compactToolOutput('equipmentLookup', rawOutput)

      expect(result).toBe(rawOutput) // strict identity
    })

    it('passes through primitive outputs unchanged', () => {
      expect(compactToolOutput('someTool', 'hello')).toBe('hello')
      expect(compactToolOutput('someTool', null)).toBeNull()
      expect(compactToolOutput('someTool', 42)).toBe(42)
    })
  })

  // ── DRAFT_TOOL_NAMES_SET ─────────────────────────────────────────────

  describe('DRAFT_TOOL_NAMES_SET', () => {
    it('contains exactly the expected draft tools', () => {
      expect(DRAFT_TOOL_NAMES_SET).toEqual(
        new Set(['generateTroubleshootingDraft', 'generateRepairRequestDraft']),
      )
    })
  })
})
