import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { buildZbsDeliveryWebhookSignature } from "@/lib/zbs/delivery-webhook-signature"

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMocks.createClient,
}))

const ORIGINAL_ENV = { ...process.env }
const APP_ID = "2074138120372622546"
const SECRET = "zalo-webhook-secret"

async function loadRoute() {
  const routeModulePath = ["..", "route"].join("/")
  return import(/* @vite-ignore */ routeModulePath)
}

function deliveryPayload(overrides: Record<string, unknown> = {}) {
  return {
    app_id: APP_ID,
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
    ...overrides,
  }
}

function signedRequest(payload: unknown, signatureSecret = SECRET) {
  const body = JSON.stringify(payload)
  const timestamp =
    payload && typeof payload === "object" && "timestamp" in payload
      ? String(payload.timestamp)
      : ""
  return new Request("https://example.test/api/webhooks/zalo/zbs", {
    method: "POST",
    headers: {
      "X-ZEvent-Signature": buildZbsDeliveryWebhookSignature({
        appId: APP_ID,
        rawBody: body,
        timestamp,
        secret: signatureSecret,
      }),
    },
    body,
  })
}

describe("/api/webhooks/zalo/zbs", () => {
  beforeEach(() => {
    vi.resetModules()
    supabaseMocks.createClient.mockReset()
    supabaseMocks.rpc.mockReset()
    process.env = {
      ...ORIGINAL_ENV,
      ZALO_ZBS_APP_ID: APP_ID,
      ZALO_ZBS_APP_SECRET: SECRET,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    }
    supabaseMocks.createClient.mockReturnValue({ rpc: supabaseMocks.rpc })
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("rejects invalid signatures without creating a Supabase client", async () => {
    const mod = await loadRoute()

    const response = await mod.POST(signedRequest(deliveryPayload(), "wrong-secret"))

    expect(response.status).toBe(401)
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
  })

  it("marks trusted user_received_message events as delivered by tracking id", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ id: "outbox-1", status: "delivered" }],
      error: null,
    })
    const mod = await loadRoute()

    const response = await mod.POST(signedRequest(deliveryPayload()))

    expect(response.status).toBe(200)
    expect(supabaseMocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "service-role-secret",
      { auth: { persistSession: false } }
    )
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("zbs_notification_outbox_mark_delivered", {
      p_delivered_at: "2020-10-17T18:47:47.432Z",
      p_delivery_webhook_payload: expect.objectContaining({
        message_msg_id: "message-1",
        message_tracking_id: "tracking-1",
        recipient_phone: "84900000001",
      }),
      p_delivery_webhook_received_at: expect.any(String),
      p_provider_message_id: "message-1",
      p_recipient_phone: "84900000001",
      p_tracking_id: "tracking-1",
    })
    await expect(response.json()).resolves.toEqual({
      success: true,
      result: [{ id: "outbox-1", status: "delivered" }],
    })
  })

  it("accepts unsupported signed events without mutating the outbox", async () => {
    const mod = await loadRoute()

    const response = await mod.POST(
      signedRequest({
        app_id: APP_ID,
        timestamp: "1602560967477",
        event_name: "user_feedback",
        message: { tracking_id: "tracking-1" },
      })
    )

    expect(response.status).toBe(202)
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ success: true, ignored: true })
  })

  it("rejects malformed trusted delivery events without mutating the outbox", async () => {
    const mod = await loadRoute()

    const response = await mod.POST(
      signedRequest(deliveryPayload({ message: { msg_id: "message-1" } }))
    )

    expect(response.status).toBe(400)
    expect(supabaseMocks.createClient).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({ error: "Malformed delivery webhook" })
  })

  it("returns a sanitized 500 when the delivery RPC fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "service-role secret leaked in DB detail" },
    })
    const mod = await loadRoute()

    const response = await mod.POST(signedRequest(deliveryPayload()))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: "Delivery webhook update failed" })
    consoleErrorSpy.mockRestore()
  })
})
