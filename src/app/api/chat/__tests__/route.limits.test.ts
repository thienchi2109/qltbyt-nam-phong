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

vi.mock('@/lib/ai/limits', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/limits')>()
  return {
    ...actual,
    AI_MAX_OUTPUT_TOKENS: 111,
    AI_MAX_TOOL_STEPS: 3,
    AI_MAX_MESSAGES: 2,
    AI_MAX_INPUT_CHARS: 5000,
    AI_MAX_COMPACTED_INPUT_CHARS: 1000,
  }
})

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
import { makeReadyStreamTextResult } from './stream-text-result-test-helpers'

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildMessage(id: string, text = 'Xin chao') {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

describe('/api/chat limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'admin', don_vi: 2 },
    })
    getChatModelMock.mockReturnValue({ model: 'google:gemini-2.5-flash', keyIndex: 0 })
    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    streamTextMock.mockReturnValue(makeReadyStreamTextResult())
  })

  it('applies maxOutputTokens and stopWhen guardrails to streamText', async () => {
    const res = await POST(
      buildRequest({ messages: [buildMessage('m1')] }) as never,
    )

    expect(res.status).toBe(200)
    expect(stepCountIsMock).toHaveBeenCalledWith(3)
    const streamTextArgs = streamTextMock.mock.calls[0]?.[0] as {
      maxOutputTokens?: number
      stopWhen?: unknown
    }
    expect(streamTextArgs?.maxOutputTokens).toBe(111)
    expect(streamTextArgs?.stopWhen).toBe('STOP_WHEN_SENTINEL')
  })

  it('rejects requests exceeding message count limit', async () => {
    const res = await POST(
      buildRequest({
        messages: [buildMessage('m1'), buildMessage('m2'), buildMessage('m3')],
      }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe('Request exceeds message limit')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('rejects requests exceeding input size limit', async () => {
    const longText = 'x'.repeat(5500)
    const res = await POST(
      buildRequest({ messages: [buildMessage('m1', longText)] }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe('Request exceeds input size limit')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('rejects requests that pass raw limit but exceed compacted context limit', async () => {
    // Build a message with an envelope tool output that is small enough
    // for raw budget (< 120 chars) but the compacted result still exceeds
    // AI_MAX_COMPACTED_INPUT_CHARS (which we set to a small value for testing).
    const envelopeOutput = {
      modelSummary: { summaryText: 'x'.repeat(500), itemCount: 1 },
      followUpContext: { data: 'y'.repeat(500) },
    }
    const messages = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'Xin chao' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-equipmentLookup',
            toolCallId: 'tc-1',
            toolName: 'equipmentLookup',
            state: 'output-available',
            output: envelopeOutput,
          },
        ],
      },
    ]

    const res = await POST(
      buildRequest({ messages }) as never,
    )
    const text = await res.text()

    expect(res.status).toBe(400)
    expect(text).toBe('Request exceeds compacted context limit')
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  it('passes requests with large envelope payloads that compact under budget', async () => {
    // Envelope with uiArtifact makes it large, but after compaction
    // (stripping uiArtifact) it falls under the compacted budget.
    const envelopeOutput = {
      modelSummary: { summaryText: 'OK', itemCount: 1 },
      followUpContext: { data: 'small' },
      uiArtifact: { rawPayload: { big: 'x'.repeat(20) } },
    }
    const messages = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hi' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-equipmentLookup',
            toolCallId: 'tc-1',
            toolName: 'equipmentLookup',
            state: 'output-available',
            output: envelopeOutput,
          },
        ],
      },
    ]

    const res = await POST(
      buildRequest({ messages }) as never,
    )

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalled()
  })

  it('draft tool outputs survive server compaction', async () => {
    const draftOutput = {
      kind: 'troubleshootingDraft',
      draftOnly: true,
      source: 'assistant',
      steps: ['step1', 'step2'],
    }
    const messages = [
      {
        id: 'm1',
        role: 'user',
        parts: [{ type: 'text', text: 'Troubleshoot' }],
      },
      {
        id: 'm2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-generateTroubleshootingDraft',
            toolCallId: 'tc-1',
            toolName: 'generateTroubleshootingDraft',
            state: 'output-available',
            output: draftOutput,
          },
        ],
      },
    ]

    const res = await POST(
      buildRequest({ messages }) as never,
    )

    // Draft should pass through — not compacted, not rejected
    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalled()
  })
})
