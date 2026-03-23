import type { GoogleLanguageModelOptions } from '@ai-sdk/google'

const DEFAULT_PROVIDER = 'google'
const DEFAULT_GOOGLE_MODEL = 'gemini-3-flash-preview'

export function getChatProviderOptions(): {
  provider: string
  configuredModel: string
  providerOptions?: Record<string, unknown>
} {
  const provider = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase()

  switch (provider) {
    case 'google':
      return {
        provider,
        configuredModel:
          process.env.GOOGLE_GENERATIVE_AI_MODEL ?? process.env.AI_MODEL ?? DEFAULT_GOOGLE_MODEL,
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: 'medium' },
          } satisfies GoogleLanguageModelOptions,
        },
      }
    case 'groq': {
      const configuredModel = process.env.GROQ_MODEL?.trim()
      if (!configuredModel) {
        throw new Error('Missing Groq model configuration: set GROQ_MODEL')
      }

      return { provider, configuredModel }
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
