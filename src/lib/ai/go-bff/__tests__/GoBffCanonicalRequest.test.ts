import { describe, expect, it } from "vitest"

import { signGoBffRequest } from "../GoBffCanonicalRequest"

const vector = {
  timestamp: "1700000000",
  requestId: "req-vector-1",
  keyId: "key-vector",
  secret: "test-vector-secret",
  rawBody:
    '{"protocol_version":"v1","app_id":"second-app","capability_id":"inventory-note","capability_version":"v1","request_id":"req-vector-1","identity":{"issuer":"nextjs-bff","audience":"ai-service-v1"},"messages":[{"role":"user","content":"hello"}]}',
  signature: "v6UXlOeavIFZukFqrLqjSFt0SNRPpjBEZNF_zG3QUuk",
}

describe("signGoBffRequest", () => {
  it("matches the Go HMAC test vector", () => {
    expect(
      signGoBffRequest(vector.secret, {
        timestamp: vector.timestamp,
        requestId: vector.requestId,
        keyId: vector.keyId,
        rawBody: vector.rawBody,
      })
    ).toBe(vector.signature)
  })
})
