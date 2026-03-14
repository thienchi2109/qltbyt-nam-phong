import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

const DEFAULT_PROVIDER = 'google'
const DEFAULT_MODEL = 'gemini-3-flash-preview'

// ---------------------------------------------------------------------------
// API-key pool & round-robin rotation
// ---------------------------------------------------------------------------

function loadApiKeys(): string[] {
  const pool = process.env.GOOGLE_GENERATIVE_AI_API_KEYS
  if (pool) {
    const keys = pool
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    if (keys.length > 0) return keys
  }

  // Fallback: single-key env var (read by @ai-sdk/google by default)
  const single = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (single?.trim()) return [single.trim()]

  return []
}

/** Visible for testing — do NOT use directly outside tests. */
export const _internals = {
  keys: loadApiKeys(),
  currentIndex: 0,
  /** Set of indices whose quota is exhausted in the current window. */
  exhaustedIndices: new Set<number>(),
  /** Timestamp of last exhaustion-set reset (epoch ms). */
  lastResetEpoch: Date.now(),
}

/** Reset exhausted keys once per hour to re-try keys whose quota may have recovered. */
const RESET_INTERVAL_MS = 60 * 60 * 1000

function maybeResetExhausted(): void {
  if (Date.now() - _internals.lastResetEpoch >= RESET_INTERVAL_MS) {
    _internals.exhaustedIndices.clear()
    _internals.lastResetEpoch = Date.now()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a `LanguageModel` using the currently-active API key from the pool.
 *
 * Callers should pair this with `handleProviderQuotaError()` inside a retry
 * loop so that quota failures silently rotate to the next key.
 */
export function getChatModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase()
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL

  switch (provider) {
    case 'google': {
      const key = _internals.keys[_internals.currentIndex]
      // When an explicit key is available, create a provider bound to it.
      // Otherwise fall through to the default (reads GOOGLE_GENERATIVE_AI_API_KEY).
      const google = createGoogleGenerativeAI(key ? { apiKey: key } : undefined)
      return google(model as Parameters<typeof google>[0])
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}

/**
 * Rotate to the next non-exhausted API key after a quota error.
 *
 * @returns `true` if a fallback key is available, `false` if all keys in the
 *          pool are exhausted (caller should surface the quota error to the user).
 */
export function handleProviderQuotaError(): boolean {
  maybeResetExhausted()

  const { keys, currentIndex, exhaustedIndices } = _internals

  // Nothing to rotate if pool is empty or has a single key.
  if (keys.length <= 1) return false

  // Mark the current key as exhausted.
  exhaustedIndices.add(currentIndex)

  // Search for the next non-exhausted key (round-robin).
  for (let offset = 1; offset < keys.length; offset++) {
    const candidate = (currentIndex + offset) % keys.length
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
