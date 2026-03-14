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
    _internals.lastResetEpoch = Date.now()
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  // -------------------------------------------------------------------
  // getChatModel
  // -------------------------------------------------------------------

  it('returns a model using the current key from the pool', () => {
    const model = getChatModel() as unknown as { apiKey: string; modelId: string }

    expect(model.apiKey).toBe('KEY_A')
    expect(model.modelId).toBe('gemini-3.1-flash-lite-preview')
  })

  it('returns model bound to the rotated key after handleProviderQuotaError', () => {
    handleProviderQuotaError() // KEY_A → KEY_B
    const model = getChatModel() as unknown as { apiKey: string }

    expect(model.apiKey).toBe('KEY_B')
  })

  // -------------------------------------------------------------------
  // handleProviderQuotaError
  // -------------------------------------------------------------------

  it('rotates to next key and returns true', () => {
    expect(handleProviderQuotaError()).toBe(true)
    expect(_internals.currentIndex).toBe(1)
  })

  it('skips already-exhausted keys', () => {
    _internals.exhaustedIndices.add(1) // KEY_B exhausted
    expect(handleProviderQuotaError()).toBe(true) // KEY_A exhausted → skip KEY_B → KEY_C
    expect(_internals.currentIndex).toBe(2)
  })

  it('returns false when all keys are exhausted', () => {
    handleProviderQuotaError() // KEY_A exhausted → KEY_B
    handleProviderQuotaError() // KEY_B exhausted → KEY_C
    expect(handleProviderQuotaError()).toBe(false) // KEY_C exhausted → none left
  })

  it('wraps around in round-robin', () => {
    _internals.currentIndex = 2 // start at KEY_C
    expect(handleProviderQuotaError()).toBe(true)
    expect(_internals.currentIndex).toBe(0) // wraps to KEY_A
  })

  it('returns false for a single-key pool', () => {
    _internals.keys = ['ONLY_KEY']
    _internals.currentIndex = 0
    _internals.exhaustedIndices.clear()

    expect(handleProviderQuotaError()).toBe(false)
  })

  it('returns false for an empty pool', () => {
    _internals.keys = []
    _internals.currentIndex = 0
    _internals.exhaustedIndices.clear()

    expect(handleProviderQuotaError()).toBe(false)
  })

  // -------------------------------------------------------------------
  // Hourly reset
  // -------------------------------------------------------------------

  it('resets exhausted keys after the reset interval', () => {
    handleProviderQuotaError() // KEY_A exhausted → KEY_B
    handleProviderQuotaError() // KEY_B exhausted → KEY_C

    // Simulate 1 hour passing.
    _internals.lastResetEpoch = Date.now() - 61 * 60 * 1000

    // Now even though KEY_A and KEY_B were exhausted, the reset should clear them.
    expect(handleProviderQuotaError()).toBe(true) // KEY_C exhausted (fresh) → KEY_A (re-enabled)
    expect(_internals.currentIndex).toBe(0)
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
})
