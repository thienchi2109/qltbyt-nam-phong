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
  getKeyPoolSize: () => 1,
  handleProviderQuotaError: () => false,
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
    parts: [{ type: 'text', text: 'Xin chao' }],
  },
]

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/chat attachmentLookup tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue('google:gemini-3-flash-preview')
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () => new Response(null, { status: 200 }),
    })
  })

  it('accepts attachmentLookup when explicitly requested', async () => {
    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['attachmentLookup'],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs?.tools).toHaveProperty('attachmentLookup')
  })

  it('blocks attachmentLookup without facility context for privileged role', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'global', don_vi: null },
    })

    const res = await POST(
      buildRequest({
        messages: VALID_MESSAGES,
        requestedTools: ['attachmentLookup'],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe(
      'Please select a facility before using assistant tools.',
    )
    expect(streamTextMock).not.toHaveBeenCalled()
  })
})

describe('attachmentLookup contract shape', () => {
  it('maps to ai_attachment_metadata RPC', async () => {
    const { getToolRpcMapping } = await import('@/lib/ai/tools/registry')
    const mapping = getToolRpcMapping()
    expect(mapping.attachmentLookup).toBe('ai_attachment_metadata')
  })

  it('input schema only accepts thiet_bi_id', async () => {
    const { READ_ONLY_TOOL_DEFINITIONS_FOR_TEST } = await import(
      '@/lib/ai/tools/registry'
    )
    const def = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST.attachmentLookup
    expect(def).toBeDefined()

    const schema = def.inputSchema as import('zod').ZodObject<Record<string, unknown>>
    const keys = Object.keys(schema.shape)
    expect(keys).toEqual(['thiet_bi_id'])
  })

  it('description reflects normalized access contract', async () => {
    const { READ_ONLY_TOOL_DEFINITIONS_FOR_TEST } = await import(
      '@/lib/ai/tools/registry'
    )
    const def = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST.attachmentLookup

    // Must mention normalized/access contract, not just "external links"
    expect(def.description).toContain('metadata')
    expect(def.description).toContain('access')
    // Must NOT reference internal column names or storage internals
    expect(def.description).not.toContain('duong_dan_luu_tru')
    expect(def.description).not.toContain('bucket')
    expect(def.description).not.toContain('storage_key')
  })

  it('rejects unknown input fields via strict schema', async () => {
    const { READ_ONLY_TOOL_DEFINITIONS_FOR_TEST } = await import(
      '@/lib/ai/tools/registry'
    )
    const def = READ_ONLY_TOOL_DEFINITIONS_FOR_TEST.attachmentLookup
    const schema = def.inputSchema

    // Valid input should pass
    const valid = schema.safeParse({ thiet_bi_id: 42 })
    expect(valid.success).toBe(true)

    // Extra fields should be rejected (strict schema)
    const invalid = schema.safeParse({ thiet_bi_id: 42, extra: true })
    expect(invalid.success).toBe(false)
  })
})
