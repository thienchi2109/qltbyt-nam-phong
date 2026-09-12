import { describe, expect, it } from "vitest"

import { buildWebPushCanonicalRequest, parseStrictJson, validateSubscriptionInput } from "../wire"

const VALID_P256DH =
  "BOSMYXSPeNZ9sdxrNwdifOTNnjj4RRrdT8bLFrCvlSZHid8-VorFDh0Zv9miRlFh9Xy-cdEz_5ZUWKHnau7DdzY"
const VALID_AUTH = "AAAAAAAAAAAAAAAAAAAAAA"

describe("web push wire validation", () => {
  it("rejects duplicate JSON keys before parsing", () => {
    expect(() => parseStrictJson('{"version":1,"version":1}')).toThrow("invalid_request")
  })

  it("binds the raw body, exact path, and headers into the canonical request", () => {
    expect(
      buildWebPushCanonicalRequest({
        keyId: "test-key-1",
        method: "POST",
        path: "/api/internal/web-push/v1/claim",
        timestamp: "1789056000",
        nonce: "000102030405060708090a0b0c0d0e0f",
        rawBody:
          '{"version":1,"worker_id":"oracle-web-push-1","limit":5,"vapid_key_version":"staging-20260910-01","vapid_fingerprint":"sha256:0000000000000000000000000000000000000000000000000000000000000000"}',
      })
    ).toBe(
      "web-push-v1\ntest-key-1\nPOST\n/api/internal/web-push/v1/claim\n1789056000\n000102030405060708090a0b0c0d0e0f\n1495e63cd1255de20c6c4062a1eae98f1ff47743cca455a08dc43cd42600c3ce"
    )
  })

  it("rejects unsafe subscription endpoints without resolving or fetching them", () => {
    for (const endpoint of [
      "https://127.0.0.1/push",
      "https://[::1]/push",
      "https://[::ffff:127.0.0.1]/push",
      "https://100.64.0.1/push",
    ]) {
      expect(() =>
        validateSubscriptionInput({
          endpoint,
          keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
        })
      ).toThrow("invalid_subscription")
    }
  })

  it("accepts a valid public HTTPS subscription endpoint and P-256 key", () => {
    expect(
      validateSubscriptionInput({
        endpoint: "https://push.example.test/push?token=opaque",
        keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
      })
    ).toEqual({
      endpoint: "https://push.example.test/push?token=opaque",
      keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
    })
  })

  it("rejects unknown subscription fields", () => {
    expect(() =>
      validateSubscriptionInput({
        endpoint: "https://push.example.test/push",
        keys: { p256dh: VALID_P256DH, auth: VALID_AUTH },
        owner_id: "forged",
      })
    ).toThrow("invalid_subscription")
  })
})
