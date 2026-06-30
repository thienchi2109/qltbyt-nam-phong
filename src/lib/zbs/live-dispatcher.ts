import { callRpc } from "@/lib/rpc-client"

import {
  type ZbsNotificationOutboxRow,
  type ZbsTemplateRequest,
  ZALO_ZBS_PHONE_TEMPLATE_ENDPOINT,
  buildZbsTemplateRequest,
} from "./dispatcher"

/** Service-role RPC that atomically claims due ZBS outbox rows for live dispatch. */
export const ZBS_CLAIM_DISPATCH_RPC = "zbs_notification_outbox_claim_for_dispatch"
/** Service-role RPC that persists successful ZBS provider send metadata. */
export const ZBS_MARK_SENT_RPC = "zbs_notification_outbox_mark_sent"
/** Service-role RPC that persists retryable or final ZBS provider failures. */
export const ZBS_MARK_FAILED_RPC = "zbs_notification_outbox_mark_failed"

type JsonObject = Record<string, unknown>

type ZbsRpcClient = (options: { fn: string; args: JsonObject }) => Promise<unknown>
type ZbsFetch = typeof fetch
const ZALO_ZBS_FETCH_TIMEOUT_MS = 15_000
const ZALO_ZBS_DISPATCH_CONCURRENCY = 5

export interface DispatchPendingZbsNotificationsOptions {
  dispatchEnabled: boolean
  accessToken?: string
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

interface ZaloFailure {
  code: string
  message: string
  retryable: boolean
  providerResponse?: JsonObject
}

interface ZaloSuccess {
  providerMessageId: string
  sentAt: string
  providerResponse: JsonObject
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error"
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function sanitizeProviderResponse(value: unknown): JsonObject {
  if (!isRecord(value)) {
    return {}
  }

  return value
}

function getProviderData(response: JsonObject): JsonObject {
  return isRecord(response.data) ? response.data : response
}

function getProviderMessageId(response: JsonObject): string {
  const data = getProviderData(response)
  return stringValue(data.msg_id) || stringValue(response.msg_id)
}

function getProviderSentAt(response: JsonObject, fallback: Date): string {
  const data = getProviderData(response)
  const sentAt =
    stringValue(data.sent_at) || stringValue(data.sent_time) || stringValue(response.sent_at)
  return sentAt || fallback.toISOString()
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

async function dispatchRowsInChunks(
  rows: ZbsNotificationOutboxRow[],
  options: Parameters<typeof dispatchRow>[1]
): Promise<ZbsDispatchResult[]> {
  const results: ZbsDispatchResult[] = []

  for (let index = 0; index < rows.length; index += ZALO_ZBS_DISPATCH_CONCURRENCY) {
    const chunk = rows.slice(index, index + ZALO_ZBS_DISPATCH_CONCURRENCY)
    results.push(...(await Promise.all(chunk.map((row) => dispatchRow(row, options)))))
  }

  return results
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

  if (!options.accessToken || !options.repairTemplateId) {
    return summarizeResults("configuration-error", [])
  }

  const rows = await claimRows(rpcClient, { limit, now, outboxIds: options.outboxIds })
  const results = await dispatchRowsInChunks(rows, {
    accessToken: options.accessToken,
    repairTemplateId: options.repairTemplateId,
    appBaseUrl: options.appBaseUrl,
    now,
    rpcClient,
    fetchImpl,
  })

  return summarizeResults("live-dispatch", results)
}
