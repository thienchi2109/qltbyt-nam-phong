import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import type { ProviderOptions } from '@ai-sdk/provider-utils'

import type { ResolvedDefaultChatConfig } from './config'

export type DefaultChatProviderOptions = ProviderOptions

function stripGooglePrefix(model: string): string {
  return model.startsWith('google/') ? model.slice('google/'.length) : model
}

function normalizeGoogleModelId(config: ResolvedDefaultChatConfig): string | null {
  if (config.provider === 'google') {
    return stripGooglePrefix(config.model)
  }

  if (config.model.startsWith('google/')) {
    return stripGooglePrefix(config.model)
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
