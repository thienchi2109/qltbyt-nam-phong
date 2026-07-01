import { createHash, createHmac, timingSafeEqual } from "crypto"

/** Internal RPC source label accepted by the ZBS cron-only RPC proxy path. */
export const ZBS_INTERNAL_RPC_SOURCE = "zbs-dispatch"
/** Header carrying the internal ZBS RPC source label. */
export const ZBS_INTERNAL_RPC_SOURCE_HEADER = "x-qltbyt-internal-rpc"
/** Header carrying the millisecond timestamp used for internal ZBS RPC signature freshness. */
export const ZBS_INTERNAL_RPC_TIMESTAMP_HEADER = "x-qltbyt-internal-rpc-timestamp"
/** Header carrying the SHA-256 digest of the internal ZBS RPC request body. */
export const ZBS_INTERNAL_RPC_BODY_SHA256_HEADER = "x-qltbyt-internal-rpc-body-sha256"
/** Header carrying the HMAC signature for internal ZBS RPC requests. */
export const ZBS_INTERNAL_RPC_SIGNATURE_HEADER = "x-qltbyt-internal-rpc-signature"

const ZBS_INTERNAL_RPC_SIGNATURE_TOLERANCE_MS = 60_000
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i

/** Builds a stable SHA-256 digest for a ZBS internal cron RPC request body. */
export function hashZbsInternalRpcBody(body: string): string {
  return createHash("sha256").update(body).digest("hex")
}

/** Builds the HMAC signature for a ZBS internal cron RPC request. */
export function signZbsInternalRpc(
  secret: string,
  fn: string,
  timestamp: string,
  bodySha256: string
): string {
  return createHmac("sha256", secret)
    .update(`${ZBS_INTERNAL_RPC_SOURCE}\n${fn}\n${timestamp}\n${bodySha256}`)
    .digest("hex")
}

/** Validates the ZBS internal cron RPC HMAC signature and timestamp freshness. */
export function isValidZbsInternalRpcSignature({
  secret,
  fn,
  timestamp,
  bodySha256,
  bodySha256Header,
  signature,
  nowMs = Date.now(),
}: {
  secret: string | undefined
  fn: string
  timestamp: string | null
  bodySha256: string
  bodySha256Header: string | null
  signature: string | null
  nowMs?: number
}): boolean {
  if (!secret || !timestamp || !bodySha256Header || !signature) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (!Number.isSafeInteger(timestampMs)) {
    return false
  }

  if (Math.abs(nowMs - timestampMs) > ZBS_INTERNAL_RPC_SIGNATURE_TOLERANCE_MS) {
    return false
  }

  if (!SHA256_HEX_PATTERN.test(bodySha256Header) || !SHA256_HEX_PATTERN.test(signature)) {
    return false
  }

  const bodySha256Buffer = Buffer.from(bodySha256, "hex")
  const bodySha256HeaderBuffer = Buffer.from(bodySha256Header, "hex")
  if (
    bodySha256Buffer.length !== 32 ||
    bodySha256Buffer.length !== bodySha256HeaderBuffer.length ||
    !timingSafeEqual(bodySha256Buffer, bodySha256HeaderBuffer)
  ) {
    return false
  }

  const expected = signZbsInternalRpc(secret, fn, timestamp, bodySha256)
  const expectedBuffer = Buffer.from(expected, "hex")
  const signatureBuffer = Buffer.from(signature, "hex")
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  )
}
