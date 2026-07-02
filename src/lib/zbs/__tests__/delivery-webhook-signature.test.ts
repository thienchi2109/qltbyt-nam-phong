import { describe, expect, it } from "vitest"

import {
  buildZbsDeliveryWebhookSignature,
  isValidZbsDeliveryWebhookSignature,
} from "@/lib/zbs/delivery-webhook-signature"

const APP_ID = "2074138120372622546"
const SECRET = "zalo-webhook-secret"
const TIMESTAMP = "1602560967477"
const RAW_BODY = JSON.stringify({
  app_id: APP_ID,
  timestamp: TIMESTAMP,
  event_name: "user_received_message",
  message: {
    tracking_id: "tracking-1",
    msg_id: "message-1",
    delivery_time: "1602960467432",
  },
})

describe("ZBS delivery webhook signature validation", () => {
  it("accepts a valid mac header built from app id, raw body, timestamp, and secret", () => {
    const signatureHeader = buildZbsDeliveryWebhookSignature({
      appId: APP_ID,
      rawBody: RAW_BODY,
      timestamp: TIMESTAMP,
      secret: SECRET,
    })

    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: APP_ID,
        rawBody: RAW_BODY,
        timestamp: TIMESTAMP,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(true)
  })

  it.each([
    ["missing header", null],
    ["malformed header", "sha256=not-a-zalo-header"],
    ["non-hex mac", "mac=not-hex"],
  ])("rejects %s", (_label, signatureHeader) => {
    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: APP_ID,
        rawBody: RAW_BODY,
        timestamp: TIMESTAMP,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(false)
  })

  it("rejects a payload app id that does not match the configured app id", () => {
    const signatureHeader = buildZbsDeliveryWebhookSignature({
      appId: APP_ID,
      rawBody: RAW_BODY,
      timestamp: TIMESTAMP,
      secret: SECRET,
    })

    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: "wrong-app-id",
        rawBody: RAW_BODY,
        timestamp: TIMESTAMP,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(false)
  })

  it("rejects a signature when the raw body changes", () => {
    const signatureHeader = buildZbsDeliveryWebhookSignature({
      appId: APP_ID,
      rawBody: RAW_BODY,
      timestamp: TIMESTAMP,
      secret: SECRET,
    })

    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: APP_ID,
        rawBody: RAW_BODY.replace("tracking-1", "tracking-2"),
        timestamp: TIMESTAMP,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(false)
  })

  it("rejects a signature built with the wrong secret", () => {
    const signatureHeader = buildZbsDeliveryWebhookSignature({
      appId: APP_ID,
      rawBody: RAW_BODY,
      timestamp: TIMESTAMP,
      secret: "wrong-secret",
    })

    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: APP_ID,
        rawBody: RAW_BODY,
        timestamp: TIMESTAMP,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(false)
  })
})
