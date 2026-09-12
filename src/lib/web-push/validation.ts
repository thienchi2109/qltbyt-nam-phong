import { parseStrictJson, validateSubscriptionInput, type WebPushSubscriptionInput } from "./wire"

export type ConfigPutRequest = {
  donViId: string
  usernames: string[]
}
export type SubscriptionRegisterRequest = {
  vapidKeyVersion: string
  subscription: WebPushSubscriptionInput
}
export type SubscriptionRevokeRequest = {
  subscriptionId: string
  revision: string
}
export type ClaimRequest = {
  version: 1
  worker_id: string
  limit: number
  vapid_key_version: string
  vapid_fingerprint: string
}

export type ReportOutcome =
  | "accepted"
  | "endpoint_gone"
  | "transient"
  | "permanent"
  | "credential_error"
  | "not_sent_expired"
  | "not_sent_lease_expired"
  | "unsafe_endpoint"

export type ReportItem = {
  delivery_id: string
  attempt_token: string
  subscription_revision: string
  outcome: ReportOutcome
  provider_status: number | null
  retry_after_seconds: number | null
}

export type ReportRequest = {
  version: 1
  results: ReportItem[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const DECIMAL = /^[1-9][0-9]*$/
const WORKER_ID = /^[a-z0-9-]{1,64}$/
const VAPID_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const VAPID_FINGERPRINT = /^sha256:[0-9a-f]{64}$/
const MAX_BIGINT = BigInt("9223372036854775807")
const OUTCOMES = new Set<ReportOutcome>([
  "accepted",
  "endpoint_gone",
  "transient",
  "permanent",
  "credential_error",
  "not_sent_expired",
  "not_sent_lease_expired",
  "unsafe_endpoint",
])
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

function versionIsOne(value: unknown): value is 1 {
  return typeof value === "number" && Number.isInteger(value) && value === 1
}

/** Parses a positive integer value into its canonical decimal string. */
export function parsePositiveBigint(value: unknown): string | null {
  if (typeof value !== "string" || !DECIMAL.test(value)) return null
  try {
    const parsed = BigInt(value)
    return parsed <= MAX_BIGINT ? value : null
  } catch {
    return null
  }
}

/** Detects a numeric protocol version other than version one. */
export function isUnsupportedVersion(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version !== 1
  )
}

/** Validates a unit identifier from a query string. */
export function parseDonViId(value: string | null): string | null {
  return parsePositiveBigint(value)
}

/** Validates a recipient configuration mutation request. */
export function parseConfigPutRequest(value: unknown): ConfigPutRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "don_vi_id", "usernames"]) ||
    !versionIsOne(value.version)
  ) {
    return null
  }
  const donViId = parsePositiveBigint(value.don_vi_id)
  if (
    !donViId ||
    typeof value.usernames !== "string" ||
    new TextEncoder().encode(value.usernames).byteLength > 8192
  ) {
    return null
  }
  const inputNames = [
    ...new Set(
      value.usernames
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    ),
  ]
  if (inputNames.some((name) => new TextEncoder().encode(name).byteLength > 256)) return null
  const names = [...new Set(inputNames.map((name) => name.toLowerCase()))]
  if (names.length > 100 || names.some((name) => new TextEncoder().encode(name).byteLength > 256)) {
    return null
  }
  return { donViId, usernames: names }
}

/** Validates a browser subscription registration request. */
export function parseSubscriptionRegisterRequest(
  value: unknown
): SubscriptionRegisterRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "vapid_key_version", "subscription"]) ||
    !versionIsOne(value.version) ||
    typeof value.vapid_key_version !== "string" ||
    !VAPID_VERSION.test(value.vapid_key_version)
  ) {
    return null
  }
  try {
    return {
      vapidKeyVersion: value.vapid_key_version,
      subscription: validateSubscriptionInput(value.subscription),
    }
  } catch {
    return null
  }
}

/** Validates a browser subscription revoke request. */
export function parseSubscriptionRevokeRequest(value: unknown): SubscriptionRevokeRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "subscription_id", "revision"]) ||
    !versionIsOne(value.version)
  ) {
    return null
  }
  if (typeof value.subscription_id !== "string" || !UUID.test(value.subscription_id)) return null
  const revision = parsePositiveBigint(value.revision)
  return revision ? { subscriptionId: value.subscription_id, revision } : null
}

/** Validates a worker delivery claim request. */
export function parseClaimRequest(value: unknown): ClaimRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      "version",
      "worker_id",
      "limit",
      "vapid_key_version",
      "vapid_fingerprint",
    ]) ||
    !versionIsOne(value.version) ||
    typeof value.worker_id !== "string" ||
    !WORKER_ID.test(value.worker_id) ||
    typeof value.limit !== "number" ||
    !Number.isInteger(value.limit) ||
    value.limit < 1 ||
    value.limit > 5 ||
    typeof value.vapid_key_version !== "string" ||
    !VAPID_VERSION.test(value.vapid_key_version) ||
    typeof value.vapid_fingerprint !== "string" ||
    !VAPID_FINGERPRINT.test(value.vapid_fingerprint)
  ) {
    return null
  }
  return value as ClaimRequest
}

function validProviderStatus(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599)
  )
}

function validRetryAfter(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 86400)
  )
}

function isUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" && !Number.isNaN(Date.parse(value)) && /(?:Z|[+-]00:00)$/.test(value)
  )
}

function validOutcomeCombination(item: ReportItem): boolean {
  const status = item.provider_status
  if (item.outcome === "accepted") return status !== null && status >= 200 && status <= 299
  if (item.outcome === "endpoint_gone") return status === 404 || status === 410
  if (item.outcome === "transient")
    return status === null || status === 408 || status === 429 || status >= 500
  if (item.outcome === "credential_error") return status === 401 || status === 403
  if (item.outcome === "permanent") {
    return (
      status !== null &&
      status >= 300 &&
      status <= 499 &&
      ![401, 403, 404, 408, 410, 429].includes(status)
    )
  }
  return status === null
}

/** Validates a worker delivery report request. */
export function parseReportRequest(value: unknown): ReportRequest | null {
  if (!isRecord(value) || !exactKeys(value, ["version", "results"]) || !versionIsOne(value.version))
    return null
  if (!Array.isArray(value.results) || value.results.length > 5) return null
  const results: ReportItem[] = []
  for (const item of value.results) {
    if (
      !isRecord(item) ||
      !exactKeys(item, [
        "delivery_id",
        "attempt_token",
        "subscription_revision",
        "outcome",
        "provider_status",
        "retry_after_seconds",
      ]) ||
      typeof item.delivery_id !== "string" ||
      !UUID.test(item.delivery_id) ||
      typeof item.attempt_token !== "string" ||
      !UUID.test(item.attempt_token) ||
      typeof item.subscription_revision !== "string" ||
      !parsePositiveBigint(item.subscription_revision) ||
      typeof item.outcome !== "string" ||
      !OUTCOMES.has(item.outcome as ReportOutcome) ||
      !validProviderStatus(item.provider_status) ||
      !validRetryAfter(item.retry_after_seconds)
    ) {
      return null
    }
    const parsed = item as ReportItem
    if (!validOutcomeCombination(parsed)) return null
    results.push(parsed)
  }
  return { version: 1, results }
}

/** Validates and narrows a delivery claim response envelope. */
export function validateClaimResponse(value: unknown): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "server_time", "poll_after_seconds", "deliveries"]) ||
    value.version !== 1 ||
    !isUtcTimestamp(value.server_time) ||
    value.poll_after_seconds !== 5
  ) {
    return null
  }
  if (!Array.isArray(value.deliveries) || value.deliveries.length > 5) return null
  for (const delivery of value.deliveries) {
    if (
      !isRecord(delivery) ||
      !exactKeys(delivery, [
        "delivery_id",
        "attempt_token",
        "attempt",
        "subscription_id",
        "subscription_revision",
        "lease_expires_at",
        "deadline",
        "ttl_seconds",
        "vapid_key_version",
        "endpoint",
        "keys",
        "payload_base64",
      ]) ||
      typeof delivery.delivery_id !== "string" ||
      !UUID.test(delivery.delivery_id) ||
      typeof delivery.attempt_token !== "string" ||
      !UUID.test(delivery.attempt_token) ||
      typeof delivery.attempt !== "number" ||
      !Number.isInteger(delivery.attempt) ||
      delivery.attempt < 1 ||
      delivery.attempt > 100 ||
      typeof delivery.subscription_id !== "string" ||
      !UUID.test(delivery.subscription_id) ||
      !parsePositiveBigint(delivery.subscription_revision) ||
      !isUtcTimestamp(delivery.lease_expires_at) ||
      !isUtcTimestamp(delivery.deadline) ||
      typeof delivery.ttl_seconds !== "number" ||
      !Number.isInteger(delivery.ttl_seconds) ||
      delivery.ttl_seconds < 0 ||
      delivery.ttl_seconds > 86400 ||
      typeof delivery.vapid_key_version !== "string" ||
      !VAPID_VERSION.test(delivery.vapid_key_version) ||
      typeof delivery.endpoint !== "string" ||
      !isRecord(delivery.keys) ||
      typeof delivery.payload_base64 !== "string"
    ) {
      return null
    }
    try {
      validateSubscriptionInput({ endpoint: delivery.endpoint, keys: delivery.keys })
      if (
        delivery.payload_base64.length > 4096 ||
        !BASE64.test(delivery.payload_base64) ||
        delivery.payload_base64.length % 4 !== 0
      ) {
        return null
      }
      const payloadBytes = Buffer.from(delivery.payload_base64, "base64")
      if (payloadBytes.toString("base64") !== delivery.payload_base64 || payloadBytes.length > 3072)
        return null
      const payloadText = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes)
      const payload = parseStrictJson(payloadText, 3072)
      if (
        !isRecord(payload) ||
        !exactKeys(payload, ["version", "notification_id", "title", "body", "url", "tag"]) ||
        payload.version !== 1 ||
        typeof payload.notification_id !== "string" ||
        !UUID.test(payload.notification_id) ||
        typeof payload.title !== "string" ||
        typeof payload.body !== "string" ||
        typeof payload.url !== "string" ||
        !payload.url.startsWith("/repair-requests?") ||
        payload.url.includes("\\") ||
        typeof payload.tag !== "string" ||
        !payload.tag.startsWith("repair-request:")
      ) {
        return null
      }
    } catch {
      return null
    }
  }
  return value
}

/** Validates and narrows a delivery report response envelope. */
export function validateReportResponse(value: unknown): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "results"]) ||
    value.version !== 1 ||
    !Array.isArray(value.results) ||
    value.results.length > 5
  ) {
    return null
  }
  if (
    value.results.some(
      (item) =>
        !isRecord(item) ||
        !exactKeys(item, ["delivery_id", "result"]) ||
        typeof item.delivery_id !== "string" ||
        !UUID.test(item.delivery_id) ||
        (item.result !== "applied" && item.result !== "duplicate" && item.result !== "stale")
    )
  ) {
    return null
  }
  return value
}

/** Validates and narrows a recipient configuration response envelope. */
export function validateConfigResponse(value: unknown): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "don_vi_id", "recipients"]) ||
    value.version !== 1
  )
    return null
  if (
    !parsePositiveBigint(value.don_vi_id) ||
    !Array.isArray(value.recipients) ||
    value.recipients.length > 100
  )
    return null
  if (
    value.recipients.some(
      (recipient) =>
        !isRecord(recipient) ||
        !exactKeys(recipient, ["user_id", "username"]) ||
        !parsePositiveBigint(recipient.user_id) ||
        typeof recipient.username !== "string"
    )
  ) {
    return null
  }
  return value
}

/** Validates and narrows a subscription registration response envelope. */
export function validateSubscriptionRegisterResponse(
  value: unknown
): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "subscription_id", "revision"]) ||
    value.version !== 1 ||
    typeof value.subscription_id !== "string" ||
    !UUID.test(value.subscription_id) ||
    !parsePositiveBigint(value.revision)
  ) {
    return null
  }
  return value
}

/** Validates and narrows a subscription revoke response envelope. */
export function validateSubscriptionRevokeResponse(value: unknown): Record<string, unknown> | null {
  return isRecord(value) &&
    exactKeys(value, ["version", "revoked"]) &&
    value.version === 1 &&
    value.revoked === true
    ? value
    : null
}
