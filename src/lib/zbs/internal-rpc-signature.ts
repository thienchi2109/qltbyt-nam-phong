import { createHmac, timingSafeEqual } from "crypto"

/** Internal RPC source label accepted by the ZBS cron-only RPC proxy path. */
export const ZBS_INTERNAL_RPC_SOURCE = "zbs-dispatch"
/** Header carrying the internal ZBS RPC source label. */
export const ZBS_INTERNAL_RPC_SOURCE_HEADER = "x-qltbyt-internal-rpc"
/** Header carrying the millisecond timestamp used for internal ZBS RPC signature freshness. */
export const ZBS_INTERNAL_RPC_TIMESTAMP_HEADER = "x-qltbyt-internal-rpc-timestamp"
/** Header carrying the HMAC signature for internal ZBS RPC requests. */
export const ZBS_INTERNAL_RPC_SIGNATURE_HEADER = "x-qltbyt-internal-rpc-signature"

const ZBS_INTERNAL_RPC_SIGNATURE_TOLERANCE_MS = 60_000

/** Builds the HMAC signature for a ZBS internal cron RPC request. */
export function signZbsInternalRpc(secret: string, fn: string, timestamp: string): string {
  return createHmac("sha256", secret)
    .update(`${ZBS_INTERNAL_RPC_SOURCE}\n${fn}\n${timestamp}`)
    .digest("hex")
}

/** Validates the ZBS internal cron RPC HMAC signature and timestamp freshness. */
export function isValidZbsInternalRpcSignature({
  secret,
  fn,
  timestamp,
  signature,
  nowMs = Date.now(),
}: {
  secret: string | undefined
  fn: string
  timestamp: string | null
  signature: string | null
  nowMs?: number
}): boolean {
  if (!secret || !timestamp || !signature) {
    return false
  }

  const timestampMs = Number(timestamp)
  if (!Number.isSafeInteger(timestampMs)) {
    return false
  }

  if (Math.abs(nowMs - timestampMs) > ZBS_INTERNAL_RPC_SIGNATURE_TOLERANCE_MS) {
    return false
  }

  const expected = signZbsInternalRpc(secret, fn, timestamp)
  const expectedBuffer = Buffer.from(expected, "hex")
  const signatureBuffer = Buffer.from(signature, "hex")
  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  )
}
