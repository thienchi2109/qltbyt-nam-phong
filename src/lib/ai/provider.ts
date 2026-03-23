import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { LanguageModel } from 'ai'

import { getChatProviderOptions } from './chat-provider-options'

const DEFAULT_PROVIDER = 'google'
const DEFAULT_GOOGLE_MODEL = 'gemini-3-flash-preview'

export type SupportedAiProvider = 'google' | 'groq'

function getActiveProvider(): string {
  return (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase()
}

// ---------------------------------------------------------------------------
// API-key pool & round-robin rotation
// ---------------------------------------------------------------------------

function loadApiKeys(provider: string): string[] {
  switch (provider) {
    case 'google': {
      const poolEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEYS
      if (poolEnv) {
        const keys = poolEnv
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
        if (keys.length > 0) return keys
      }

      const singleEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      if (singleEnv?.trim()) return [singleEnv.trim()]

      return []
    }
    case 'groq': {
      const poolEnv = process.env.GROQ_API_KEYS
      if (poolEnv) {
        const keys = poolEnv
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
        if (keys.length > 0) return keys
      }

      const singleEnv = process.env.GROQ_API_KEY
      if (singleEnv?.trim()) return [singleEnv.trim()]

      return []
    }
    default:
      return []
  }
}

function getModelId(provider: SupportedAiProvider): string {
  switch (provider) {
    case 'google':
      return process.env.GOOGLE_GENERATIVE_AI_MODEL ?? process.env.AI_MODEL ?? DEFAULT_GOOGLE_MODEL
    case 'groq': {
      const model = process.env.GROQ_MODEL?.trim()
      if (!model) {
        throw new Error('Missing Groq model configuration: set GROQ_MODEL')
      }
      return model
    }
  }
}

function createProviderWithKey(provider: SupportedAiProvider, apiKey?: string) {
  switch (provider) {
    case 'google':
      return createGoogleGenerativeAI(apiKey ? { apiKey } : undefined)
    case 'groq':
      return createGroq(apiKey ? { apiKey } : undefined)
  }
}

/** Visible for testing — do NOT use directly outside tests. */
export const _internals = {
  keys: loadApiKeys(getActiveProvider()),
  currentIndex: 0,
  /** Set of indices whose quota is exhausted in the current window. */
  exhaustedIndices: new Set<number>(),
  /**
   * Timestamp of the first exhaustion event in the current window (epoch ms).
   * `null` means no keys have been exhausted yet — the timer starts on first
   * exhaustion, not at module load.
   */
  firstExhaustedAt: null as number | null,
}

/** Reset exhausted keys once per hour to re-try keys whose quota may have recovered. */
const RESET_INTERVAL_MS = 60 * 60 * 1000

function maybeResetExhausted(): void {
  const { firstExhaustedAt } = _internals
  if (firstExhaustedAt !== null && Date.now() - firstExhaustedAt >= RESET_INTERVAL_MS) {
    _internals.exhaustedIndices.clear()
    _internals.firstExhaustedAt = null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ChatModelWithKeyIndex {
  model: LanguageModel
  /** The pool index of the API key bound to this model instance. */
  keyIndex: number
}

export interface ChatProviderConfig {
  provider: SupportedAiProvider
  configuredModel: string
  providerOptions?: ProviderOptions
}

export function getChatProviderConfig(): ChatProviderConfig {
  const provider = getActiveProvider()

  switch (provider) {
    case 'google':
    case 'groq':
      return {
        provider,
        configuredModel: getModelId(provider),
        providerOptions: getChatProviderOptions(provider),
      }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

/**
 * Returns a `LanguageModel` using the currently-active API key from the pool,
 * along with the key index that was used.
 *
 * The caller **must** pass `keyIndex` to `handleProviderQuotaError()` so that
 * the correct key is marked as exhausted even under concurrent requests.
 */
export function getChatModel(): ChatModelWithKeyIndex {
  const { provider, configuredModel } = getChatProviderConfig()

  switch (provider) {
    case 'google': {
      const keyIndex = _internals.currentIndex
      const key = _internals.keys[keyIndex]
      // When an explicit key is available, create a provider bound to it.
      // Otherwise fall through to the default (reads GOOGLE_GENERATIVE_AI_API_KEY).
      const google = createProviderWithKey(provider, key)
      return {
        model: google(configuredModel as Parameters<typeof google>[0]),
        keyIndex,
      }
    }
    case 'groq': {
      const keyIndex = _internals.currentIndex
      const key = _internals.keys[keyIndex]
      const groq = createProviderWithKey(provider, key)
      return {
        model: groq(configuredModel as Parameters<typeof groq>[0]),
        keyIndex,
      }
    }
  }
}

/**
 * Rotate to the next non-exhausted API key after a quota error.
 *
 * @param failedKeyIndex The index of the key that actually received the quota
 *   error. This prevents concurrent requests from accidentally marking an
 *   innocent key as exhausted.
 * @returns `true` if a fallback key is available, `false` if all keys in the
 *          pool are exhausted (caller should surface the quota error to the user).
 */
export function handleProviderQuotaError(failedKeyIndex: number): boolean {
  maybeResetExhausted()

  const { keys, exhaustedIndices } = _internals

  // Nothing to rotate if pool is empty or has a single key.
  if (keys.length <= 1) return false

  // Mark the key that actually failed — not whatever currentIndex happens to be.
  exhaustedIndices.add(failedKeyIndex)

  // Start the hourly reset timer on first exhaustion event.
  if (_internals.firstExhaustedAt === null) {
    _internals.firstExhaustedAt = Date.now()
  }

  // Search for the next non-exhausted key (round-robin from the failed key).
  for (let offset = 1; offset < keys.length; offset++) {
    const candidate = (failedKeyIndex + offset) % keys.length
    if (!exhaustedIndices.has(candidate)) {
      _internals.currentIndex = candidate
      return true
    }
  }

  // Every key is exhausted.
  return false
}

/**
 * Returns the total number of API keys in the pool.
 * Used by the route to cap retry attempts.
 */
export function getKeyPoolSize(): number {
  return _internals.keys.length
}
