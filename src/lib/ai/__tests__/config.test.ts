import { describe, expect, it } from 'vitest'

import {
  assertDefaultChatCredentials,
  loadGoogleApiKeys,
  resolveDefaultChatConfig,
} from '../config'

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { ...overrides }
}

describe('AI default chat config resolver', () => {
  it('uses gateway and the hard default model when no env is configured', () => {
    expect(resolveDefaultChatConfig(env())).toEqual({
      capability: 'default_chat',
      provider: 'gateway',
      model: 'google/gemini-3.1-flash-lite-preview',
    })
  })

  it('prefers capability-specific provider and model env vars', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: 'gateway',
          AI_DEFAULT_CHAT_MODEL: 'mistral/mistral-large-3',
          AI_PROVIDER: 'google',
          AI_MODEL: 'gemini-3-flash',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'gateway',
      model: 'mistral/mistral-large-3',
    })
  })

  it('falls back to legacy Google provider and model env vars', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_PROVIDER: 'google',
          AI_MODEL: 'gemini-3-flash',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'google',
      model: 'gemini-3-flash',
    })
  })

  it('rejects gateway model ids without a provider prefix', () => {
    expect(() =>
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: 'gateway',
          AI_DEFAULT_CHAT_MODEL: 'gemini-3-flash',
        }),
      ),
    ).toThrow('AI_DEFAULT_CHAT_MODEL must be a provider-prefixed model id when provider is gateway')
  })

  it('rejects unsupported direct providers and points to gateway mode', () => {
    expect(() =>
      resolveDefaultChatConfig(
        env({
          AI_PROVIDER: 'openai',
          AI_MODEL: 'gpt-5.2',
        }),
      ),
    ).toThrow('Unsupported direct AI provider: openai. Use AI_DEFAULT_CHAT_PROVIDER=gateway')
  })

  it('requires an AI Gateway API key in gateway mode', () => {
    const config = resolveDefaultChatConfig(
      env({
        AI_DEFAULT_CHAT_PROVIDER: 'gateway',
        AI_DEFAULT_CHAT_MODEL: 'openai/gpt-5.2',
      }),
    )

    expect(() => assertDefaultChatCredentials(config, env())).toThrow(
      'AI_GATEWAY_API_KEY is required for AI gateway mode',
    )
  })

  it('requires at least one Google API key in direct Google mode', () => {
    const config = resolveDefaultChatConfig(
      env({
        AI_PROVIDER: 'google',
        AI_MODEL: 'gemini-3-flash',
      }),
    )

    expect(() => assertDefaultChatCredentials(config, env())).toThrow(
      'GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEYS is required for direct Google mode',
    )
  })

  it('loads comma-separated Google keys before the single-key fallback', () => {
    expect(
      loadGoogleApiKeys(
        env({
          GOOGLE_GENERATIVE_AI_API_KEYS: ' KEY_A, ,KEY_B ',
          GOOGLE_GENERATIVE_AI_API_KEY: 'SINGLE',
        }),
      ),
    ).toEqual(['KEY_A', 'KEY_B'])
  })
})
