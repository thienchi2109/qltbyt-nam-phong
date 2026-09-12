import { createHash, createHmac, ECDH, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"

/** Canonical worker claim endpoint path. */
export const WEB_PUSH_CLAIM_PATH = "/api/internal/web-push/v1/claim"
/** Canonical worker report endpoint path. */
export const WEB_PUSH_REPORT_PATH = "/api/internal/web-push/v1/report"
/** Header carrying the worker HMAC key identifier. */
export const WEB_PUSH_KEY_ID_HEADER = "x-web-push-key-id"
/** Header carrying the signed request timestamp. */
export const WEB_PUSH_TIMESTAMP_HEADER = "x-web-push-timestamp"
/** Header carrying the signed request nonce. */
export const WEB_PUSH_NONCE_HEADER = "x-web-push-nonce"
/** Header carrying the signed request signature. */
export const WEB_PUSH_SIGNATURE_HEADER = "x-web-push-signature"

const HMAC_SECRET_BYTES = 32
const MAX_CLOCK_SKEW_SECONDS = 60
const MAX_JSON_BODY_BYTES = 8192
const MAX_JSON_DEPTH = 64
const BASE64URL = /^[A-Za-z0-9_-]+$/
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/
const KEY_ID = /^[a-z0-9-]{1,64}$/
const NONCE = /^[0-9a-f]{32}$/
const HEX_SIGNATURE = /^[0-9a-f]{64}$/

/** Represents a rejected Web Push wire-format request. */
export class WebPushWireError extends Error {
  constructor(message = "invalid_request") {
    super(message)
    this.name = "WebPushWireError"
  }
}

function fail(message: string): never {
  throw new WebPushWireError(message)
}

function skipWhitespace(text: string, index: number): number {
  while (index < text.length && " \t\r\n".includes(text[index] ?? "")) index += 1
  return index
}

function scanString(text: string, index: number): number {
  if (text[index] !== '"') fail("invalid_request")
  let escaped = false
  for (let i = index + 1; i < text.length; i += 1) {
    const char = text[i]
    if (escaped) {
      if (char === "u") {
        if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i + 1, i + 5))) fail("invalid_request")
        i += 4
      } else if (!/["\\/bfnrt]/.test(char)) {
        fail("invalid_request")
      }
      escaped = false
    } else if (char === "\\") {
      escaped = true
    } else if (char === '"') {
      return i + 1
    } else if (char < " ") {
      fail("invalid_request")
    }
  }
  fail("invalid_request")
}

function scanNumber(text: string, index: number): number {
  const match = text.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/)
  if (!match) fail("invalid_request")
  return index + match[0].length
}

function scanValue(text: string, start: number, depth: number): number {
  if (depth > MAX_JSON_DEPTH) fail("invalid_request")
  const index = skipWhitespace(text, start)
  const char = text[index]
  if (char === '"') return scanString(text, index)
  if (char === "{") {
    let cursor = skipWhitespace(text, index + 1)
    const keys = new Set<string>()
    if (text[cursor] === "}") return cursor + 1
    while (cursor < text.length) {
      if (text[cursor] !== '"') fail("invalid_request")
      const keyEnd = scanString(text, cursor)
      let key: unknown
      try {
        key = JSON.parse(text.slice(cursor, keyEnd))
      } catch {
        fail("invalid_request")
      }
      if (typeof key !== "string") fail("invalid_request")
      if (keys.has(key)) fail("invalid_request")
      keys.add(key)
      cursor = skipWhitespace(text, keyEnd)
      if (text[cursor] !== ":") fail("invalid_request")
      cursor = scanValue(text, cursor + 1, depth + 1)
      cursor = skipWhitespace(text, cursor)
      if (text[cursor] === "}") return cursor + 1
      if (text[cursor] !== ",") fail("invalid_request")
      cursor = skipWhitespace(text, cursor + 1)
    }
    fail("invalid_request")
  }
  if (char === "[") {
    let cursor = skipWhitespace(text, index + 1)
    if (text[cursor] === "]") return cursor + 1
    while (cursor < text.length) {
      cursor = scanValue(text, cursor, depth + 1)
      cursor = skipWhitespace(text, cursor)
      if (text[cursor] === "]") return cursor + 1
      if (text[cursor] !== ",") fail("invalid_request")
      cursor = skipWhitespace(text, cursor + 1)
    }
    fail("invalid_request")
  }
  if (text.startsWith("true", index)) return index + 4
  if (text.startsWith("false", index)) return index + 5
  if (text.startsWith("null", index)) return index + 4
  return scanNumber(text, index)
}

/** Parses JSON while rejecting duplicate object keys at every nesting level. */
export function parseStrictJson(text: string, maxBytes = MAX_JSON_BODY_BYTES): unknown {
  if (
    typeof text !== "string" ||
    text.length === 0 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    Buffer.byteLength(text, "utf8") > maxBytes
  ) {
    fail("invalid_request")
  }
  try {
    const end = skipWhitespace(text, scanValue(text, 0, 0))
    if (end !== text.length) fail("invalid_request")
    return JSON.parse(text) as unknown
  } catch {
    fail("invalid_request")
  }
}

export type WebPushCanonicalRequest = {
  keyId: string
  method: string
  path: string
  timestamp: string
  nonce: string
  rawBody: string
}

/** Builds the exact LF-delimited bytes that Web Push worker authentication signs. */
export function buildWebPushCanonicalRequest(input: WebPushCanonicalRequest): string {
  const bodyHash = createHash("sha256").update(input.rawBody, "utf8").digest("hex")
  return [
    "web-push-v1",
    input.keyId,
    input.method,
    input.path,
    input.timestamp,
    input.nonce,
    bodyHash,
  ].join("\n")
}

function decodeBase64Url(value: string, maxLength: number): Buffer {
  if (value.length === 0 || value.length > maxLength || !BASE64URL.test(value))
    fail("invalid_subscription")
  const decoded = Buffer.from(value, "base64url")
  if (decoded.toString("base64url") !== value) fail("invalid_subscription")
  return decoded
}

function isUnsafeIpv4(octets: number[]): boolean {
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  )
    return true
  const [first, second, third] = octets
  return (
    first === 0 ||
    first === 10 ||
    (first === 100 && second >= 64 && second <= 127) ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 0 && third === 2) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && second === 18) ||
    (first === 198 && second === 19) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  )
}

function expandIpv6(hostname: string): number[] | null {
  const halves = hostname.split("::")
  if (halves.length > 2) return null
  const parsePart = (part: string): number[] | null => {
    if (part.includes(".")) {
      const octets = part.split(".").map(Number)
      if (
        octets.length !== 4 ||
        octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
      )
        return null
      return [(octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]]
    }
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return null
    return [Number.parseInt(part, 16)]
  }
  const parseSequence = (part: string): number[] | null => {
    if (!part) return []
    const values: number[] = []
    for (const segment of part.split(":")) {
      const parsed = parsePart(segment)
      if (!parsed) return null
      values.push(...parsed)
    }
    return values
  }
  const left = parseSequence(halves[0] ?? "")
  const right = parseSequence(halves.length === 2 ? (halves[1] ?? "") : "")
  if (!left || !right) return null
  if (halves.length === 1 && left.length !== 8) return null
  if (halves.length === 2 && left.length + right.length >= 8) return null
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right]
}

function isUnsafeHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "")
  if (
    lower === "localhost" ||
    lower === "local" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local")
  )
    return true
  const ipVersion = isIP(lower)
  if (ipVersion === 4) {
    return isUnsafeIpv4(lower.split(".").map(Number))
  }
  if (ipVersion === 6) {
    const parts = expandIpv6(lower)
    if (!parts) return true
    const first = parts[0]
    const isMappedIpv4 = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff
    const isCompatibleIpv4 = parts.slice(0, 6).every((part) => part === 0)
    if (isMappedIpv4 || isCompatibleIpv4) {
      return isUnsafeIpv4([parts[6] >> 8, parts[6] & 0xff, parts[7] >> 8, parts[7] & 0xff])
    }
    return (
      parts.every((part) => part === 0) ||
      (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) ||
      (first & 0xfe00) === 0xfc00 ||
      (first & 0xffc0) === 0xfe80 ||
      (first & 0xff00) === 0xff00
    )
  }
  return false
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return (
    keys.length === expected.length &&
    expected.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

export type WebPushSubscriptionInput = {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** Validates browser subscription material without DNS resolution or provider I/O. */
export function validateSubscriptionInput(input: unknown): WebPushSubscriptionInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid_subscription")
  const value = input as Record<string, unknown>
  if (!hasExactKeys(value, ["endpoint", "keys"])) fail("invalid_subscription")
  const keys = value.keys
  if (
    typeof value.endpoint !== "string" ||
    !keys ||
    typeof keys !== "object" ||
    Array.isArray(keys) ||
    !hasExactKeys(keys as Record<string, unknown>, ["p256dh", "auth"]) ||
    typeof (keys as Record<string, unknown>).p256dh !== "string" ||
    typeof (keys as Record<string, unknown>).auth !== "string"
  ) {
    fail("invalid_subscription")
  }

  const endpoint = value.endpoint
  if (Buffer.byteLength(endpoint, "utf8") > 2048) fail("invalid_subscription")
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    fail("invalid_subscription")
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port !== "" && url.port !== "443") ||
    isUnsafeHostname(url.hostname)
  ) {
    fail("invalid_subscription")
  }

  const p256dh = (keys as Record<string, unknown>).p256dh as string
  const auth = (keys as Record<string, unknown>).auth as string
  const point = decodeBase64Url(p256dh, 87)
  const authBytes = decodeBase64Url(auth, 22)
  if (point.length !== 65 || point[0] !== 4 || authBytes.length !== 16) fail("invalid_subscription")
  try {
    ECDH.convertKey(point, "prime256v1", undefined, undefined, "uncompressed")
  } catch {
    fail("invalid_subscription")
  }
  return { endpoint, keys: { p256dh, auth } }
}

/** Signs a worker request using the dedicated 32-byte base64 HMAC secret. */
export function signWebPushRequest(secretBase64: string, input: WebPushCanonicalRequest): string {
  if (
    typeof secretBase64 !== "string" ||
    !BASE64.test(secretBase64) ||
    secretBase64.length % 4 !== 0
  ) {
    fail("invalid_request")
  }
  const secret = Buffer.from(secretBase64, "base64")
  if (secret.toString("base64") !== secretBase64) fail("invalid_request")
  if (secret.length !== HMAC_SECRET_BYTES) fail("invalid_request")
  return createHmac("sha256", secret)
    .update(buildWebPushCanonicalRequest(input), "utf8")
    .digest("hex")
}

/** Validates worker key, timestamp, nonce, and signature before the nonce-store mutation. */
export function isValidWebPushSignature({
  secretBase64,
  keyId,
  method,
  path,
  timestamp,
  nonce,
  rawBody,
  signature,
  nowSeconds = Math.floor(Date.now() / 1000),
}: WebPushCanonicalRequest & {
  secretBase64: string | undefined
  signature: string | null
  nowSeconds?: number
}): boolean {
  if (
    !secretBase64 ||
    !KEY_ID.test(keyId) ||
    method !== "POST" ||
    (path !== WEB_PUSH_CLAIM_PATH && path !== WEB_PUSH_REPORT_PATH) ||
    !/^[0-9]+$/.test(timestamp) ||
    !NONCE.test(nonce) ||
    !signature ||
    !HEX_SIGNATURE.test(signature)
  ) {
    return false
  }
  const timestampSeconds = Number(timestamp)
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS
  ) {
    return false
  }
  try {
    const expected = Buffer.from(
      signWebPushRequest(secretBase64, {
        keyId,
        method,
        path,
        timestamp,
        nonce,
        rawBody,
      }),
      "hex"
    )
    const provided = Buffer.from(signature, "hex")
    return expected.length === provided.length && timingSafeEqual(expected, provided)
  } catch {
    return false
  }
}
