import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import type { ProviderOptions } from '@ai-sdk/provider-utils'

import type { ResolvedDefaultChatConfig } from './config'

export type DefaultChatProviderOptions = ProviderOptions

function normalizeGoogleModelId(config: ResolvedDefaultChatConfig): string | null {
  if (config.provider === 'google') {
    return config.model
  }

  if (config.model.startsWith('google/')) {
    return config.model.slice('google/'.length)
  }

  return null
}

export function resolveDefaultChatProviderOptions(
  config: ResolvedDefaultChatConfig,
): DefaultChatProviderOptions | undefined {
  const googleModelId = normalizeGoogleModelId(config)
  if (googleModelId === null || !googleModelId.startsWith('gemini-')) {
    return undefined
  }

  return {
    google: {
      thinkingConfig: { thinkingLevel: 'medium' },
    } satisfies GoogleLanguageModelOptions,
  }
}
