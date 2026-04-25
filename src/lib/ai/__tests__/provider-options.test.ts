import { describe, expect, it } from 'vitest'

import { resolveDefaultChatProviderOptions } from '../provider-options'

describe('default chat provider options', () => {
  it('omits provider options for non-Google Gateway models', () => {
    expect(
      resolveDefaultChatProviderOptions({
        capability: 'default_chat',
        provider: 'gateway',
        model: 'openai/gpt-5.2',
      }),
    ).toBeUndefined()
  })

  it('keeps Google thinking config for Gateway Gemini models', () => {
    expect(
      resolveDefaultChatProviderOptions({
        capability: 'default_chat',
        provider: 'gateway',
        model: 'google/gemini-3.1-flash-lite-preview',
      }),
    ).toEqual({
      google: {
        thinkingConfig: { thinkingLevel: 'medium' },
      },
    })
  })

  it('omits Google thinking config for Gateway Gemma models', () => {
    expect(
      resolveDefaultChatProviderOptions({
        capability: 'default_chat',
        provider: 'gateway',
        model: 'google/gemma-4-26b-a4b-it',
      }),
    ).toBeUndefined()
  })

  it('keeps Google thinking config for direct Google Gemini models', () => {
    expect(
      resolveDefaultChatProviderOptions({
        capability: 'default_chat',
        provider: 'google',
        model: 'gemini-3.1-flash-lite-preview',
      }),
    ).toEqual({
      google: {
        thinkingConfig: { thinkingLevel: 'medium' },
      },
    })
  })
})
