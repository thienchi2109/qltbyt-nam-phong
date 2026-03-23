import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { routeChatIntent } from '../intent-routing'

function makeUserMessage(text: string): UIMessage {
  return {
    id: 'msg-1',
    role: 'user',
    parts: [{ type: 'text' as const, text }],
  } as UIMessage
}

const ALL_REPAIR_TOOLS = ['equipmentLookup', 'repairSummary']
const ALL_QUOTA_TOOLS = ['deviceQuotaLookup', 'quotaComplianceSummary']

describe('routeChatIntent', () => {
  // ──────────────────────────────────────────────────────
  // V1: repair router should NOT drop repairSummary when
  //     the question is about a device's repair history
  // ──────────────────────────────────────────────────────
  describe('V1 — device-specific repair-history keeps repairSummary', () => {
    it('keeps repairSummary when user asks about repair history of a specific device', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('thiết bị X có bao nhiêu lần sửa chữa?')],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      // "thiết bị" + "sửa chữa" without status keywords is ambiguous —
      // should NOT drop repairSummary silently. Expect clarification.
      expect(result.kind).toBe('clarify')
    })

    it('keeps repairSummary when user asks about device troubleshooting history', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('máy X sửa chữa ra sao?')],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      expect(result.kind).toBe('clarify')
    })

    it('drops repairSummary only when explicit equipment-status keywords are present', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('trạng thái sửa chữa thiết bị X')],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['equipmentLookup'],
      })
    })

    it('drops equipmentLookup when repair-request keywords are present', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('yêu cầu sửa chữa đang tồn đọng')],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['repairSummary'],
      })
    })

    it('keeps equipmentLookup available for explicit repair-draft start phrases', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Tạo phiếu yêu cầu sửa chữa thiết bị')],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: [...ALL_REPAIR_TOOLS],
      })
    })
  })

  // ──────────────────────────────────────────────────────
  // V3: hasEquipmentIdentifier must match single-separator
  //     codes like TB-001234
  // ──────────────────────────────────────────────────────
  describe('V3 — single-separator equipment codes route to specific quota', () => {
    it('routes TB-001234 to specific device quota lookup', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('kiểm tra định mức TB-001234')],
        requestedTools: [...ALL_QUOTA_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['deviceQuotaLookup'],
      })
    })

    it('routes SN-9999 to specific device quota lookup', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('định mức cho SN-9999')],
        requestedTools: [...ALL_QUOTA_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['deviceQuotaLookup'],
      })
    })

    it('still routes multi-separator codes correctly', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('định mức mã thiết bị TT.192004.JPDCTA')],
        requestedTools: [...ALL_QUOTA_TOOLS],
      })

      // "mã thiết bị" matches mentionsSpecificEquipment via keyword,
      // and TT.192004.JPDCTA matches via identifier — should route to specific
      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['deviceQuotaLookup'],
      })
    })

    it('does not treat hyphenated English terms as equipment identifiers', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('kiểm tra định mức cho thiết bị non-invasive')],
        requestedTools: [...ALL_QUOTA_TOOLS],
      })

      // "non-invasive" is an English word, not an equipment code.
      // "thiết bị" alone doesn't match mentionsSpecificEquipment keywords.
      // Should fall through to clarification, not route to deviceQuotaLookup.
      expect(result.kind).toBe('clarify')
    })

    it('finds equipment code even when preceded by a hyphenated English word', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('kiểm tra định mức high-tech TB-001234')],
        requestedTools: [...ALL_QUOTA_TOOLS],
      })

      // "high-tech" is not an equipment code, but "TB-001234" IS.
      // The function should scan all matches, not just the first.
      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['deviceQuotaLookup'],
      })
    })
  })

  // ──────────────────────────────────────────────────────
  // V2 is a refactor (dedup getLatestUserText). We verify
  // existing behavior is preserved after the import swap.
  // ──────────────────────────────────────────────────────
  describe('V2 — getLatestUserText deduplication preserves behavior', () => {
    it('extracts text from the last user message', () => {
      const messages: UIMessage[] = [
        makeUserMessage('old message'),
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text' as const, text: 'response' }],
        } as UIMessage,
        makeUserMessage('kiểm tra yêu cầu sửa chữa'),
      ]

      const result = routeChatIntent({
        messages,
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      // Should use the latest user message ("kiểm tra yêu cầu sửa chữa")
      // which mentions repair-request keywords → drop equipmentLookup
      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['repairSummary'],
      })
    })

    it('returns proceed with all tools when no user messages exist', () => {
      const result = routeChatIntent({
        messages: [],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: [...ALL_REPAIR_TOOLS],
      })
    })
  })
})
