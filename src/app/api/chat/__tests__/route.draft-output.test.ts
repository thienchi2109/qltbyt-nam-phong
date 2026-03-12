import { describe, expect, it } from 'vitest'

import {
  repairRequestDraftSchema,
  type RepairRequestDraft,
} from '@/lib/ai/draft/repair-request-draft-schema'

import {
  DRAFT_TOOL_DEFINITIONS_FOR_TEST,
  READ_ONLY_TOOL_DEFINITIONS_FOR_TEST,
  buildToolRegistry,
  validateRequestedTools,
} from '@/lib/ai/tools/registry'
import {
  buildRepairRequestDraft,
  repairRequestDraftInputSchema,
} from '@/lib/ai/draft/repair-request-draft-tool'
import { SYSTEM_PROMPT_VERSION, buildSystemPrompt } from '@/lib/ai/prompts/system'

// ============================================
// 1. Schema contract tests
// ============================================

describe('repairRequestDraft schema contract', () => {
  const VALID_DRAFT: RepairRequestDraft = {
    kind: 'repairRequestDraft',
    draftOnly: true,
    source: 'assistant',
    confidence: 'medium',
    equipment: {
      thiet_bi_id: 42,
      ma_thiet_bi: 'TB-042',
      ten_thiet_bi: 'Máy thở ABC',
    },
    formData: {
      thiet_bi_id: 42,
      mo_ta_su_co: 'Thiết bị phát tiếng ồn bất thường khi hoạt động.',
      hang_muc_sua_chua: 'Kiểm tra và sửa chữa hệ thống quạt làm mát.',
      ngay_mong_muon_hoan_thanh: '2026-04-01',
      don_vi_thuc_hien: 'noi_bo',
      ten_don_vi_thue: null,
    },
    missingFields: ['serial'],
    reviewNotes: ['Xác nhận hạng mục sửa chữa trước khi gửi.'],
  }

  it('accepts a valid repairRequestDraft', () => {
    const result = repairRequestDraftSchema.safeParse(VALID_DRAFT)
    expect(result.success).toBe(true)
  })

  it('enforces kind = repairRequestDraft literal', () => {
    const invalid = { ...VALID_DRAFT, kind: 'troubleshootingDraft' }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('enforces draftOnly = true literal', () => {
    const invalid = { ...VALID_DRAFT, draftOnly: false }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('enforces source = assistant literal', () => {
    const invalid = { ...VALID_DRAFT, source: 'user' }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates confidence enum', () => {
    const invalid = { ...VALID_DRAFT, confidence: 'very-high' }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('requires mo_ta_su_co in formData', () => {
    const invalid = {
      ...VALID_DRAFT,
      formData: { ...VALID_DRAFT.formData, mo_ta_su_co: '' },
    }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('requires hang_muc_sua_chua in formData', () => {
    const invalid = {
      ...VALID_DRAFT,
      formData: { ...VALID_DRAFT.formData, hang_muc_sua_chua: '' },
    }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('validates don_vi_thuc_hien enum', () => {
    const invalid = {
      ...VALID_DRAFT,
      formData: { ...VALID_DRAFT.formData, don_vi_thuc_hien: 'unknown_unit' },
    }
    const result = repairRequestDraftSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('allows optional equipment fields', () => {
    const minimal = {
      ...VALID_DRAFT,
      equipment: {},
    }
    const result = repairRequestDraftSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('allows null/optional form fields', () => {
    const minimal = {
      ...VALID_DRAFT,
      formData: {
        mo_ta_su_co: 'Sự cố',
        hang_muc_sua_chua: 'Sửa chữa',
      },
    }
    const result = repairRequestDraftSchema.safeParse(minimal)
    expect(result.success).toBe(true)
  })

  it('allows omitting missingFields and reviewNotes', () => {
    const { missingFields: _m, reviewNotes: _r, ...withoutOptionals } = VALID_DRAFT
    const result = repairRequestDraftSchema.safeParse(withoutOptionals)
    expect(result.success).toBe(true)
  })

  it('is distinguishable from troubleshootingDraft by kind', () => {
    const result = repairRequestDraftSchema.safeParse(VALID_DRAFT)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.kind).toBe('repairRequestDraft')
      expect(result.data.kind).not.toBe('troubleshootingDraft')
    }
  })
})

// ============================================
// 2. Generation guard tests
// ============================================

describe('repairRequestDraft generation guard', () => {
  it('draft definition is orchestration-driven (not model-autonomous)', () => {
    const def = DRAFT_TOOL_DEFINITIONS_FOR_TEST['generateRepairRequestDraft']
    expect(def).toBeDefined()
    expect(def.draftKind).toBe('repairRequestDraft')
    // Orchestration-driven: tool is null (route invokes builder directly)
    expect(def.tool).toBeNull()
  })

  it('draft definition requires evidence', () => {
    const def = DRAFT_TOOL_DEFINITIONS_FOR_TEST['generateRepairRequestDraft']
    expect(def.requiresEvidence).toBe(true)
    expect(def.minEvidenceCount).toBeGreaterThanOrEqual(1)
  })

  it('builder produces a valid draft from minimal input', () => {
    const result = buildRepairRequestDraft({
      draftIntent: true,
      evidenceRefs: ['equipmentLookup'],
      thiet_bi_id: 42,
      mo_ta_su_co: 'Thiết bị không hoạt động',
      hang_muc_sua_chua: 'Kiểm tra nguồn điện',
    })

    expect(result.kind).toBe('repairRequestDraft')
    expect(result.draftOnly).toBe(true)
    expect(result.source).toBe('assistant')
    expect(result.formData.thiet_bi_id).toBe(42)
  })

  it('builder leaves optional fields unset when not provided', () => {
    const result = buildRepairRequestDraft({
      draftIntent: true,
      evidenceRefs: ['equipmentLookup'],
      thiet_bi_id: 1,
      mo_ta_su_co: 'Test',
      hang_muc_sua_chua: 'Test',
    })

    expect(result.formData.ngay_mong_muon_hoan_thanh).toBeNull()
    expect(result.formData.don_vi_thuc_hien).toBeNull()
    expect(result.formData.ten_don_vi_thue).toBeNull()
  })

  it('input schema rejects when draftIntent is false', () => {
    const result = repairRequestDraftInputSchema.safeParse({
      draftIntent: false,
      evidenceRefs: ['equipmentLookup'],
      thiet_bi_id: 1,
      mo_ta_su_co: 'x',
      hang_muc_sua_chua: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('input schema rejects when draftIntent is missing', () => {
    const result = repairRequestDraftInputSchema.safeParse({
      evidenceRefs: ['equipmentLookup'],
      thiet_bi_id: 1,
      mo_ta_su_co: 'x',
      hang_muc_sua_chua: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when evidenceRefs is empty', () => {
    const result = repairRequestDraftInputSchema.safeParse({
      draftIntent: true,
      evidenceRefs: [],
      thiet_bi_id: 1,
      mo_ta_su_co: 'x',
      hang_muc_sua_chua: 'y',
    })
    expect(result.success).toBe(false)
  })

  it('builder rejects when equipmentLookup is missing from evidenceRefs', () => {
    expect(() =>
      buildRepairRequestDraft({
        draftIntent: true,
        evidenceRefs: ['repairSummary'],
        thiet_bi_id: 1,
        mo_ta_su_co: 'x',
        hang_muc_sua_chua: 'y',
      }),
    ).toThrow('equipmentLookup')
  })

  it('system prompt requires explicit user intent for repair drafts', () => {
    const prompt = buildSystemPrompt({
      role: 'admin',
      userId: 'u1',
      selectedFacilityId: 2,
    })

    expect(prompt).toContain('Bản nháp yêu cầu sửa chữa')
    expect(prompt).toContain('ý định')
    expect(prompt).toContain('equipmentLookup')
  })
})

// ============================================
// 3. Safety / regression tests
// ============================================

describe('repairRequestDraft safety', () => {
  it('draft is NOT in READ_ONLY_TOOL_DEFINITIONS', () => {
    expect(READ_ONLY_TOOL_DEFINITIONS_FOR_TEST).not.toHaveProperty(
      'generateRepairRequestDraft',
    )
  })

  it('draft IS in DRAFT_TOOL_DEFINITIONS', () => {
    expect(DRAFT_TOOL_DEFINITIONS_FOR_TEST).toHaveProperty(
      'generateRepairRequestDraft',
    )
  })

  it('builder output is schema-valid', () => {
    const result = buildRepairRequestDraft({
      draftIntent: true,
      evidenceRefs: ['equipmentLookup'],
      thiet_bi_id: 10,
      equipment_context: { ma_thiet_bi: 'TB-010', ten_thiet_bi: 'Máy X' },
      mo_ta_su_co: 'Sự cố',
      hang_muc_sua_chua: 'Sửa chữa',
      don_vi_thuc_hien: 'thue_ngoai',
      ten_don_vi_thue: 'Công ty ABC',
    })

    const parsed = repairRequestDraftSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('validateRequestedTools accepts draft tool names', () => {
    const result = validateRequestedTools(['generateRepairRequestDraft'])
    expect(result.ok).toBe(true)
  })

  it('buildToolRegistry excludes orchestration-only draft tools from the runtime ToolSet', () => {
    const registry = buildToolRegistry({
      request: new Request('http://localhost/api/chat', { method: 'POST' }),
      tenantId: 2,
      userId: 'u1',
      requestedTools: ['generateRepairRequestDraft'],
    })

    expect(registry).not.toHaveProperty('generateRepairRequestDraft')
  })

  it('buildToolRegistry still includes callable draft tools', () => {
    const registry = buildToolRegistry({
      request: new Request('http://localhost/api/chat', { method: 'POST' }),
      tenantId: 2,
      userId: 'u1',
      requestedTools: ['generateTroubleshootingDraft'],
    })

    expect(registry).toHaveProperty('generateTroubleshootingDraft')
  })

  it('system prompt version is v2.2.0', () => {
    expect(SYSTEM_PROMPT_VERSION).toBe('v2.2.0')
  })

  it('prompt prevents auto-submission of repair requests', () => {
    const prompt = buildSystemPrompt({
      role: 'admin',
      userId: 'u1',
      selectedFacilityId: 2,
    })

    expect(prompt).toContain('KHÔNG BAO GIỜ tự gửi yêu cầu sửa chữa')
  })
})
