import { describe, expect, it } from 'vitest'

import {
  assertDefaultChatCredentials,
  loadGoogleApiKeys,
  readAIGatewayApiKey,
  readOpenAICompatibleApiKey,
  readOpenAICompatibleBaseUrl,
  resolveDefaultChatConfig,
} from '../config'

function env(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return { ...overrides }
}

// ---------------------------------------------------------------------------
// AI env readers (symmetry) — Issue #334
//
// Pin the contract that all three env readers share identical behavior:
//   - return the trimmed value when set
//   - return undefined when the env var is missing
//   - return undefined when the env var is whitespace-only
//
// Without this symmetry, the gateway branch in provider.ts had to read the
// env var inline via `process.env.AI_GATEWAY_API_KEY?.trim()`, while
// openai-compatible already used dedicated readers — an asymmetry tracked
// by Issue #334.
// ---------------------------------------------------------------------------

describe('AI env readers (symmetry)', () => {
  describe('readAIGatewayApiKey', () => {
    it('returns the trimmed AI_GATEWAY_API_KEY when set', () => {
      expect(readAIGatewayApiKey(env({ AI_GATEWAY_API_KEY: ' GATEWAY_KEY\n' }))).toBe(
        'GATEWAY_KEY',
      )
    })

    it('returns undefined when AI_GATEWAY_API_KEY is missing', () => {
      expect(readAIGatewayApiKey(env())).toBeUndefined()
    })

    it('returns undefined when AI_GATEWAY_API_KEY is whitespace-only', () => {
      expect(readAIGatewayApiKey(env({ AI_GATEWAY_API_KEY: '   ' }))).toBeUndefined()
    })
  })

  describe('readOpenAICompatibleApiKey', () => {
    it('returns the trimmed AI_OPENAI_COMPATIBLE_API_KEY when set', () => {
      expect(
        readOpenAICompatibleApiKey(env({ AI_OPENAI_COMPATIBLE_API_KEY: ' DASHSCOPE_KEY\t' })),
      ).toBe('DASHSCOPE_KEY')
    })

    it('returns undefined when AI_OPENAI_COMPATIBLE_API_KEY is missing', () => {
      expect(readOpenAICompatibleApiKey(env())).toBeUndefined()
    })

    it('returns undefined when AI_OPENAI_COMPATIBLE_API_KEY is whitespace-only', () => {
      expect(readOpenAICompatibleApiKey(env({ AI_OPENAI_COMPATIBLE_API_KEY: '   ' }))).toBeUndefined()
    })
  })

  describe('readOpenAICompatibleBaseUrl', () => {
    it('returns the trimmed AI_OPENAI_COMPATIBLE_BASE_URL when set', () => {
      expect(
        readOpenAICompatibleBaseUrl(
          env({
            AI_OPENAI_COMPATIBLE_BASE_URL:
              ' https://dashscope-intl.aliyuncs.com/compatible-mode/v1\n',
          }),
        ),
      ).toBe('https://dashscope-intl.aliyuncs.com/compatible-mode/v1')
    })

    it('returns undefined when AI_OPENAI_COMPATIBLE_BASE_URL is missing', () => {
      expect(readOpenAICompatibleBaseUrl(env())).toBeUndefined()
    })

    it('returns undefined when AI_OPENAI_COMPATIBLE_BASE_URL is whitespace-only', () => {
      expect(
        readOpenAICompatibleBaseUrl(env({ AI_OPENAI_COMPATIBLE_BASE_URL: '   ' })),
      ).toBeUndefined()
    })
  })
})

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

  it('defaults to gateway when only a provider-prefixed AI_DEFAULT_CHAT_MODEL is configured', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_MODEL: 'openai/gpt-5.2',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'gateway',
      model: 'openai/gpt-5.2',
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

  it('supports an explicit openai-compatible provider with a custom base URL', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: 'openai-compatible',
          AI_DEFAULT_CHAT_MODEL: 'qwen3.5-plus-2026-04-20',
          AI_OPENAI_COMPATIBLE_BASE_URL:
            'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'openai-compatible',
      model: 'qwen3.5-plus-2026-04-20',
    })
  })

  it('keeps legacy AI_MODEL-only config in direct Google mode', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_MODEL: 'gemini-3.1-flash-lite-preview',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'google',
      model: 'gemini-3.1-flash-lite-preview',
    })
  })

  it('uses an unprefixed Google model default when only legacy provider is set', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_PROVIDER: 'google',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'google',
      model: 'gemini-3.1-flash-lite-preview',
    })
  })

  it('keeps legacy single Google API key config in direct Google mode', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          GOOGLE_GENERATIVE_AI_API_KEY: 'google-key',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'google',
      model: 'gemini-3.1-flash-lite-preview',
    })
  })

  it('keeps legacy pooled Google API key config in direct Google mode', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          GOOGLE_GENERATIVE_AI_API_KEYS: 'google-key-a,google-key-b',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'google',
      model: 'gemini-3.1-flash-lite-preview',
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

  it('requires a base URL in openai-compatible mode', () => {
    const config = resolveDefaultChatConfig(
      env({
        AI_DEFAULT_CHAT_PROVIDER: 'openai-compatible',
        AI_DEFAULT_CHAT_MODEL: 'qwen3.5-plus-2026-04-20',
      }),
    )

    expect(() => assertDefaultChatCredentials(config, env())).toThrow(
      'AI_OPENAI_COMPATIBLE_BASE_URL is required for openai-compatible mode',
    )
  })

  it('requires an API key in openai-compatible mode', () => {
    const envVars = env({
      AI_DEFAULT_CHAT_PROVIDER: 'openai-compatible',
      AI_DEFAULT_CHAT_MODEL: 'qwen3.5-plus-2026-04-20',
      AI_OPENAI_COMPATIBLE_BASE_URL:
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    })
    const config = resolveDefaultChatConfig(envVars)

    expect(() => assertDefaultChatCredentials(config, envVars)).toThrow(
      'AI_OPENAI_COMPATIBLE_API_KEY is required for openai-compatible mode',
    )
  })

  it('requires an explicit model in openai-compatible mode instead of falling back to the gateway default', () => {
    expect(() =>
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: 'openai-compatible',
          AI_OPENAI_COMPATIBLE_BASE_URL:
            'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
        }),
      ),
    ).toThrow('AI_DEFAULT_CHAT_MODEL or AI_MODEL is required for openai-compatible mode')
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

  // -------------------------------------------------------------------
  // Closeout fail-fast invariants (Issue #327 / #315 Batch 4)
  //
  // These tests pin the contract that whitespace-only env values are
  // treated as missing — preventing accidental "blank string" deployments
  // from silently passing credential validation.
  // -------------------------------------------------------------------

  it('treats whitespace-only AI_DEFAULT_CHAT_PROVIDER as missing and falls back to gateway default', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: '   ',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'gateway',
      model: 'google/gemini-3.1-flash-lite-preview',
    })
  })

  it('treats whitespace-only AI_GATEWAY_API_KEY as missing in gateway mode', () => {
    const config = resolveDefaultChatConfig(
      env({
        AI_DEFAULT_CHAT_PROVIDER: 'gateway',
        AI_DEFAULT_CHAT_MODEL: 'openai/gpt-5.2',
      }),
    )

    expect(() =>
      assertDefaultChatCredentials(
        config,
        env({
          AI_GATEWAY_API_KEY: '   ',
        }),
      ),
    ).toThrow('AI_GATEWAY_API_KEY is required for AI gateway mode')
  })

  it('treats whitespace-only AI_OPENAI_COMPATIBLE_API_KEY as missing in openai-compatible mode', () => {
    const envVars = env({
      AI_DEFAULT_CHAT_PROVIDER: 'openai-compatible',
      AI_DEFAULT_CHAT_MODEL: 'qwen3.5-plus-2026-04-20',
      AI_OPENAI_COMPATIBLE_BASE_URL:
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      AI_OPENAI_COMPATIBLE_API_KEY: '   ',
    })
    const config = resolveDefaultChatConfig(envVars)

    expect(() => assertDefaultChatCredentials(config, envVars)).toThrow(
      'AI_OPENAI_COMPATIBLE_API_KEY is required for openai-compatible mode',
    )
  })

  it('treats whitespace-only AI_OPENAI_COMPATIBLE_BASE_URL as missing in openai-compatible mode', () => {
    const envVars = env({
      AI_DEFAULT_CHAT_PROVIDER: 'openai-compatible',
      AI_DEFAULT_CHAT_MODEL: 'qwen3.5-plus-2026-04-20',
      AI_OPENAI_COMPATIBLE_BASE_URL: '   ',
      AI_OPENAI_COMPATIBLE_API_KEY: 'DASHSCOPE_KEY',
    })
    const config = resolveDefaultChatConfig(envVars)

    expect(() => assertDefaultChatCredentials(config, envVars)).toThrow(
      'AI_OPENAI_COMPATIBLE_BASE_URL is required for openai-compatible mode',
    )
  })

  it('rejects unsupported direct provider supplied via AI_DEFAULT_CHAT_PROVIDER, not just legacy AI_PROVIDER', () => {
    expect(() =>
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: 'anthropic',
          AI_DEFAULT_CHAT_MODEL: 'claude-3.5-sonnet',
        }),
      ),
    ).toThrow('Unsupported direct AI provider: anthropic. Use AI_DEFAULT_CHAT_PROVIDER=gateway')
  })

  it('normalizes the provider name to lowercase before validation', () => {
    expect(
      resolveDefaultChatConfig(
        env({
          AI_DEFAULT_CHAT_PROVIDER: 'GATEWAY',
          AI_DEFAULT_CHAT_MODEL: 'openai/gpt-5.2',
        }),
      ),
    ).toEqual({
      capability: 'default_chat',
      provider: 'gateway',
      model: 'openai/gpt-5.2',
    })
  })
})
