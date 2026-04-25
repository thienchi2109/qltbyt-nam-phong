export type AiChatCapability = 'default_chat'
export type AiProviderTransport = 'gateway' | 'google' | 'openai-compatible'

export interface ResolvedDefaultChatConfig {
  capability: AiChatCapability
  provider: AiProviderTransport
  model: string
}

const DEFAULT_PROVIDER: AiProviderTransport = 'gateway'
const DEFAULT_GATEWAY_MODEL = 'google/gemini-3.1-flash-lite-preview'
const DEFAULT_GOOGLE_MODEL = 'gemini-3.1-flash-lite-preview'

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim()
  return value ? value : undefined
}

export function readOpenAICompatibleBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return readEnv(env, 'AI_OPENAI_COMPATIBLE_BASE_URL')
}

export function readOpenAICompatibleApiKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return readEnv(env, 'AI_OPENAI_COMPATIBLE_API_KEY')
}

function hasProviderPrefix(model: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\/.+$/i.test(model)
}

export function resolveDefaultChatProvider(env: NodeJS.ProcessEnv = process.env): string {
  const explicitProvider = readEnv(env, 'AI_DEFAULT_CHAT_PROVIDER') ?? readEnv(env, 'AI_PROVIDER')
  if (explicitProvider) return explicitProvider.toLowerCase()

  // Preserve legacy deployments that only configured AI_MODEL under the old
  // implicit Google provider contract.
  if (readEnv(env, 'AI_MODEL') && !readEnv(env, 'AI_DEFAULT_CHAT_MODEL')) {
    return 'google'
  }

  // Preserve the old minimal setup where a deployment only provided Google API
  // key env vars and relied on the implicit Google provider.
  if (loadGoogleApiKeys(env).length > 0 && !readEnv(env, 'AI_DEFAULT_CHAT_MODEL')) {
    return 'google'
  }

  return DEFAULT_PROVIDER
    .toLowerCase()
}

function resolveModel(env: NodeJS.ProcessEnv, provider: string): string {
  const explicitModel = readEnv(env, 'AI_DEFAULT_CHAT_MODEL') ?? readEnv(env, 'AI_MODEL')
  if (explicitModel) return explicitModel

  return provider === 'google' ? DEFAULT_GOOGLE_MODEL : DEFAULT_GATEWAY_MODEL
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
  const model = resolveModel(env, provider)

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

  if (provider === 'openai-compatible') {
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

  if (config.provider === 'openai-compatible' && !readOpenAICompatibleBaseUrl(env)) {
    throw new Error('AI_OPENAI_COMPATIBLE_BASE_URL is required for openai-compatible mode')
  }

  if (config.provider === 'openai-compatible' && !readOpenAICompatibleApiKey(env)) {
    throw new Error('AI_OPENAI_COMPATIBLE_API_KEY is required for openai-compatible mode')
  }
}
