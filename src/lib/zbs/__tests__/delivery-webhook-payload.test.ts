import { describe, expect, it } from "vitest"

import { parseZbsDeliveryWebhookPayload } from "@/lib/zbs/delivery-webhook-payload"

describe("ZBS delivery webhook payload parsing", () => {
  it("extracts delivered-message fields from user_received_message", () => {
    const result = parseZbsDeliveryWebhookPayload(
      {
        app_id: "2074138120372622546",
        timestamp: "1602560967477",
        event_name: "user_received_message",
        sender: { id: "2893352839501541173" },
        recipient: { id: "1077170099018924429" },
        message: {
          delivery_time: "1602960467432",
          msg_id: "message-1",
          tracking_id: "tracking-1",
          phone: "84900000001",
        },
      },
      new Date("2026-07-02T08:00:00.000Z")
    )

    expect(result).toEqual({
      kind: "delivery",
      delivery: {
        eventName: "user_received_message",
        trackingId: "tracking-1",
        providerMessageId: "message-1",
        recipientPhone: "84900000001",
        deliveredAt: "2020-10-17T18:47:47.432Z",
        webhookReceivedAt: "2026-07-02T08:00:00.000Z",
        providerMetadata: {
          app_id: "2074138120372622546",
          event_name: "user_received_message",
          message_delivery_time: "1602960467432",
          message_msg_id: "message-1",
          message_tracking_id: "tracking-1",
          recipient_id: "1077170099018924429",
          recipient_phone: "84900000001",
          sender_id: "2893352839501541173",
          timestamp: "1602560967477",
        },
      },
    })
  })

  it("returns unsupported events without delivery extraction", () => {
    expect(
      parseZbsDeliveryWebhookPayload(
        {
          event_name: "user_feedback",
          message: { tracking_id: "tracking-1" },
        },
        new Date("2026-07-02T08:00:00.000Z")
      )
    ).toEqual({ kind: "unsupported", eventName: "user_feedback" })
  })

  it.each([
    ["missing tracking id", { event_name: "user_received_message", message: { msg_id: "m1" } }],
    ["missing message", { event_name: "user_received_message" }],
    ["non-object payload", null],
  ])("rejects malformed trusted delivery payloads: %s", (_label, payload) => {
    expect(parseZbsDeliveryWebhookPayload(payload, new Date("2026-07-02T08:00:00.000Z"))).toEqual({
      kind: "malformed",
      reason: expect.any(String),
    })
  })

  it.each([0, -1])(
    "falls back to webhook receipt time for invalid numeric delivery_time %s",
    (deliveryTime) => {
      const result = parseZbsDeliveryWebhookPayload(
        {
          event_name: "user_received_message",
          message: {
            delivery_time: deliveryTime,
            tracking_id: "tracking-1",
          },
        },
        new Date("2026-07-02T08:00:00.000Z")
      )

      expect(result).toMatchObject({
        kind: "delivery",
        delivery: {
          deliveredAt: "2026-07-02T08:00:00.000Z",
        },
      })
    }
  )
})
