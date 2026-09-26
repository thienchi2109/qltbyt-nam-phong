import "server-only"

/** Server-only configuration for the dark shared AI BFF path. */
export interface GoBffConfig {
  endpoint: string
  hmacKeyId: string
  hmacSecret: string
  brokerSecret: string
  cloudflareClientId: string
  cloudflareClientSecret: string
}

type Environment = Record<string, string | undefined>

class GoBffConfigurationError extends Error {
  constructor() {
    super("Shared AI service dark path configuration is unavailable.")
    this.name = "GoBffConfigurationError"
  }
}

function readFirst(environment: Environment, keys: string[]): string {
  for (const key of keys) {
    const value = environment[key]?.trim()
    if (value) {
      return value
    }
  }
  return ""
}

function readEndpoint(environment: Environment): string {
  const value = readFirst(environment, ["AI_SERVICE_BFF_URL", "AI_SERVICE_URL"])
  if (!value) {
    throw new GoBffConfigurationError()
  }

  try {
    const url = new URL(value)
    if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) {
      throw new Error("invalid endpoint")
    }
    url.pathname = "/v1/chat"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    throw new GoBffConfigurationError()
  }
}

/**
 * Reads only server-side names. Missing values deliberately throw a generic
 * error so secrets never reach a browser response or operational log.
 */
export function readGoBffConfig(environment: Environment = process.env): GoBffConfig {
  const config = {
    endpoint: readEndpoint(environment),
    hmacKeyId: readFirst(environment, ["AI_SERVICE_BFF_HMAC_KEY_ID", "AI_SERVICE_HMAC_KEY_ID"]),
    hmacSecret: readFirst(environment, ["AI_SERVICE_BFF_HMAC_SECRET", "AI_SERVICE_HMAC_SECRET"]),
    brokerSecret: readFirst(environment, [
      "AI_SERVICE_BFF_BROKER_SECRET",
      "AI_SERVICE_BROKER_SECRET",
    ]),
    cloudflareClientId: readFirst(environment, [
      "AI_SERVICE_BFF_CF_ACCESS_CLIENT_ID",
      "AI_SERVICE_CF_ACCESS_CLIENT_ID",
      "CLOUDFLARE_ACCESS_CLIENT_ID",
    ]),
    cloudflareClientSecret: readFirst(environment, [
      "AI_SERVICE_BFF_CF_ACCESS_CLIENT_SECRET",
      "AI_SERVICE_CF_ACCESS_CLIENT_SECRET",
      "CLOUDFLARE_ACCESS_CLIENT_SECRET",
    ]),
  }

  if (Object.values(config).some((value) => !value)) {
    throw new GoBffConfigurationError()
  }

  return config
}

/** Identifies configuration failures that should fail closed at the BFF boundary. */
export function isGoBffConfigurationError(error: unknown): boolean {
  return error instanceof GoBffConfigurationError
}
