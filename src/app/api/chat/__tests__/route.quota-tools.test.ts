import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const checkUsageLimitsMock = vi.fn()
const recordUsageMock = vi.fn()
const confirmUsageMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/provider', () => ({
  getChatModel: (...args: unknown[]) => getChatModelMock(...args),
}))

vi.mock('@/lib/ai/prompts/system', () => ({
  buildSystemPrompt: (...args: unknown[]) => buildSystemPromptMock(...args),
}))

vi.mock('@/lib/ai/usage-metering', () => ({
  checkUsageLimits: (...args: unknown[]) => checkUsageLimitsMock(...args),
  recordUsage: (...args: unknown[]) => recordUsageMock(...args),
  confirmUsage: (...args: unknown[]) => confirmUsageMock(...args),
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    streamText: (...args: unknown[]) => streamTextMock(...args),
    stepCountIs: (...args: unknown[]) => stepCountIsMock(...args),
  }
})

import { POST } from '../route'

const VALID_MESSAGES = [
  {
    id: 'msg_1',
    role: 'user',
    parts: [{ type: 'text', text: 'Thiết bị này có trong định mức không?' }],
  },
]

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/chat quota tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue('google:gemini-3-flash-preview')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V2')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
    })
  })

  it('accepts deviceQuotaLookup when explicitly requested', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['deviceQuotaLookup'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs?.tools).toHaveProperty('deviceQuotaLookup')
  })

  it('accepts quotaComplianceSummary when explicitly requested', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['quotaComplianceSummary'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs?.tools).toHaveProperty('quotaComplianceSummary')
  })

  it('blocks deviceQuotaLookup without facility for privileged role', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['deviceQuotaLookup'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe(
      'Please select a facility before using assistant tools.',
    )
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('blocks quotaComplianceSummary without facility for privileged role', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['quotaComplianceSummary'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe(
      'Please select a facility before using assistant tools.',
    )
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('quota summary migration rejects mismatched p_don_vi for local users', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260310174500_add_ai_quota_compliance_summary_rpc.sql',
    )
    const migrationSource = readFileSync(migrationPath, 'utf8')

    expect(migrationSource).toContain(
      "IF p_don_vi IS NOT NULL AND p_don_vi IS DISTINCT FROM v_don_vi THEN",
    )
    expect(migrationSource).toContain("RAISE EXCEPTION 'don_vi claim mismatch'")
  })

  it('device quota lookup migration returns insufficientEvidence when category metadata is missing', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260310174000_add_ai_device_quota_lookup_rpc.sql',
    )
    const migrationSource = readFileSync(migrationPath, 'utf8')

    expect(migrationSource).toContain('IF NOT FOUND THEN')
    expect(migrationSource).toContain("'status', 'insufficientEvidence'")
    expect(migrationSource).toContain(
      "'reason', 'Category metadata not found for equipment group'",
    )
  })

  it('has a patch migration that keeps active decision context for notMapped devices', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260314123500_fix_ai_device_quota_lookup_notmapped_decision_context.sql',
    )
    const migrationSource = readFileSync(migrationPath, 'utf8')

    expect(migrationSource).toContain("'reason', 'No active quota decision found for this facility'")
    expect(migrationSource).toContain("'status', 'notMapped'")
    expect(migrationSource).toContain("'decision', jsonb_build_object(")
    expect(migrationSource).toContain("'evidence_status', 'partial'")
  })

  it('has a migration that enforces so_luong_toi_thieu as NOT NULL DEFAULT 0', () => {
    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')
    const migrationFile = require('node:fs')
      .readdirSync(migrationsDir)
      .find((file: string) => file.includes('so_luong_toi_thieu_not_null'))

    expect(migrationFile).toBeTruthy()

    const migrationSource = readFileSync(path.join(migrationsDir, migrationFile!), 'utf8')
    expect(migrationSource).toContain('UPDATE public.chi_tiet_dinh_muc')
    expect(migrationSource).toContain('SET so_luong_toi_thieu = 0')
    expect(migrationSource).toContain('WHERE so_luong_toi_thieu IS NULL;')
    expect(migrationSource).toContain('ALTER TABLE public.chi_tiet_dinh_muc')
    expect(migrationSource).toContain(
      'ALTER COLUMN so_luong_toi_thieu SET DEFAULT 0;',
    )
    expect(migrationSource).toContain(
      'ALTER COLUMN so_luong_toi_thieu SET NOT NULL;',
    )
  })
})
