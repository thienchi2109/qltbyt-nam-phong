import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGateway, type LanguageModel } from 'ai'

import {
  assertDefaultChatCredentials,
  resolveDefaultChatProvider,
  loadGoogleApiKeys,
  resolveDefaultChatConfig,
} from './config'

// ---------------------------------------------------------------------------
// API-key pool & round-robin rotation
// ---------------------------------------------------------------------------

function loadApiKeys(): string[] {
  return loadGoogleApiKeys()
}

/** Visible for testing — do NOT use directly outside tests. */
export const _internals = {
  keys: loadApiKeys(),
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

/**
 * Returns a `LanguageModel` using the currently-active API key from the pool,
 * along with the key index that was used.
 *
 * The caller **must** pass `keyIndex` to `handleProviderQuotaError()` so that
 * the correct key is marked as exhausted even under concurrent requests.
 */
export function getChatModel(): ChatModelWithKeyIndex {
  const config = resolveDefaultChatConfig()
  assertDefaultChatCredentials(config)

  switch (config.provider) {
    case 'gateway': {
      const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
      return {
        model: gateway(config.model as Parameters<typeof gateway>[0]),
        keyIndex: 0,
      }
    }
    case 'google': {
      const keyIndex = _internals.currentIndex
      const key = _internals.keys[keyIndex]
      // When an explicit key is available, create a provider bound to it.
      // Otherwise fall through to the default (reads GOOGLE_GENERATIVE_AI_API_KEY).
      const google = createGoogleGenerativeAI(key ? { apiKey: key } : undefined)
      return {
        model: google(config.model as Parameters<typeof google>[0]),
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
  if (resolveDefaultChatProvider() === 'gateway') return false

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
  if (resolveDefaultChatProvider() === 'gateway') return 1

  return _internals.keys.length
}
