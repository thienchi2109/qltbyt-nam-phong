import { callRpc } from "@/lib/rpc-client"

import { isZbsAccessTokenRefreshError } from "./access-token-manager"
import {
  type ZbsNotificationOutboxRow,
  type ZbsTemplateRequest,
  ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT,
  buildZbsTemplateRequest,
} from "./dispatcher"
import {
  type JsonObject,
  type ZaloFailure,
  type ZaloSuccess,
  errorMessage,
  getProviderMessageId,
  getProviderSentAt,
  numberValue,
  safeDispatchRowErrorMessage,
  sanitizeProviderResponse,
  stringValue,
} from "./live-dispatcher-utils"

/** Service-role RPC that atomically claims due ZBS outbox rows for live dispatch. */
export const ZBS_CLAIM_DISPATCH_RPC = "zbs_notification_outbox_claim_for_dispatch"
/** Service-role RPC that persists successful ZBS provider send metadata. */
export const ZBS_MARK_SENT_RPC = "zbs_notification_outbox_mark_sent"
/** Service-role RPC that persists retryable or final ZBS provider failures. */
export const ZBS_MARK_FAILED_RPC = "zbs_notification_outbox_mark_failed"

type ZbsRpcClient = (options: { fn: string; args: JsonObject }) => Promise<unknown>
type ZbsFetch = typeof fetch
type ZbsAccessTokenProvider = () => Promise<string>
const ZALO_ZBS_FETCH_TIMEOUT_MS = 15_000
const ZALO_ZBS_DISPATCH_CONCURRENCY = 5

export interface DispatchPendingZbsNotificationsOptions {
  dispatchEnabled: boolean
  accessToken?: string
  accessTokenProvider?: ZbsAccessTokenProvider
  repairTemplateId?: string
  appBaseUrl?: string
  outboxIds?: string[]
  limit?: number
  now?: Date
  rpcClient?: ZbsRpcClient
  fetchImpl?: ZbsFetch
}

export interface ZbsDispatchResult {
  outbox_id: string
  status: "sent" | "retryable_failed" | "failed"
  provider_message_id?: string
  error_code?: string
  error_message?: string
}

export interface ZbsDispatchRunResult {
  dispatch_state: "disabled-dispatch" | "live-dispatch" | "configuration-error"
  attempted: number
  sent: number
  retryable_failed: number
  failed: number
  results: ZbsDispatchResult[]
}

function classifyHttpFailure(response: Response): ZaloFailure {
  const retryable = response.status === 408 || response.status === 429 || response.status >= 500
  return {
    code: `http_${response.status}`,
    message: `Zalo ZBS HTTP ${response.status}`,
    retryable,
    providerResponse: {
      http_status: response.status,
      status_text: response.statusText,
    },
  }
}

function classifyProviderFailure(response: JsonObject): ZaloFailure | null {
  const errorCode = numberValue(response.error)
  if (errorCode === null || errorCode === 0) {
    return null
  }

  return {
    code: `zalo_${errorCode}`,
    message: stringValue(response.message) || "Zalo ZBS provider error",
    retryable: false,
    providerResponse: sanitizeProviderResponse(response),
  }
}

function classifyRequestBuildFailure(error: unknown): ZaloFailure {
  return {
    code: "invalid_template_request",
    message: errorMessage(error),
    retryable: false,
    providerResponse: {},
  }
}

function classifyAccessTokenFailure(error: unknown): ZaloFailure {
  if (isZbsAccessTokenRefreshError(error)) {
    return {
      code: error.code,
      message: error.safeMessage,
      retryable: error.retryable,
      providerResponse: {},
    }
  }

  return {
    code: "zalo_token_unavailable",
    message: "Failed to load Zalo ZBS access token",
    retryable: true,
    providerResponse: {},
  }
}

function parseSuccess(response: JsonObject, now: Date): ZaloSuccess {
  const providerMessageId = getProviderMessageId(response)
  if (!providerMessageId) {
    throw new Error("Missing Zalo provider msg_id")
  }

  return {
    providerMessageId,
    sentAt: getProviderSentAt(response, now),
    providerResponse: sanitizeProviderResponse(response),
  }
}

async function readProviderJson(response: Response): Promise<JsonObject> {
  try {
    const value = await response.json()
    return sanitizeProviderResponse(value)
  } catch {
    return {}
  }
}

async function claimRows(
  rpcClient: ZbsRpcClient,
  options: Required<Pick<DispatchPendingZbsNotificationsOptions, "limit" | "now">> &
    Pick<DispatchPendingZbsNotificationsOptions, "outboxIds">
): Promise<ZbsNotificationOutboxRow[]> {
  const outboxIds = options.outboxIds
  const rows = await rpcClient({
    fn: ZBS_CLAIM_DISPATCH_RPC,
    args: {
      p_limit: options.limit,
      p_now: options.now.toISOString(),
      p_outbox_ids: outboxIds === undefined ? null : outboxIds,
    },
  })

  return Array.isArray(rows) ? (rows as ZbsNotificationOutboxRow[]) : []
}

async function markSent(
  rpcClient: ZbsRpcClient,
  row: ZbsNotificationOutboxRow,
  success: ZaloSuccess
) {
  await rpcClient({
    fn: ZBS_MARK_SENT_RPC,
    args: {
      p_id: row.id,
      p_claimed_at: row.last_attempt_at ?? null,
      p_provider_message_id: success.providerMessageId,
      p_sent_at: success.sentAt,
      p_provider_response: success.providerResponse,
    },
  })
}

async function markFailed(
  rpcClient: ZbsRpcClient,
  row: ZbsNotificationOutboxRow,
  failure: ZaloFailure
) {
  await rpcClient({
    fn: ZBS_MARK_FAILED_RPC,
    args: {
      p_id: row.id,
      p_claimed_at: row.last_attempt_at ?? null,
      p_retryable: failure.retryable,
      p_error_code: failure.code,
      p_error_message: failure.message,
      p_provider_response: failure.providerResponse ?? {},
    },
  })
}

async function sendZbsTemplateRequest(
  fetchImpl: ZbsFetch,
  request: ZbsTemplateRequest,
  now: Date
): Promise<ZaloSuccess | ZaloFailure> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ZALO_ZBS_FETCH_TIMEOUT_MS)

  try {
    const response = await fetchImpl(request.endpoint, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        access_token: request.headers.access_token,
      },
      body: JSON.stringify(request.body),
      signal: controller.signal,
    })

    if (!response.ok) {
      return classifyHttpFailure(response)
    }

    const responseBody = await readProviderJson(response)
    const providerFailure = classifyProviderFailure(responseBody)
    if (providerFailure) {
      return providerFailure
    }

    try {
      return parseSuccess(responseBody, now)
    } catch (error) {
      return {
        code: "invalid_provider_response",
        message: errorMessage(error),
        retryable: false,
        providerResponse: responseBody,
      }
    }
  } catch (error) {
    return {
      code: "network_error",
      message: errorMessage(error),
      retryable: true,
      providerResponse: {},
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function summarizeResults(
  dispatchState: ZbsDispatchRunResult["dispatch_state"],
  results: ZbsDispatchResult[]
): ZbsDispatchRunResult {
  return {
    dispatch_state: dispatchState,
    attempted: results.length,
    sent: results.filter((result) => result.status === "sent").length,
    retryable_failed: results.filter((result) => result.status === "retryable_failed").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  }
}

async function dispatchRow(
  row: ZbsNotificationOutboxRow,
  options: Pick<
    Required<DispatchPendingZbsNotificationsOptions>,
    "accessToken" | "repairTemplateId" | "now" | "rpcClient" | "fetchImpl"
  > &
    Pick<DispatchPendingZbsNotificationsOptions, "appBaseUrl">
): Promise<ZbsDispatchResult> {
  let request: ZbsTemplateRequest
  try {
    request = buildZbsTemplateRequest(row, {
      appBaseUrl: options.appBaseUrl,
      accessTokenHeader: options.accessToken,
      repairTemplateId: options.repairTemplateId,
    })
  } catch (error) {
    const failure = classifyRequestBuildFailure(error)
    await markFailed(options.rpcClient, row, failure)
    return {
      outbox_id: row.id,
      status: "failed",
      error_code: failure.code,
      error_message: failure.message,
    }
  }

  const sendResult = await sendZbsTemplateRequest(options.fetchImpl, request, options.now)

  if ("providerMessageId" in sendResult) {
    await markSent(options.rpcClient, row, sendResult)
    return {
      outbox_id: row.id,
      status: "sent",
      provider_message_id: sendResult.providerMessageId,
    }
  }

  await markFailed(options.rpcClient, row, sendResult)
  return {
    outbox_id: row.id,
    status: sendResult.retryable ? "retryable_failed" : "failed",
    error_code: sendResult.code,
    error_message: sendResult.message,
  }
}

function failedDispatchRowResult(row: ZbsNotificationOutboxRow, error: unknown): ZbsDispatchResult {
  return {
    outbox_id: row.id,
    status: "failed",
    error_code: "dispatch_row_error",
    error_message: safeDispatchRowErrorMessage(error),
  }
}

async function dispatchRowsInChunks(
  rows: ZbsNotificationOutboxRow[],
  options: Parameters<typeof dispatchRow>[1]
): Promise<ZbsDispatchResult[]> {
  const results: ZbsDispatchResult[] = []

  for (let index = 0; index < rows.length; index += ZALO_ZBS_DISPATCH_CONCURRENCY) {
    const chunk = rows.slice(index, index + ZALO_ZBS_DISPATCH_CONCURRENCY)
    const settledResults = await Promise.allSettled(chunk.map((row) => dispatchRow(row, options)))
    results.push(
      ...settledResults.map((result, resultIndex) =>
        result.status === "fulfilled"
          ? result.value
          : failedDispatchRowResult(chunk[resultIndex], result.reason)
      )
    )
  }

  return results
}

async function markRowsFailedForAccessTokenFailure(
  rows: ZbsNotificationOutboxRow[],
  rpcClient: ZbsRpcClient,
  error: unknown
): Promise<ZbsDispatchResult[]> {
  const failure = classifyAccessTokenFailure(error)
  const settledResults: PromiseSettledResult<ZbsDispatchResult>[] = []

  for (let index = 0; index < rows.length; index += ZALO_ZBS_DISPATCH_CONCURRENCY) {
    const chunk = rows.slice(index, index + ZALO_ZBS_DISPATCH_CONCURRENCY)
    settledResults.push(
      ...(await Promise.allSettled(
        chunk.map(async (row): Promise<ZbsDispatchResult> => {
          await markFailed(rpcClient, row, failure)
          return {
            outbox_id: row.id,
            status: failure.retryable ? "retryable_failed" : "failed",
            error_code: failure.code,
            error_message: failure.message,
          }
        })
      ))
    )
  }

  const markFailure = settledResults.find((result) => result.status === "rejected")
  if (markFailure) {
    throw new Error("Failed to persist ZBS token refresh failure state")
  }

  return settledResults.map((result) => {
    if (result.status === "fulfilled") {
      return result.value
    }
    throw new Error("Unexpected rejected ZBS token refresh failure result")
  })
}

/** Sends claimed ZBS repair-request notifications when the dispatch gate is enabled. */
export async function dispatchPendingZbsNotifications(
  options: DispatchPendingZbsNotificationsOptions
): Promise<ZbsDispatchRunResult> {
  const now = options.now ?? new Date()
  const limit = options.limit ?? 25
  const rpcClient = options.rpcClient ?? callRpc
  const fetchImpl = options.fetchImpl ?? fetch

  if (!options.dispatchEnabled) {
    return summarizeResults("disabled-dispatch", [])
  }

  if ((!options.accessToken && !options.accessTokenProvider) || !options.repairTemplateId) {
    return summarizeResults("configuration-error", [])
  }

  const rows = await claimRows(rpcClient, { limit, now, outboxIds: options.outboxIds })
  if (rows.length === 0) {
    return summarizeResults("live-dispatch", [])
  }

  let accessToken = options.accessToken
  if (!accessToken && options.accessTokenProvider) {
    try {
      accessToken = await options.accessTokenProvider()
    } catch (error) {
      const results = await markRowsFailedForAccessTokenFailure(rows, rpcClient, error)
      return summarizeResults("live-dispatch", results)
    }
  }

  if (!accessToken) {
    const results = await markRowsFailedForAccessTokenFailure(rows, rpcClient, null)
    return summarizeResults("live-dispatch", results)
  }

  const results = await dispatchRowsInChunks(rows, {
    accessToken,
    repairTemplateId: options.repairTemplateId,
    appBaseUrl: options.appBaseUrl,
    now,
    rpcClient,
    fetchImpl,
  })

  return summarizeResults("live-dispatch", results)
}
