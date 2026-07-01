import { callRpc } from "@/lib/rpc-client"

/** Zalo OA OAuth endpoint used to refresh short-lived access tokens from refresh tokens. */
export const ZALO_OA_ACCESS_TOKEN_ENDPOINT = "https://oauth.zaloapp.com/v4/oa/access_token"
/** Service-role RPC that reads durable ZBS/OA token state. */
export const ZBS_TOKEN_STATE_GET_RPC = "zbs_oauth_token_state_get"
/** Service-role RPC that atomically persists successful ZBS/OA token refresh state. */
export const ZBS_TOKEN_STATE_PERSIST_SUCCESS_RPC = "zbs_oauth_token_state_persist_success"
/** Service-role RPC that stores sanitized ZBS/OA token refresh error metadata. */
export const ZBS_TOKEN_STATE_RECORD_ERROR_RPC = "zbs_oauth_token_state_record_error"

type JsonObject = Record<string, unknown>
type ZbsRpcClient = (options: { fn: string; args: JsonObject }) => Promise<unknown>
type ZbsFetch = typeof fetch

const ZBS_TOKEN_PROVIDER = "zalo_zbs"
const NEAR_EXPIRY_WINDOW_MS = 10 * 60 * 1000
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 25 * 60 * 60
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60

interface ZbsTokenState {
  access_token?: string | null
  access_token_expires_at?: string | null
  refresh_token?: string | null
  refresh_token_expires_at?: string | null
}

interface ZaloTokenRefreshResponse {
  accessToken?: string
  refreshToken?: string
  expiresInSeconds?: number
  refreshExpiresInSeconds?: number
}

export interface ZbsAccessTokenManagerOptions {
  appId?: string
  appSecret?: string
  initialRefreshToken?: string
  now?: Date
  nearExpiryWindowMs?: number
  rpcClient?: ZbsRpcClient
  fetchImpl?: ZbsFetch
}

/** Sanitized token-refresh failure safe to map into outbox error metadata. */
export class ZbsAccessTokenRefreshError extends Error {
  readonly code: string
  readonly safeMessage: string
  readonly retryable: boolean

  constructor(input: { code: string; safeMessage: string; retryable: boolean }) {
    super(input.safeMessage)
    this.name = "ZbsAccessTokenRefreshError"
    this.code = input.code
    this.safeMessage = input.safeMessage
    this.retryable = input.retryable
  }
}

/** Narrows unknown errors to the sanitized token-refresh error type. */
export function isZbsAccessTokenRefreshError(error: unknown): error is ZbsAccessTokenRefreshError {
  return error instanceof ZbsAccessTokenRefreshError
}

/** Creates a lazy access-token provider for the dispatcher route. */
export function createZbsAccessTokenProvider(options: ZbsAccessTokenManagerOptions) {
  return () => getValidZbsAccessToken(options)
}

/** Returns a durable valid ZBS/OA access token, refreshing and persisting state when needed. */
export async function getValidZbsAccessToken(
  options: ZbsAccessTokenManagerOptions
): Promise<string> {
  const now = options.now ?? new Date()
  const rpcClient = options.rpcClient ?? callRpc
  const fetchImpl = options.fetchImpl ?? fetch
  const state = await readTokenState(rpcClient)
  const storedAccessToken = stringValue(state?.access_token)
  const storedAccessTokenExpiresAt = parseDate(state?.access_token_expires_at)
  const nearExpiryWindowMs = options.nearExpiryWindowMs ?? NEAR_EXPIRY_WINDOW_MS

  if (
    storedAccessToken &&
    storedAccessTokenExpiresAt &&
    storedAccessTokenExpiresAt.getTime() - now.getTime() > nearExpiryWindowMs
  ) {
    return storedAccessToken
  }

  const refreshToken = stringValue(state?.refresh_token) || stringValue(options.initialRefreshToken)
  if (!refreshToken) {
    const error = new ZbsAccessTokenRefreshError({
      code: "zalo_token_refresh_missing",
      safeMessage: "Missing Zalo ZBS refresh token",
      retryable: false,
    })
    await recordRefreshError(rpcClient, null, error, now)
    throw error
  }

  const refreshResult = await refreshAccessToken({
    appId: options.appId,
    appSecret: options.appSecret,
    refreshToken,
    fetchImpl,
  }).catch(async (error: unknown) => {
    const refreshError = normalizeRefreshError(error)
    await recordRefreshError(rpcClient, refreshToken, refreshError, now)
    throw refreshError
  })

  const newRefreshToken = refreshResult.refreshToken ?? refreshToken
  const accessTokenExpiresAt = addSeconds(
    now,
    refreshResult.expiresInSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS
  )
  const refreshTokenExpiresAt = addSeconds(
    now,
    refreshResult.refreshExpiresInSeconds ?? DEFAULT_REFRESH_TOKEN_TTL_SECONDS
  )

  await rpcClient({
    fn: ZBS_TOKEN_STATE_PERSIST_SUCCESS_RPC,
    args: {
      p_provider: ZBS_TOKEN_PROVIDER,
      p_previous_refresh_token: state?.refresh_token ? refreshToken : null,
      p_access_token: refreshResult.accessToken,
      p_access_token_expires_at: accessTokenExpiresAt.toISOString(),
      p_refresh_token: newRefreshToken,
      p_refresh_token_issued_at: now.toISOString(),
      p_refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
    },
  })

  return refreshResult.accessToken
}

async function readTokenState(rpcClient: ZbsRpcClient): Promise<ZbsTokenState | null> {
  const value = await rpcClient({
    fn: ZBS_TOKEN_STATE_GET_RPC,
    args: { p_provider: ZBS_TOKEN_PROVIDER },
  })

  if (Array.isArray(value)) {
    return isRecord(value[0]) ? (value[0] as ZbsTokenState) : null
  }

  return isRecord(value) ? (value as ZbsTokenState) : null
}

async function refreshAccessToken(options: {
  appId?: string
  appSecret?: string
  refreshToken: string
  fetchImpl: ZbsFetch
}): Promise<Required<Pick<ZaloTokenRefreshResponse, "accessToken">> & ZaloTokenRefreshResponse> {
  const appId = stringValue(options.appId)
  const appSecret = stringValue(options.appSecret)
  if (!appId || !appSecret) {
    throw new ZbsAccessTokenRefreshError({
      code: "zalo_token_refresh_config_missing",
      safeMessage: "Missing Zalo ZBS token refresh configuration",
      retryable: false,
    })
  }

  const body = new URLSearchParams({
    app_id: appId,
    grant_type: "refresh_token",
    refresh_token: options.refreshToken,
  })

  let response: Response
  try {
    response = await options.fetchImpl(ZALO_OA_ACCESS_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        secret_key: appSecret,
      },
      body,
    })
  } catch {
    throw new ZbsAccessTokenRefreshError({
      code: "zalo_token_refresh_network_error",
      safeMessage: "Zalo access token refresh failed",
      retryable: true,
    })
  }

  const responseBody = await readProviderJson(response)
  if (!response.ok) {
    throw new ZbsAccessTokenRefreshError({
      code: `zalo_token_refresh_http_${response.status}`,
      safeMessage: "Zalo access token refresh failed",
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
    })
  }

  const parsed = parseRefreshResponse(responseBody)
  if (hasProviderError(responseBody)) {
    throw new ZbsAccessTokenRefreshError({
      code: "zalo_token_refresh_failed",
      safeMessage: "Zalo access token refresh failed",
      retryable: false,
    })
  }

  if (!parsed.accessToken) {
    throw new ZbsAccessTokenRefreshError({
      code: "zalo_token_refresh_failed",
      safeMessage: "Zalo access token refresh failed",
      retryable: false,
    })
  }

  return {
    ...parsed,
    accessToken: parsed.accessToken,
  }
}

async function recordRefreshError(
  rpcClient: ZbsRpcClient,
  previousRefreshToken: string | null,
  error: ZbsAccessTokenRefreshError,
  errorAt: Date
) {
  await rpcClient({
    fn: ZBS_TOKEN_STATE_RECORD_ERROR_RPC,
    args: {
      p_provider: ZBS_TOKEN_PROVIDER,
      p_previous_refresh_token: previousRefreshToken,
      p_error_code: error.code,
      p_error_message: error.safeMessage,
      p_error_at: errorAt.toISOString(),
    },
  })
}

function normalizeRefreshError(error: unknown): ZbsAccessTokenRefreshError {
  if (isZbsAccessTokenRefreshError(error)) {
    return error
  }

  return new ZbsAccessTokenRefreshError({
    code: "zalo_token_refresh_failed",
    safeMessage: "Zalo access token refresh failed",
    retryable: true,
  })
}

async function readProviderJson(response: Response): Promise<JsonObject> {
  try {
    const value = await response.json()
    return isRecord(value) ? value : {}
  } catch {
    return {}
  }
}

function hasProviderError(response: JsonObject): boolean {
  const error = response.error
  if (typeof error === "number") {
    return error !== 0
  }

  return typeof error === "string" && error.trim() !== "" && error.trim() !== "0"
}

function parseRefreshResponse(response: JsonObject): ZaloTokenRefreshResponse {
  return {
    accessToken: stringValue(response.access_token),
    refreshToken: stringValue(response.refresh_token) || undefined,
    expiresInSeconds: positiveNumber(response.expires_in),
    refreshExpiresInSeconds: positiveNumber(response.refresh_expires_in),
  }
}

function positiveNumber(value: unknown): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseDate(value: unknown): Date | null {
  const text = stringValue(value)
  if (!text) {
    return null
  }

  const date = new Date(text)
  return Number.isFinite(date.getTime()) ? date : null
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
