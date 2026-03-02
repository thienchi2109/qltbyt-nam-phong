import { google } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

const DEFAULT_PROVIDER = 'google'
const DEFAULT_MODEL = 'gemini-2.5-flash'

export function getChatModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER ?? DEFAULT_PROVIDER).toLowerCase()
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL

  switch (provider) {
    case 'google':
      return google(model as Parameters<typeof google>[0])
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
