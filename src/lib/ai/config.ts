export type AiChatCapability = 'default_chat'
export type AiProviderTransport = 'gateway' | 'google'

export interface ResolvedDefaultChatConfig {
  capability: AiChatCapability
  provider: AiProviderTransport
  model: string
}

const DEFAULT_PROVIDER: AiProviderTransport = 'gateway'
const DEFAULT_MODEL = 'google/gemini-3.1-flash-lite-preview'

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim()
  return value ? value : undefined
}

function hasProviderPrefix(model: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\/.+$/i.test(model)
}

export function resolveDefaultChatProvider(env: NodeJS.ProcessEnv = process.env): string {
  return (readEnv(env, 'AI_DEFAULT_CHAT_PROVIDER') ?? readEnv(env, 'AI_PROVIDER') ?? DEFAULT_PROVIDER)
    .toLowerCase()
}

function resolveModel(env: NodeJS.ProcessEnv): string {
  return readEnv(env, 'AI_DEFAULT_CHAT_MODEL') ?? readEnv(env, 'AI_MODEL') ?? DEFAULT_MODEL
}

export function loadGoogleApiKeys(env: NodeJS.ProcessEnv = process.env): string[] {
  const pool = readEnv(env, 'GOOGLE_GENERATIVE_AI_API_KEYS')
  if (pool) {
    const keys = pool
      .split(',')
      .map(key => key.trim())
      .filter(Boolean)
    if (keys.length > 0) return keys
  }

  const single = readEnv(env, 'GOOGLE_GENERATIVE_AI_API_KEY')
  return single ? [single] : []
}

export function resolveDefaultChatConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResolvedDefaultChatConfig {
  const provider = resolveDefaultChatProvider(env)
  const model = resolveModel(env)

  if (provider === 'gateway') {
    if (!hasProviderPrefix(model)) {
      throw new Error(
        'AI_DEFAULT_CHAT_MODEL must be a provider-prefixed model id when provider is gateway',
      )
    }

    return {
      capability: 'default_chat',
      provider,
      model,
    }
  }

  if (provider === 'google') {
    return {
      capability: 'default_chat',
      provider,
      model,
    }
  }

  throw new Error(
    `Unsupported direct AI provider: ${provider}. Use AI_DEFAULT_CHAT_PROVIDER=gateway with a provider-prefixed model id.`,
  )
}

export function assertDefaultChatCredentials(
  config: ResolvedDefaultChatConfig,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (config.provider === 'gateway' && !readEnv(env, 'AI_GATEWAY_API_KEY')) {
    throw new Error('AI_GATEWAY_API_KEY is required for AI gateway mode')
  }

  if (config.provider === 'google' && loadGoogleApiKeys(env).length === 0) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEYS is required for direct Google mode',
    )
  }
}
