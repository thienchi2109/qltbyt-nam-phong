import { createHash, timingSafeEqual } from "crypto"

const ZALO_DELIVERY_SIGNATURE_PREFIX = "mac="
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i
const ZALO_DELIVERY_SIGNATURE_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

/** Builds the Zalo delivery webhook mac header from app id, raw body, timestamp, and secret. */
export function buildZbsDeliveryWebhookSignature({
  appId,
  rawBody,
  timestamp,
  secret,
}: {
  appId: string
  rawBody: string
  timestamp: string
  secret: string
}): string {
  const mac = createHash("sha256").update(`${appId}${rawBody}${timestamp}${secret}`).digest("hex")
  return `${ZALO_DELIVERY_SIGNATURE_PREFIX}${mac}`
}

function parseMacHeader(signatureHeader: string | null): string | null {
  if (!signatureHeader?.startsWith(ZALO_DELIVERY_SIGNATURE_PREFIX)) {
    return null
  }

  const mac = signatureHeader.slice(ZALO_DELIVERY_SIGNATURE_PREFIX.length)
  return SHA256_HEX_PATTERN.test(mac) ? mac : null
}

function timingSafeHexEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex")
  const actualBuffer = Buffer.from(actual, "hex")

  return (
    expectedBuffer.length === 32 &&
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

function isFreshSignatureTimestamp(timestamp: string): boolean {
  const timestampMs = Number(timestamp)
  if (!Number.isSafeInteger(timestampMs) || timestampMs <= 0) {
    return false
  }

  return Math.abs(Date.now() - timestampMs) <= ZALO_DELIVERY_SIGNATURE_TIMESTAMP_TOLERANCE_MS
}

/** Validates the Zalo delivery webhook mac header without leaking timing differences. */
export function isValidZbsDeliveryWebhookSignature({
  expectedAppId,
  payloadAppId,
  rawBody,
  timestamp,
  secret,
  signatureHeader,
}: {
  expectedAppId: string | undefined
  payloadAppId: string
  rawBody: string
  timestamp: string
  secret: string | undefined
  signatureHeader: string | null
}): boolean {
  if (!expectedAppId || !secret || !payloadAppId || !timestamp) {
    return false
  }

  if (payloadAppId !== expectedAppId) {
    return false
  }

  if (!isFreshSignatureTimestamp(timestamp)) {
    return false
  }

  const receivedMac = parseMacHeader(signatureHeader)
  if (!receivedMac) {
    return false
  }

  const expectedHeader = buildZbsDeliveryWebhookSignature({
    appId: expectedAppId,
    rawBody,
    timestamp,
    secret,
  })
  const expectedMac = parseMacHeader(expectedHeader)

  return expectedMac ? timingSafeHexEqual(expectedMac, receivedMac) : false
}
