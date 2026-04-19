import { describe, expect, it } from 'vitest'
import type { UIMessage } from 'ai'
import { routeChatIntent } from '../intent-routing'
import {
  QUERY_CATALOG,
  getQueryCatalogToolsByRoutingGroup,
} from '../tools/query-catalog'

function makeUserMessage(text: string): UIMessage {
  return {
    id: 'msg-1',
    role: 'user',
    parts: [{ type: 'text' as const, text }],
  } as UIMessage
}

function routeText(text: string, requestedTools: string[]) {
  return routeChatIntent({
    messages: [makeUserMessage(text)],
    requestedTools,
  })
}

const ALL_REPAIR_TOOLS = ['equipmentLookup', 'repairSummary']
const ALL_QUOTA_TOOLS = ['deviceQuotaLookup', 'quotaComplianceSummary']
const ALL_CHAT_TOOLS = [
  'equipmentLookup',
  'maintenanceSummary',
  'maintenancePlanLookup',
  'repairSummary',
  'usageHistory',
  'attachmentLookup',
  'deviceQuotaLookup',
  'quotaComplianceSummary',
  'query_database',
]
const FULL_PANEL_TOOLS = [
  ...ALL_CHAT_TOOLS,
  'generateTroubleshootingDraft',
  'generateRepairRequestDraft',
  'categorySuggestion',
  'departmentList',
]

describe('routeChatIntent', () => {
  describe('Issue #273 — catalog-backed curated routing metadata', () => {
    it('declares routing intent metadata for ambiguous curated tool pairs', () => {
      expect(QUERY_CATALOG.equipmentLookup.routingIntents).toEqual(
        expect.arrayContaining([
          { group: 'repair', role: 'equipment-status' },
          { group: 'equipmentLookup', role: 'specific-item' },
        ]),
      )
      expect(QUERY_CATALOG.repairSummary.routingIntents).toEqual([
        { group: 'repair', role: 'workflow-summary' },
      ])
      expect(QUERY_CATALOG.deviceQuotaLookup.routingIntents).toEqual([
        { group: 'quota', role: 'specific-item' },
      ])
      expect(QUERY_CATALOG.quotaComplianceSummary.routingIntents).toEqual([
        { group: 'quota', role: 'facility-summary' },
      ])
    })

    it('exposes query catalog tool names by routing group', () => {
      expect(getQueryCatalogToolsByRoutingGroup('repair')).toEqual([
        'equipmentLookup',
        'repairSummary',
      ])
      expect(getQueryCatalogToolsByRoutingGroup('quota')).toEqual([
        'deviceQuotaLookup',
        'quotaComplianceSummary',
      ])
    })
  })

  describe('Issue #273 — curated precedence hardening', () => {
    it('clarifies mixed repair and quota prompts instead of choosing a hard-coded family', () => {
      const result = routeText(
        'Có bao nhiêu phiếu sửa chữa và thiết bị vượt định mức trong đơn vị hiện tại?',
        [...ALL_CHAT_TOOLS],
      )

      expect(result.kind).toBe('clarify')
    })

    it('preserves explicit repair-draft starts even when quota words are present', () => {
      const result = routeText(
        'Tạo phiếu yêu cầu sửa chữa thiết bị máy thở ABC đang vượt định mức',
        [...FULL_PANEL_TOOLS],
      )

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: FULL_PANEL_TOOLS.filter(
          toolName => toolName !== 'query_database',
        ),
      })
    })

    it('keeps clear repair-summary prompts on curated routing and out of SQL fallback', () => {
      const result = routeText('Có bao nhiêu phiếu sửa chữa đang chờ xử lý?', [
        ...ALL_CHAT_TOOLS,
      ])

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ALL_CHAT_TOOLS.filter(
          toolName =>
            toolName !== 'equipmentLookup' && toolName !== 'query_database',
        ),
      })
    })

    it('keeps clear quota-summary prompts on curated routing and out of SQL fallback', () => {
      const result = routeText('Tổng quan định mức của đơn vị hiện tại thế nào?', [
        ...ALL_CHAT_TOOLS,
      ])

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ALL_CHAT_TOOLS.filter(
          toolName =>
            toolName !== 'deviceQuotaLookup' && toolName !== 'query_database',
        ),
      })
    })

    it('keeps generic non-reporting prompts on the fail-closed non-SQL path', () => {
      const result = routeText('Xin chào, bạn giúp được gì?', [...ALL_CHAT_TOOLS])

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ALL_CHAT_TOOLS.filter(
          toolName => toolName !== 'query_database',
        ),
      })
    })
  })

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

    it('does not preserve both tools for cancel phrases that overlap the draft-start phrases', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Hủy tạo phiếu sửa chữa')],
        requestedTools: [...ALL_REPAIR_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['repairSummary'],
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

  describe('Issue #272 — query_database curated-first fallback', () => {
    it('routes narrow reporting prompts to query_database when curated tools do not match', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Báo cáo tổng hợp số lượng thiết bị theo trạng thái của đơn vị hiện tại')],
        requestedTools: [...ALL_CHAT_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['query_database'],
      })
    })

    it('keeps curated lookup prompts off the SQL fallback path', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Tra cứu thông tin thiết bị monitor CMS8000')],
        requestedTools: [...ALL_CHAT_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['equipmentLookup'],
      })
    })

    it('strips query_database from repair-summary routing decisions', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Có bao nhiêu phiếu sửa chữa đang chờ xử lý?')],
        requestedTools: [...ALL_CHAT_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ALL_CHAT_TOOLS.filter(
          toolName =>
            toolName !== 'equipmentLookup' && toolName !== 'query_database',
        ),
      })
    })

    it('routes detailed reporting prompts with chi tiết to query_database when they are not specific-item lookups', () => {
      const result = routeChatIntent({
        messages: [
          makeUserMessage(
            'Báo cáo chi tiết tình trạng thiết bị theo khoa trong đơn vị hiện tại',
          ),
        ],
        requestedTools: [...ALL_CHAT_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['query_database'],
      })
    })

    it('holds query_database out of generic prompts when the request is not a reporting fallback', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Xin chào, bạn giúp được gì?')],
        requestedTools: [...ALL_CHAT_TOOLS],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ALL_CHAT_TOOLS.filter(toolName => toolName !== 'query_database'),
      })
    })

    it('keeps query_database available when it is the only explicitly requested tool', () => {
      const result = routeChatIntent({
        messages: [makeUserMessage('Xin chào')],
        requestedTools: ['query_database'],
      })

      expect(result).toEqual({
        kind: 'proceed',
        requestedTools: ['query_database'],
      })
    })
  })
})
