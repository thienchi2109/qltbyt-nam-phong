import { describe, expect, it } from "vitest"

import {
  hashZbsInternalRpcBody,
  isValidZbsInternalRpcSignature,
  signZbsInternalRpc,
} from "@/lib/zbs/internal-rpc-signature"

describe("ZBS internal RPC signature validation", () => {
  it("rejects non-canonical hex body hash and signature headers", () => {
    const secret = "test-secret"
    const fn = "zbs_notification_outbox_claim_for_dispatch"
    const timestamp = "1700000000000"
    const bodySha256 = hashZbsInternalRpcBody(JSON.stringify({ p_limit: 1 }))
    const signature = signZbsInternalRpc(secret, fn, timestamp, bodySha256)

    expect(
      isValidZbsInternalRpcSignature({
        secret,
        fn,
        timestamp,
        bodySha256,
        bodySha256Header: `${bodySha256}zz`,
        signature,
        nowMs: Number(timestamp),
      })
    ).toBe(false)
    expect(
      isValidZbsInternalRpcSignature({
        secret,
        fn,
        timestamp,
        bodySha256,
        bodySha256Header: bodySha256,
        signature: `${signature}zz`,
        nowMs: Number(timestamp),
      })
    ).toBe(false)
  })
})
