import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// We need to test the module-level state, so we import _internals
// and reset between tests.
import {
  _internals,
  getChatModel,
  getKeyPoolSize,
  handleProviderQuotaError,
} from '../provider'

// Mock createGoogleGenerativeAI to avoid real HTTP calls.
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn((opts?: { apiKey?: string }) => {
    // Return a callable provider that records the apiKey it was created with.
    const provider = (modelId: string) => ({
      __testModel: true,
      modelId,
      apiKey: opts?.apiKey ?? 'DEFAULT_ENV_KEY',
    })
    return provider
  }),
}))

vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn((opts?: { apiKey?: string }) => {
    const provider = (modelId: string) => ({
      __testModel: true,
      modelId,
      apiKey: opts?.apiKey ?? 'DEFAULT_ENV_KEY',
    })
    return provider
  }),
}))

async function importFreshProvider() {
  vi.resetModules()
  return import('../provider')
}

describe('provider — API key rotation', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    // Set up a 3-key pool and provider env.
    process.env.AI_PROVIDER = 'google'
    process.env.AI_MODEL = 'gemini-3.1-flash-lite-preview'
    process.env.GOOGLE_GENERATIVE_AI_API_KEYS =
      'KEY_A,KEY_B,KEY_C'
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'KEY_A'

    // Reset internals to re-read keys.
    _internals.keys = ['KEY_A', 'KEY_B', 'KEY_C']
    _internals.currentIndex = 0
    _internals.exhaustedIndices.clear()
    _internals.firstExhaustedAt = null
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  // -------------------------------------------------------------------
  // getChatModel
  // -------------------------------------------------------------------

  it('returns a model using the current key from the pool', () => {
    const { model, keyIndex } = getChatModel()
    const m = model as unknown as { apiKey: string; modelId: string }

    expect(m.apiKey).toBe('KEY_A')
    expect(m.modelId).toBe('gemini-3.1-flash-lite-preview')
    expect(keyIndex).toBe(0)
  })

  it('returns model bound to the rotated key after handleProviderQuotaError', () => {
    handleProviderQuotaError(0) // KEY_A → KEY_B
    const { model, keyIndex } = getChatModel()
    const m = model as unknown as { apiKey: string }

    expect(m.apiKey).toBe('KEY_B')
    expect(keyIndex).toBe(1)
  })

  it('selects Groq when AI_PROVIDER=groq', async () => {
    process.env.AI_PROVIDER = 'groq'
    process.env.GROQ_API_KEYS = 'GROQ_A,GROQ_B'
    process.env.GROQ_API_KEY = 'GROQ_SINGLE'

    const { getChatModel: getGroqChatModel } = await importFreshProvider()
    const { model, keyIndex } = getGroqChatModel()
    const m = model as unknown as { apiKey: string; modelId: string }

    expect(m.apiKey).toBe('GROQ_A')
    expect(keyIndex).toBe(0)
  })

  it('prefers GROQ_API_KEYS over GROQ_API_KEY', async () => {
    process.env.AI_PROVIDER = 'groq'
    process.env.GROQ_API_KEYS = 'GROQ_POOL_A,GROQ_POOL_B'
    process.env.GROQ_API_KEY = 'GROQ_SINGLE'

    const { getChatModel: getGroqChatModel } = await importFreshProvider()
    const { model } = getGroqChatModel()
    const m = model as unknown as { apiKey: string }

    expect(m.apiKey).toBe('GROQ_POOL_A')
  })

  it('keeps Groq key rotation inside the active pool', async () => {
    process.env.AI_PROVIDER = 'groq'
    process.env.GROQ_API_KEYS = 'GROQ_A,GROQ_B,GROQ_C'
    process.env.GROQ_API_KEY = 'GROQ_SINGLE'

    const {
      getChatModel: getGroqChatModel,
      handleProviderQuotaError: handleGroqProviderQuotaError,
      _internals: groqInternals,
    } = await importFreshProvider()

    expect(getGroqChatModel().model).toBeDefined()
    expect(handleGroqProviderQuotaError(0)).toBe(true)
    expect(groqInternals.currentIndex).toBe(1)

    const { model, keyIndex } = getGroqChatModel()
    const m = model as unknown as { apiKey: string }

    expect(m.apiKey).toBe('GROQ_B')
    expect(keyIndex).toBe(1)
  })

  it('keeps Google behavior unchanged', async () => {
    process.env.AI_PROVIDER = 'google'
    process.env.GOOGLE_GENERATIVE_AI_API_KEYS = 'GOOGLE_A,GOOGLE_B'
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'GOOGLE_SINGLE'

    const { getChatModel: getGoogleChatModel } = await importFreshProvider()
    const { model, keyIndex } = getGoogleChatModel()
    const m = model as unknown as { apiKey: string; modelId: string }

    expect(m.apiKey).toBe('GOOGLE_A')
    expect(m.modelId).toBe('gemini-3.1-flash-lite-preview')
    expect(keyIndex).toBe(0)
  })

  // -------------------------------------------------------------------
  // handleProviderQuotaError
  // -------------------------------------------------------------------

  it('rotates to next key and returns true', () => {
    expect(handleProviderQuotaError(0)).toBe(true)
    expect(_internals.currentIndex).toBe(1)
  })

  it('skips already-exhausted keys', () => {
    _internals.exhaustedIndices.add(1) // KEY_B exhausted
    expect(handleProviderQuotaError(0)).toBe(true) // KEY_A exhausted → skip KEY_B → KEY_C
    expect(_internals.currentIndex).toBe(2)
  })

  it('returns false when all keys are exhausted', () => {
    handleProviderQuotaError(0) // KEY_A exhausted → KEY_B
    handleProviderQuotaError(1) // KEY_B exhausted → KEY_C
    expect(handleProviderQuotaError(2)).toBe(false) // KEY_C exhausted → none left
  })

  it('wraps around in round-robin', () => {
    _internals.currentIndex = 2 // start at KEY_C
    expect(handleProviderQuotaError(2)).toBe(true)
    expect(_internals.currentIndex).toBe(0) // wraps to KEY_A
  })

  it('returns false for a single-key pool', () => {
    _internals.keys = ['ONLY_KEY']
    _internals.currentIndex = 0
    _internals.exhaustedIndices.clear()

    expect(handleProviderQuotaError(0)).toBe(false)
  })

  it('returns false for an empty pool', () => {
    _internals.keys = []
    _internals.currentIndex = 0
    _internals.exhaustedIndices.clear()

    expect(handleProviderQuotaError(0)).toBe(false)
  })

  // -------------------------------------------------------------------
  // Concurrent safety: marks the correct key
  // -------------------------------------------------------------------

  it('marks the correct key when failedKeyIndex differs from currentIndex', () => {
    // Simulate: Request A used KEY_A (index 0), rotated to KEY_B.
    // Now Request B also fails on KEY_A — it should mark KEY_A, not KEY_B.
    handleProviderQuotaError(0) // rotates to KEY_B (index 1)
    expect(_internals.currentIndex).toBe(1)

    // Request B also fails with KEY_A (index 0 — already exhausted).
    // KEY_B is still healthy. Should just pick next non-exhausted.
    handleProviderQuotaError(0) // KEY_A already marked; round-robin from 0 → 1 (KEY_B, not exhausted)
    expect(_internals.currentIndex).toBe(1) // stays on KEY_B
  })

  // -------------------------------------------------------------------
  // Hourly reset
  // -------------------------------------------------------------------

  it('resets exhausted keys after the reset interval', () => {
    handleProviderQuotaError(0) // KEY_A exhausted → KEY_B
    handleProviderQuotaError(1) // KEY_B exhausted → KEY_C

    // Simulate 1 hour passing since first exhaustion.
    _internals.firstExhaustedAt = Date.now() - 61 * 60 * 1000

    // Now even though KEY_A and KEY_B were exhausted, the reset should clear them.
    expect(handleProviderQuotaError(2)).toBe(true) // KEY_C exhausted (fresh) → KEY_A (re-enabled)
    expect(_internals.currentIndex).toBe(0)
  })

  it('does not reset if the interval has not elapsed', () => {
    handleProviderQuotaError(0) // KEY_A exhausted → KEY_B
    handleProviderQuotaError(1) // KEY_B exhausted → KEY_C

    // Only 30 minutes — should NOT reset
    _internals.firstExhaustedAt = Date.now() - 30 * 60 * 1000

    expect(handleProviderQuotaError(2)).toBe(false) // all exhausted, no reset yet
  })

  // -------------------------------------------------------------------
  // getKeyPoolSize
  // -------------------------------------------------------------------

  it('returns pool size', () => {
    expect(getKeyPoolSize()).toBe(3)
  })

  it('returns 1 for single-key pool', () => {
    _internals.keys = ['ONLY_KEY']
    expect(getKeyPoolSize()).toBe(1)
  })

  // -------------------------------------------------------------------
  // Unsupported provider
  // -------------------------------------------------------------------

  it('throws on unsupported provider', () => {
    process.env.AI_PROVIDER = 'openai'
    expect(() => getChatModel()).toThrow('Unsupported AI provider: openai')
  })

  it('throws explicitly for providers outside google and groq', async () => {
    process.env.AI_PROVIDER = 'anthropic'

    const { getChatModel: getUnsupportedChatModel } = await importFreshProvider()
    expect(() => getUnsupportedChatModel()).toThrow(
      'Unsupported AI provider: anthropic',
    )
  })
})
