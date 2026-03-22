/**
 * Integration tests for API-key rotation in the /api/chat route.
 *
 * These tests verify that the retry loop in route.ts correctly:
 * 1. Retries with the next API key when a quota error occurs.
 * 2. Returns a successful response after rotation.
 * 3. Returns a sanitized error when all keys are exhausted.
 * 4. Does NOT retry on non-quota errors.
 * 5. Always marks the exhausted key even on the last attempt.
 *
 * Strategy: Mock the provider to return an incrementing keyIndex,
 * and control streamText with async stream parts for quota and success cases.
 * This exercises the full route handler code path, not just the provider module.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock setup — hoisted above all imports
// ---------------------------------------------------------------------------

const getServerSessionMock = vi.fn()
const streamTextMock = vi.fn()
const stepCountIsMock = vi.fn()
const getChatModelMock = vi.fn()
const getKeyPoolSizeMock = vi.fn()
const handleProviderQuotaErrorMock = vi.fn()
const buildSystemPromptMock = vi.fn()
const checkUsageLimitsMock = vi.fn()
const recordUsageMock = vi.fn()
const confirmUsageMock = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}))

vi.mock('@/lib/ai/provider', () => ({
  getChatModel: (...args: unknown[]) => getChatModelMock(...args),
  getKeyPoolSize: (...args: unknown[]) => getKeyPoolSizeMock(...args),
  handleProviderQuotaError: (...args: unknown[]) => handleProviderQuotaErrorMock(...args),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_MESSAGES = [
  {
    id: 'msg_1',
    role: 'user',
    parts: [{ type: 'text', text: 'Xin chào' }],
  },
]

function buildRequest(body: unknown) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function buildValidRequest() {
  return buildRequest({
    selectedFacilityId: 17,
    messages: VALID_MESSAGES,
    requestedTools: ['equipmentLookup'],
  })
}

function makeQuotaError(message = 'You exceeded your current quota') {
  return new Error(message)
}

function makeStreamResult(
  parts: Array<{ type: string; error?: unknown }>,
  options?: { returnSpy?: ReturnType<typeof vi.fn> },
) {
  const returnSpy =
    options?.returnSpy ??
    vi.fn(async () => ({
      done: true,
      value: undefined,
    }))

  return {
    fullStream: {
      [Symbol.asyncIterator]() {
        let index = 0
        return {
          async next() {
            if (index >= parts.length) {
              return { done: true, value: undefined }
            }

            const value = parts[index++]
            return { done: false, value }
          },
          return: returnSpy,
        }
      },
    },
    toUIMessageStreamResponse: vi.fn(() => new Response(null, { status: 200 })),
  }
}

function makeQuotaStream(returnSpy?: ReturnType<typeof vi.fn>) {
  return makeStreamResult([
    { type: 'start' },
    { type: 'error', error: makeQuotaError() },
  ], { returnSpy })
}

function makeReadyStream(returnSpy?: ReturnType<typeof vi.fn>) {
  return makeStreamResult([
    { type: 'start' },
    { type: 'start-step' },
  ], { returnSpy })
}

function makeOKStream() {
  return makeReadyStream()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/api/chat — API key rotation integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default session: authenticated user with a facility.
    getServerSessionMock.mockResolvedValue({
      user: { id: 'u1', role: 'to_qltb', don_vi: 17 },
    })

    buildSystemPromptMock.mockReturnValue('SYSTEM_PROMPT_V1')
    checkUsageLimitsMock.mockReturnValue({ allowed: true })
    stepCountIsMock.mockReturnValue('STOP_WHEN_SENTINEL')
    recordUsageMock.mockReturnValue(undefined)
  })

  // -----------------------------------------------------------------
  // Happy path: no quota errors
  // -----------------------------------------------------------------

  it('should succeed on the first attempt when no quota error occurs', async () => {
    // Given: a single-key pool and a working stream
    getKeyPoolSizeMock.mockReturnValue(1)
    getChatModelMock.mockReturnValue({ model: 'google:gemini-flash', keyIndex: 0 })
    streamTextMock.mockReturnValue(makeOKStream())

    // When: the route is called
    const res = await POST(buildValidRequest() as never)

    // Then: success, streamText called exactly once, no rotation attempted
    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()
    expect(handleProviderQuotaErrorMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------
  // Key rotation: quota error on key 0 → auto-switch to key 1
  // -----------------------------------------------------------------

  it('should retry with the next key when the first key hits a quota error', async () => {
    // Given: a 3-key pool
    getKeyPoolSizeMock.mockReturnValue(3)

    // getChatModel returns key 0 first, then key 1 after rotation
    getChatModelMock
      .mockReturnValueOnce({ model: 'model-with-key-0', keyIndex: 0 })
      .mockReturnValueOnce({ model: 'model-with-key-1', keyIndex: 1 })

    // streamText: emits quota error on first call (key 0), succeeds on second (key 1)
    streamTextMock
      .mockReturnValueOnce(makeQuotaStream())
      .mockReturnValueOnce(makeReadyStream())

    // handleProviderQuotaError: simulate successful rotation
    handleProviderQuotaErrorMock.mockReturnValueOnce(true)

    // When: the route is called
    const res = await POST(buildValidRequest() as never)

    // Then: response succeeds, streamText was called twice
    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledTimes(2)

    // The rotation handler was called with keyIndex 0 (the failing key)
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledOnce()
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledWith(0)

    // Second streamText call used the rotated model
    const secondCallArgs = streamTextMock.mock.calls[1]?.[0] as { model: string }
    expect(secondCallArgs.model).toBe('model-with-key-1')
  })

  it('retries within the same request when preflight stream emits a quota error part', async () => {
    getKeyPoolSizeMock.mockReturnValue(2)

    getChatModelMock
      .mockReturnValueOnce({ model: 'model-key-0', keyIndex: 0 })
      .mockReturnValueOnce({ model: 'model-key-1', keyIndex: 1 })

    const firstReturnSpy = vi.fn(async () => ({ done: true, value: undefined }))
    const secondReturnSpy = vi.fn(async () => ({ done: true, value: undefined }))

    streamTextMock
      .mockReturnValueOnce(makeQuotaStream(firstReturnSpy))
      .mockReturnValueOnce(makeReadyStream(secondReturnSpy))

    handleProviderQuotaErrorMock.mockReturnValueOnce(true)

    const res = await POST(buildValidRequest() as never)

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledTimes(2)
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledWith(0)
    expect(firstReturnSpy).toHaveBeenCalledOnce()
    expect(secondReturnSpy).toHaveBeenCalledOnce()
  })

  it('preflight ignores leading start and succeeds on first meaningful part', async () => {
    getKeyPoolSizeMock.mockReturnValue(1)
    getChatModelMock.mockReturnValue({ model: 'model-key-0', keyIndex: 0 })

    const returnSpy = vi.fn(async () => ({
      done: true,
      value: undefined,
    }))
    streamTextMock.mockReturnValue(makeReadyStream(returnSpy))

    const res = await POST(buildValidRequest() as never)

    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledOnce()
    expect(handleProviderQuotaErrorMock).not.toHaveBeenCalled()
    expect(returnSpy).toHaveBeenCalledOnce()
  })

  it('preflight returns sanitized 500 when all attempted keys emit quota error parts', async () => {
    getKeyPoolSizeMock.mockReturnValue(2)

    getChatModelMock
      .mockReturnValueOnce({ model: 'model-key-0', keyIndex: 0 })
      .mockReturnValueOnce({ model: 'model-key-1', keyIndex: 1 })

    const firstReturnSpy = vi.fn(async () => ({
      done: true,
      value: undefined,
    }))
    const secondReturnSpy = vi.fn(async () => ({
      done: true,
      value: undefined,
    }))

    streamTextMock
      .mockReturnValueOnce(makeQuotaStream(firstReturnSpy))
      .mockReturnValueOnce(makeQuotaStream(secondReturnSpy))

    handleProviderQuotaErrorMock
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false)

    const res = await POST(buildValidRequest() as never)

    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('exceeded your current quota')
    expect(streamTextMock).toHaveBeenCalledTimes(2)
    expect(handleProviderQuotaErrorMock).toHaveBeenNthCalledWith(1, 0)
    expect(handleProviderQuotaErrorMock).toHaveBeenNthCalledWith(2, 1)
    expect(firstReturnSpy).toHaveBeenCalledOnce()
    expect(secondReturnSpy).toHaveBeenCalledOnce()
  })

  it('preflight does not rotate keys on non-quota error parts', async () => {
    getKeyPoolSizeMock.mockReturnValue(2)
    getChatModelMock.mockReturnValue({ model: 'model-key-0', keyIndex: 0 })

    streamTextMock.mockReturnValue(
      makeStreamResult([
        { type: 'start' },
        { type: 'error', error: new Error('Network timeout') },
      ]),
    )

    const res = await POST(buildValidRequest() as never)

    expect(res.status).toBe(500)
    expect(handleProviderQuotaErrorMock).not.toHaveBeenCalled()
    expect(streamTextMock).toHaveBeenCalledOnce()
  })

  // -----------------------------------------------------------------
  // Multi-hop rotation: key 0 → key 1 → key 2 (all fail except last)
  // -----------------------------------------------------------------

  it('should rotate through multiple keys until one succeeds', async () => {
    // Given: a 3-key pool, keys 0 and 1 both fail, key 2 succeeds
    getKeyPoolSizeMock.mockReturnValue(3)

    getChatModelMock
      .mockReturnValueOnce({ model: 'model-key-0', keyIndex: 0 })
      .mockReturnValueOnce({ model: 'model-key-1', keyIndex: 1 })
      .mockReturnValueOnce({ model: 'model-key-2', keyIndex: 2 })

    streamTextMock
      .mockReturnValueOnce(makeQuotaStream())
      .mockReturnValueOnce(makeQuotaStream())
      .mockReturnValueOnce(makeReadyStream())

    handleProviderQuotaErrorMock
      .mockReturnValueOnce(true)  // key 0 → key 1
      .mockReturnValueOnce(true)  // key 1 → key 2

    // When
    const res = await POST(buildValidRequest() as never)

    // Then: success after 3 attempts
    expect(res.status).toBe(200)
    expect(streamTextMock).toHaveBeenCalledTimes(3)
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledTimes(2)
    expect(handleProviderQuotaErrorMock).toHaveBeenNthCalledWith(1, 0)
    expect(handleProviderQuotaErrorMock).toHaveBeenNthCalledWith(2, 1)
  })

  // -----------------------------------------------------------------
  // All keys exhausted: returns sanitized error
  // -----------------------------------------------------------------

  it('should return a sanitized 500 error when all keys are exhausted', async () => {
    // Given: a 2-key pool, both keys fail with quota errors
    getKeyPoolSizeMock.mockReturnValue(2)

    getChatModelMock
      .mockReturnValueOnce({ model: 'model-key-0', keyIndex: 0 })
      .mockReturnValueOnce({ model: 'model-key-1', keyIndex: 1 })

    streamTextMock
      .mockReturnValueOnce(makeQuotaStream())
      .mockReturnValueOnce(makeQuotaStream())

    // First rotation succeeds, but second call all exhausted
    handleProviderQuotaErrorMock
      .mockReturnValueOnce(true)   // key 0 → key 1
      .mockReturnValueOnce(false)  // key 1 → none left

    // When
    const res = await POST(buildValidRequest() as never)

    // Then: the user gets a 500 with a sanitized error message (text/plain)
    expect(res.status).toBe(500)
    const body = await res.text()
    // Should NOT leak internal quota details — just a safe user message
    expect(body).toBeTruthy()
    expect(body).not.toContain('exceeded your current quota')
  })

  // -----------------------------------------------------------------
  // Non-quota errors: should NOT trigger rotation
  // -----------------------------------------------------------------

  it('should NOT rotate keys on non-quota errors (e.g. network timeout)', async () => {
    // Given: a 3-key pool, streamText throws a non-quota error
    getKeyPoolSizeMock.mockReturnValue(3)
    getChatModelMock.mockReturnValue({ model: 'model-key-0', keyIndex: 0 })
    streamTextMock.mockImplementation(() => { throw new Error('Network timeout') })

    // When
    const res = await POST(buildValidRequest() as never)

    // Then: 500 error returned immediately, no rotation attempted
    expect(res.status).toBe(500)
    expect(streamTextMock).toHaveBeenCalledOnce()
    expect(handleProviderQuotaErrorMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------
  // Last-attempt exhaustion: key still gets marked
  // -----------------------------------------------------------------

  it('should mark the last key as exhausted even on the final attempt', async () => {
    // Given: a 2-key pool, both keys fail
    getKeyPoolSizeMock.mockReturnValue(2)

    getChatModelMock
      .mockReturnValueOnce({ model: 'model-key-0', keyIndex: 0 })
      .mockReturnValueOnce({ model: 'model-key-1', keyIndex: 1 })

    streamTextMock
      .mockImplementationOnce(() => { throw makeQuotaError() })
      .mockImplementationOnce(() => { throw makeQuotaError() })

    handleProviderQuotaErrorMock
      .mockReturnValueOnce(true)   // key 0 → key 1
      .mockReturnValueOnce(false)  // key 1 → none left

    // When
    await POST(buildValidRequest() as never)

    // Then: handleProviderQuotaError was called for BOTH keys
    // (verifies the short-circuit fix: key 1 gets marked on the last attempt)
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledTimes(2)
    expect(handleProviderQuotaErrorMock).toHaveBeenNthCalledWith(1, 0) // key 0
    expect(handleProviderQuotaErrorMock).toHaveBeenNthCalledWith(2, 1) // key 1
  })

  // -----------------------------------------------------------------
  // getChatModel failure: should return sanitized error, not crash
  // -----------------------------------------------------------------

  it('should return a sanitized error if getChatModel throws', async () => {
    // Given: provider setup fails (e.g., unsupported provider)
    getKeyPoolSizeMock.mockReturnValue(1)
    getChatModelMock.mockImplementation(() => {
      throw new Error('Unsupported AI provider: openai')
    })

    // When
    const res = await POST(buildValidRequest() as never)

    // Then: error is sanitized, not an unhandled crash
    expect(res.status).toBe(500)
    expect(streamTextMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------
  // Single-key pool: no rotation possible, surfaces error directly
  // -----------------------------------------------------------------

  it('should surface quota error directly when pool has only one key', async () => {
    // Given: a single-key pool
    getKeyPoolSizeMock.mockReturnValue(1)
    getChatModelMock.mockReturnValue({ model: 'model-only-key', keyIndex: 0 })
    streamTextMock.mockReturnValue(makeQuotaStream())

    // handleProviderQuotaError returns false (no other keys)
    handleProviderQuotaErrorMock.mockReturnValue(false)

    // When
    const res = await POST(buildValidRequest() as never)

    // Then: 500 error, only 1 attempt, key still marked
    expect(res.status).toBe(500)
    expect(streamTextMock).toHaveBeenCalledOnce()
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledOnce()
    expect(handleProviderQuotaErrorMock).toHaveBeenCalledWith(0)
  })
})
