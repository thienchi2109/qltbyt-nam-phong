import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const reserveUsageMock = vi.fn(async () => ({
  allowed: true,
  reservationId: '00000000-0000-4000-8000-000000000484',
}))
const finalizeUsageMock = vi.fn(async () => undefined)

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
  classifyStreamFailure: ({ providerUsage }: { providerUsage?: { inputTokens?: number; outputTokens?: number } }) => ({
    status: 'error_with_usage',
    inputTokens: providerUsage?.inputTokens ?? 0,
    outputTokens: providerUsage?.outputTokens ?? 0,
  }),
  reserveUsage: (...args: unknown[]) => reserveUsageMock(...args),
  finalizeUsage: (...args: unknown[]) => finalizeUsageMock(...args),
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
import {
  makeChatModel,
  makeReadyStreamTextResult,
} from './stream-text-result-test-helpers'

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildMessages(text: string) {
  return [
    {
      id: 'msg_1',
      role: 'user',
      parts: [{ type: 'text', text }],
    },
  ]
}

describe('/api/chat equipment lookup intent routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 17 },
    })
    getChatModelMock.mockReturnValue(makeChatModel('google:gemini-2.5-flash'))
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    reserveUsageMock.mockResolvedValue({
      allowed: true,
      reservationId: '00000000-0000-4000-8000-000000000484',
    })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    streamTextMock.mockReturnValue(makeReadyStreamTextResult())
  })

  it('exposes equipmentLookup for a concrete equipment-name lookup without generic device words', async () => {
    const res = await POST(
      buildRequest({
        selectedFacilityId: 17,
        messages: buildMessages('Tra cứu bơm tiêm điện'),
        requestedTools: [
          'equipmentLookup',
          'maintenanceSummary',
          'repairSummary',
          'usageHistory',
          'query_database',
        ],
      }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()

    const streamArgs = streamTextMock.mock.calls[0]?.[0] as {
      tools?: Record<string, unknown>
    }
    expect(streamArgs.tools).toHaveProperty('equipmentLookup')
    expect(streamArgs.tools).not.toHaveProperty('maintenanceSummary')
    expect(streamArgs.tools).not.toHaveProperty('repairSummary')
    expect(streamArgs.tools).not.toHaveProperty('usageHistory')
    expect(streamArgs.tools).not.toHaveProperty('query_database')
  })
})
