import {
  buildRepairRequestViewHref,
  REPAIR_REQUESTS_PATH,
  REPAIR_REQUEST_VIEW_ACTION,
} from "../repair-request-deep-link"
import { exactKeys, isRecord, parsePositiveBigint, versionIsOne } from "./validation-common"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ELLIPSIS = "…"
const TITLE_MAX_BYTES = 256
const BODY_MAX_BYTES = 2057

export type WebPushNotificationPayload = {
  notificationId: string
  title: string
  body: string
  url: string
  tag: string
}

/** Truncates text by UTF-8 bytes without splitting a Unicode code point. */
export function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return ""
  const encoder = new TextEncoder()
  if (encoder.encode(value).byteLength <= maxBytes) return value

  const suffixBytes = encoder.encode(ELLIPSIS).byteLength
  let result = ""
  for (const character of value) {
    const candidate = result + character
    if (encoder.encode(candidate + ELLIPSIS).byteLength > maxBytes) break
    result = candidate
  }

  if (suffixBytes > maxBytes) {
    result = ""
    for (const character of value) {
      const candidate = result + character
      if (encoder.encode(candidate).byteLength > maxBytes) break
      result = candidate
    }
    return result
  }

  return result + ELLIPSIS
}

function parseRepairRequestUrl(value: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null

  let url: URL
  try {
    url = new URL(value, "https://worker.invalid")
  } catch {
    return null
  }
  if (url.origin !== "https://worker.invalid" || url.pathname !== REPAIR_REQUESTS_PATH || url.hash)
    return null

  const params = [...url.searchParams.entries()]
  const requestId = url.searchParams.get("requestId")
  const parsedRequestId = parsePositiveBigint(requestId)
  if (
    params.length !== 2 ||
    url.searchParams.get("action") !== REPAIR_REQUEST_VIEW_ACTION ||
    !parsedRequestId ||
    !Number.isSafeInteger(Number(parsedRequestId)) ||
    buildRepairRequestViewHref(Number(parsedRequestId)) !== value
  ) {
    return null
  }

  return value
}

/** Validates and narrows the text-only Web Push notification envelope. */
export function parseWebPushNotificationPayload(value: unknown): WebPushNotificationPayload | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "notification_id", "title", "body", "url", "tag"]) ||
    !versionIsOne(value.version) ||
    typeof value.notification_id !== "string" ||
    !UUID.test(value.notification_id) ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    typeof value.url !== "string" ||
    typeof value.tag !== "string"
  ) {
    return null
  }

  const url = parseRepairRequestUrl(value.url)
  if (!url) return null

  const requestId = new URL(url, "https://worker.invalid").searchParams.get("requestId")
  if (value.tag !== `repair-request:${requestId}`) return null

  return {
    notificationId: value.notification_id,
    title: truncateUtf8(value.title, TITLE_MAX_BYTES),
    body: truncateUtf8(value.body, BODY_MAX_BYTES),
    url,
    tag: value.tag,
  }
}

/** Validates a notification click target against the current worker origin. */
export function sameOriginRepairRequestUrl(value: string, origin: string): string | null {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null

  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    return null
  }
  if (
    url.origin !== origin ||
    url.hash ||
    parseRepairRequestUrl(url.pathname + url.search) === null
  )
    return null
  return url.href
}
