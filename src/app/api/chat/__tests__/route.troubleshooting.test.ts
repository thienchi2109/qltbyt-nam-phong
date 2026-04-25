import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  troubleshootingDraftSchema,
  type TroubleshootingDraft,
} from '@/lib/ai/draft/troubleshooting-schema'

import {
  DRAFT_TOOL_DEFINITIONS_FOR_TEST,
  READ_ONLY_TOOL_DEFINITIONS_FOR_TEST,
  validateRequestedTools,
} from '@/lib/ai/tools/registry'
import { generateTroubleshootingDraft } from '@/lib/ai/draft/troubleshooting-tool'
import { SYSTEM_PROMPT_VERSION, buildSystemPrompt } from '@/lib/ai/prompts/system'

// ============================================
// 1. Schema contract tests
// ============================================

describe('troubleshootingDraft schema contract', () => {
  const VALID_DRAFT: TroubleshootingDraft = {
    kind: 'troubleshootingDraft',
    draftOnly: true,
    basedOnEvidence: true,
    evidenceRefs: ['equipmentLookup', 'repairSummary'],
    equipment_context: {
      thiet_bi_id: 42,
      ma_thiet_bi: 'TB-042',
      ten_thiet_bi: 'Máy thở ABC',
      model: 'ABC-3000',
      khoa_phong: 'Khoa Hồi sức',
      tinh_trang_hien_tai: 'dang_su_dung',
    },
    probable_causes: [
      {
        label: 'Bộ lọc khí bị tắc',
        confidence: 'medium',
        rationale: 'Lịch sử sửa chữa ghi nhận thay bộ lọc 2 lần trong 6 tháng.',
      },
    ],
    remediation_steps: [
      { step: 'Kiểm tra và thay bộ lọc khí', type: 'maintenance' },
      { step: 'Liên hệ hãng sản xuất nếu vấn đề tái phát', type: 'escalation' },
    ],
    limitations: ['Không có dữ liệu nhật ký sử dụng gần đây.'],
  }

  it('accepts a valid troubleshootingDraft', () => {
    const result = troubleshootingDraftSchema.safeParse(VALID_DRAFT)
    expect(result.success).toBe(true)
  })

  it('enforces kind = troubleshootingDraft literal', () => {
    const invalid = { ...VALID_DRAFT, kind: 'repairRequestDraft' }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('enforces draftOnly = true literal', () => {
    const invalid = { ...VALID_DRAFT, draftOnly: false }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('enforces basedOnEvidence = true literal', () => {
    const invalid = { ...VALID_DRAFT, basedOnEvidence: false }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('requires at least one evidenceRef', () => {
    const invalid = { ...VALID_DRAFT, evidenceRefs: [] }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('requires at least one probable cause', () => {
    const invalid = { ...VALID_DRAFT, probable_causes: [] }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('requires at least one remediation step', () => {
    const invalid = { ...VALID_DRAFT, remediation_steps: [] }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates confidence level enum', () => {
    const invalid = {
      ...VALID_DRAFT,
      probable_causes: [
        { label: 'Test', confidence: 'very-high', rationale: 'test' },
      ],
    }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates remediation step type enum', () => {
    const invalid = {
      ...VALID_DRAFT,
      remediation_steps: [{ step: 'Test', type: 'replacement' }],
    }
    const result = troubleshootingDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('allows optional equipment_context fields', () => {
    const minimal = {
      ...VALID_DRAFT,
      equipment_context: { thiet_bi_id: 1 },
    }
    const result = troubleshootingDraftSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('allows omitting limitations', () => {
    const { limitations: _, ...withoutLimitations } = VALID_DRAFT
    const result = troubleshootingDraftSchema.safeParse(withoutLimitations)
    expect(result.success).toBe(true)
  })
})

// ============================================
// 2. Evidence guard tests (runtime enforcement)
// ============================================

const VALID_TOOL_INPUT = {
  thiet_bi_id: 42,
  equipment_context: { ten_thiet_bi: 'Máy thở ABC' },
  evidence_refs: ['equipmentLookup', 'repairSummary'],
  probable_causes: [{ label: 'Test', confidence: 'low' as const, rationale: 'r' }],
  remediation_steps: [{ step: 'Check', type: 'inspection' as const }],
}

describe('troubleshooting draft evidence guard', () => {
  it('draft definition requires evidence', () => {
    const def = DRAFT_TOOL_DEFINITIONS_FOR_TEST['generateTroubleshootingDraft']
    expect(def).toBeDefined()
    expect(def.requiresEvidence).toBe(true)
    expect(def.minEvidenceCount).toBeGreaterThanOrEqual(2)
  })

  it('draft definition has correct draftKind', () => {
    const def = DRAFT_TOOL_DEFINITIONS_FOR_TEST['generateTroubleshootingDraft']
    expect(def.draftKind).toBe('troubleshootingDraft')
  })

  it('rejects when equipmentLookup is missing from evidence_refs', async () => {
    await expect(
      generateTroubleshootingDraft.execute!(
        { ...VALID_TOOL_INPUT, evidence_refs: ['repairSummary', 'usageHistory'] },
        { toolCallId: 't1', messages: [], abortSignal: undefined as never },
      ),
    ).rejects.toThrow('equipmentLookup')
  })

  it('rejects when fewer than 2 evidence sources', async () => {
    await expect(
      generateTroubleshootingDraft.execute!(
        { ...VALID_TOOL_INPUT, evidence_refs: ['equipmentLookup'] },
        { toolCallId: 't1', messages: [], abortSignal: undefined as never },
      ),
    ).rejects.toThrow('at least 2')
  })

  it('rejects duplicated sources that appear to meet minimum count', async () => {
    await expect(
      generateTroubleshootingDraft.execute!(
        { ...VALID_TOOL_INPUT, evidence_refs: ['equipmentLookup', 'equipmentLookup'] },
        { toolCallId: 't1', messages: [], abortSignal: undefined as never },
      ),
    ).rejects.toThrow('at least 2')
  })

  it('succeeds with valid evidence (equipmentLookup + operational source)', async () => {
    const result = await generateTroubleshootingDraft.execute!(
      VALID_TOOL_INPUT,
      { toolCallId: 't1', messages: [], abortSignal: undefined as never },
    )
    expect(result.kind).toBe('troubleshootingDraft')
    expect(result.evidenceRefs).toEqual(['equipmentLookup', 'repairSummary'])
    expect(result.draftOnly).toBe(true)
  })

  it('filters unknown evidence sources from evidenceRefs', async () => {
    const result = await generateTroubleshootingDraft.execute!(
      { ...VALID_TOOL_INPUT, evidence_refs: ['equipmentLookup', 'repairSummary', 'unknownTool'] },
      { toolCallId: 't1', messages: [], abortSignal: undefined as never },
    )
    expect(result.evidenceRefs).toEqual(['equipmentLookup', 'repairSummary'])
    expect(result.evidenceRefs).not.toContain('unknownTool')
  })

  it('system prompt requires evidence gathering before troubleshooting', () => {
    const prompt = buildSystemPrompt({
      role: 'admin',
      userId: 'u1',
      selectedFacilityId: 2,
    })

    expect(prompt).toContain('equipmentLookup')
    expect(prompt).toContain('generateTroubleshootingDraft')
    expect(prompt).toContain('ít nhất')
  })
})

// ============================================
// 3. Safety / regression tests
// ============================================

describe('troubleshooting draft safety', () => {
  it('draft tool is NOT in READ_ONLY_TOOL_DEFINITIONS', () => {
    expect(READ_ONLY_TOOL_DEFINITIONS_FOR_TEST).not.toHaveProperty(
      'generateTroubleshootingDraft',
    )
  })

  it('draft tool IS in DRAFT_TOOL_DEFINITIONS', () => {
    expect(DRAFT_TOOL_DEFINITIONS_FOR_TEST).toHaveProperty(
      'generateTroubleshootingDraft',
    )
  })

  it('validateRequestedTools accepts draft tool names', () => {
    const result = validateRequestedTools(['generateTroubleshootingDraft'])
    expect(result.ok).toBe(true)
  })

  it('draft output is distinguishable from factual RPC tool results', () => {
    const result = troubleshootingDraftSchema.safeParse({
      kind: 'troubleshootingDraft',
      draftOnly: true,
      basedOnEvidence: true,
      evidenceRefs: ['equipmentLookup', 'repairSummary'],
      equipment_context: { thiet_bi_id: 1 },
      probable_causes: [{ label: 'x', confidence: 'low', rationale: 'y' }],
      remediation_steps: [{ step: 'z', type: 'inspection' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kind).toBe('troubleshootingDraft')
      expect(result.data.draftOnly).toBe(true)
      expect(result.data.basedOnEvidence).toBe(true)
    }
  })

  it('system prompt version is v2.5.1', () => {
    expect(SYSTEM_PROMPT_VERSION).toBe('v2.5.1')
  })

  it('prompt labels troubleshooting output as Draft/Inference, never Fact', () => {
    const prompt = buildSystemPrompt({
      role: 'admin',
      userId: 'u1',
      selectedFacilityId: 2,
    })

    expect(prompt).toContain('📝 Bản nháp (Draft)')
    expect(prompt).toContain('💡 Nhận định (Inference)')
    expect(prompt).toContain('📋 Dữ liệu (Fact)')
  })
})
