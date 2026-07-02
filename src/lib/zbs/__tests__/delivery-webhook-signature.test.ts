import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildZbsDeliveryWebhookSignature,
  isValidZbsDeliveryWebhookSignature,
} from "@/lib/zbs/delivery-webhook-signature"

const APP_ID = "2074138120372622546"
const SECRET = "zalo-webhook-secret"
const NOW_MS = Date.parse("2026-07-02T09:00:00.000Z")
const TIMESTAMP = String(NOW_MS)
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

function rawBodyWithTimestamp(timestamp: string): string {
  return JSON.stringify({
    app_id: APP_ID,
    timestamp,
    event_name: "user_received_message",
    message: {
      tracking_id: "tracking-1",
      msg_id: "message-1",
      delivery_time: "1602960467432",
    },
  })
}

describe("ZBS delivery webhook signature validation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(NOW_MS))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

  it("rejects a replayed signed payload with a stale timestamp", () => {
    const staleTimestamp = String(NOW_MS - 5 * 60 * 1000 - 1)
    const rawBody = rawBodyWithTimestamp(staleTimestamp)
    const signatureHeader = buildZbsDeliveryWebhookSignature({
      appId: APP_ID,
      rawBody,
      timestamp: staleTimestamp,
      secret: SECRET,
    })

    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: APP_ID,
        rawBody,
        timestamp: staleTimestamp,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(false)
  })

  it("rejects a signed payload with a timestamp too far in the future", () => {
    const futureTimestamp = String(NOW_MS + 5 * 60 * 1000 + 1)
    const rawBody = rawBodyWithTimestamp(futureTimestamp)
    const signatureHeader = buildZbsDeliveryWebhookSignature({
      appId: APP_ID,
      rawBody,
      timestamp: futureTimestamp,
      secret: SECRET,
    })

    expect(
      isValidZbsDeliveryWebhookSignature({
        expectedAppId: APP_ID,
        payloadAppId: APP_ID,
        rawBody,
        timestamp: futureTimestamp,
        secret: SECRET,
        signatureHeader,
      })
    ).toBe(false)
  })
})
