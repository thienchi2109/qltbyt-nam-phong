import { createClient } from "@supabase/supabase-js"

import { isValidZbsDeliveryWebhookSignature } from "@/lib/zbs/delivery-webhook-signature"
import { parseZbsDeliveryWebhookPayload } from "@/lib/zbs/delivery-webhook-payload"

/** Keep Zalo delivery callbacks uncached so each signed event mutates live state. */
export const dynamic = "force-dynamic"
/** Use Node.js runtime for crypto signature validation and Supabase service-role RPCs. */
export const runtime = "nodejs"

const ZBS_MARK_DELIVERED_RPC = "zbs_notification_outbox_mark_delivered"

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status })
}

function readRequiredEnv(): {
  appId: string
  appSecret: string
  supabaseUrl: string
  serviceRoleKey: string
} | null {
  const appId = process.env.ZALO_ZBS_APP_ID?.trim()
  const appSecret = process.env.ZALO_ZBS_APP_SECRET?.trim()
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!appId || !appSecret || !supabaseUrl || !serviceRoleKey) {
    return null
  }

  return { appId, appSecret, supabaseUrl, serviceRoleKey }
}

function stringField(payload: unknown, field: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ""
  }

  const value = (payload as Record<string, unknown>)[field]
  return typeof value === "string" ? value.trim() : ""
}

function parseJsonBody(rawBody: string): unknown {
  return JSON.parse(rawBody) as unknown
}

/** Handles trusted Zalo ZBS delivery callbacks and marks matched outbox rows delivered. */
export async function POST(request: Request): Promise<Response> {
  const env = readRequiredEnv()
  if (!env) {
    console.error("Missing ZBS delivery webhook environment variables")
    return jsonResponse({ error: "Internal server error" }, 500)
  }

  const rawBody = await request.text()
  let payload: unknown
  try {
    payload = parseJsonBody(rawBody)
  } catch {
    return jsonResponse({ error: "Malformed JSON" }, 400)
  }

  const timestamp = stringField(payload, "timestamp")
  const payloadAppId = stringField(payload, "app_id")
  const isValidSignature = isValidZbsDeliveryWebhookSignature({
    expectedAppId: env.appId,
    payloadAppId,
    rawBody,
    timestamp,
    secret: env.appSecret,
    signatureHeader: request.headers.get("X-ZEvent-Signature"),
  })

  if (!isValidSignature) {
    return jsonResponse({ error: "Unauthorized" }, 401)
  }

  const parsed = parseZbsDeliveryWebhookPayload(payload)
  if (parsed.kind === "unsupported") {
    return jsonResponse({ success: true, ignored: true }, 202)
  }

  if (parsed.kind === "malformed") {
    return jsonResponse({ error: "Malformed delivery webhook" }, 400)
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false },
  })
  const { data, error } = await supabase.rpc(ZBS_MARK_DELIVERED_RPC, {
    p_tracking_id: parsed.delivery.trackingId,
    p_provider_message_id: parsed.delivery.providerMessageId,
    p_recipient_phone: parsed.delivery.recipientPhone,
    p_delivered_at: parsed.delivery.deliveredAt,
    p_delivery_webhook_received_at: parsed.delivery.webhookReceivedAt,
    p_delivery_webhook_payload: parsed.delivery.providerMetadata,
  })

  if (error) {
    console.error("ZBS delivery webhook update failed")
    return jsonResponse({ error: "Internal server error" }, 500)
  }

  return jsonResponse({ success: true, result: data ?? [] }, 200)
}
