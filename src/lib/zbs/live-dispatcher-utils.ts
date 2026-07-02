import { sanitizeForLog } from "@/lib/log-sanitizer"

export type JsonObject = Record<string, unknown>

export interface ZaloFailure {
  code: string
  message: string
  retryable: boolean
  providerResponse?: JsonObject
}

export interface ZaloSuccess {
  providerMessageId: string
  sentAt: string
  providerResponse: JsonObject
}

const DISPATCH_ROW_ERROR_MESSAGE = "Unexpected ZBS dispatch row failure"
const SENSITIVE_ERROR_TEXT_PATTERN =
  /\b(token|secret|password|authorization|credential|api[_ -]?key|apikey)\b/i
const MIN_REASONABLE_EPOCH_MILLISECONDS = 1_000_000_000_000

/** Checks whether an unknown provider value is a non-array object. */
export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Returns a safe fallback message for unknown dispatcher errors. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error"
}

/** Trims string values while rejecting non-string provider fields. */
export function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** Reads finite numeric provider fields without coercion. */
export function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** Keeps provider JSON object metadata and drops non-object payloads. */
export function sanitizeProviderResponse(value: unknown): JsonObject {
  if (!isRecord(value)) {
    return {}
  }

  return value
}

/** Surfaces safe row-level dispatch errors while hiding sensitive-looking text. */
export function safeDispatchRowErrorMessage(error: unknown): string {
  const sanitized = sanitizeForLog(error)
  let message = errorMessage(error)

  if (typeof sanitized === "string") {
    message = sanitized
  } else if (isRecord(sanitized)) {
    message = stringValue(sanitized.message)
  }

  if (!message || SENSITIVE_ERROR_TEXT_PATTERN.test(message)) {
    return DISPATCH_ROW_ERROR_MESSAGE
  }

  return message
}

function getProviderData(response: JsonObject): JsonObject {
  return isRecord(response.data) ? response.data : response
}

/** Extracts the Zalo provider message id from supported response shapes. */
export function getProviderMessageId(response: JsonObject): string {
  const data = getProviderData(response)
  return stringValue(data.msg_id) || stringValue(response.msg_id)
}

function parseProviderTimestamp(value: unknown, fallback: Date): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(normalizeEpochTimestamp(value))
    return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
  }

  const text = stringValue(value)
  if (!text) {
    return fallback.toISOString()
  }

  if (/^\d+$/.test(text)) {
    const parsed = new Date(normalizeEpochTimestamp(Number(text)))
    return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString()
}

function normalizeEpochTimestamp(value: number): number {
  return value < MIN_REASONABLE_EPOCH_MILLISECONDS ? value * 1000 : value
}

/** Normalizes Zalo sent timestamps to ISO strings before RPC persistence. */
export function getProviderSentAt(response: JsonObject, fallback: Date): string {
  const data = getProviderData(response)
  return parseProviderTimestamp(data.sent_at ?? data.sent_time ?? response.sent_at, fallback)
}
