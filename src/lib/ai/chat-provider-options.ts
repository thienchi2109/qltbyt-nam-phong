import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import type { ProviderOptions } from '@ai-sdk/provider-utils'

import type { SupportedAiProvider } from './provider'

export function getChatProviderOptions(
  provider: SupportedAiProvider,
): ProviderOptions | undefined {
  switch (provider) {
    case 'google':
      return {
        google: {
          thinkingConfig: { thinkingLevel: 'medium' },
        } satisfies GoogleLanguageModelOptions,
      }
    case 'groq':
      return undefined
  }
}
