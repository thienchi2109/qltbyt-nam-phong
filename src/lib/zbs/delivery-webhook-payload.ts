type JsonObject = Record<string, unknown>

export interface ZbsDeliveryWebhook {
  eventName: "user_received_message"
  trackingId: string
  providerMessageId: string | null
  recipientPhone: string | null
  deliveredAt: string
  webhookReceivedAt: string
  providerMetadata: JsonObject
}

export type ZbsDeliveryWebhookParseResult =
  | { kind: "delivery"; delivery: ZbsDeliveryWebhook }
  | { kind: "unsupported"; eventName: string }
  | { kind: "malformed"; reason: string }

const USER_RECEIVED_MESSAGE_EVENT = "user_received_message"
const MIN_REASONABLE_EPOCH_MILLISECONDS = 1_000_000_000_000

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseProviderTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) {
      return null
    }
    const parsed = new Date(value < MIN_REASONABLE_EPOCH_MILLISECONDS ? value * 1000 : value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const text = stringValue(value)
  if (!text) {
    return null
  }

  if (/^\d+$/.test(text)) {
    const epoch = Number(text)
    if (!Number.isFinite(epoch) || epoch <= 0) {
      return null
    }
    const parsed = new Date(epoch < MIN_REASONABLE_EPOCH_MILLISECONDS ? epoch * 1000 : epoch)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function compactProviderMetadata(payload: JsonObject, message: JsonObject): JsonObject {
  const sender = isRecord(payload.sender) ? payload.sender : {}
  const recipient = isRecord(payload.recipient) ? payload.recipient : {}
  const metadata: JsonObject = {
    app_id: stringValue(payload.app_id),
    event_name: stringValue(payload.event_name),
    message_delivery_time: stringValue(message.delivery_time),
    message_msg_id: stringValue(message.msg_id),
    message_tracking_id: stringValue(message.tracking_id),
    recipient_id: stringValue(recipient.id),
    recipient_phone: stringValue(message.phone) || stringValue(recipient.phone),
    sender_id: stringValue(sender.id),
    timestamp: stringValue(payload.timestamp),
  }

  return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== ""))
}

/** Extracts the supported ZBS delivery event shape from a trusted parsed webhook payload. */
export function parseZbsDeliveryWebhookPayload(
  payload: unknown,
  receivedAt: Date = new Date()
): ZbsDeliveryWebhookParseResult {
  if (!isRecord(payload)) {
    return { kind: "malformed", reason: "Payload must be a JSON object" }
  }

  const eventName = stringValue(payload.event_name)
  if (eventName !== USER_RECEIVED_MESSAGE_EVENT) {
    return { kind: "unsupported", eventName }
  }

  const message = isRecord(payload.message) ? payload.message : null
  if (!message) {
    return { kind: "malformed", reason: "Missing message payload" }
  }

  const trackingId = stringValue(message.tracking_id)
  if (!trackingId) {
    return { kind: "malformed", reason: "Missing tracking_id" }
  }

  const recipient = isRecord(payload.recipient) ? payload.recipient : {}
  const webhookReceivedAt = receivedAt.toISOString()

  return {
    kind: "delivery",
    delivery: {
      eventName: USER_RECEIVED_MESSAGE_EVENT,
      trackingId,
      providerMessageId: stringValue(message.msg_id) || null,
      recipientPhone: stringValue(message.phone) || stringValue(recipient.phone) || null,
      deliveredAt: parseProviderTimestamp(message.delivery_time) ?? webhookReceivedAt,
      webhookReceivedAt,
      providerMetadata: compactProviderMetadata(payload, message),
    },
  }
}
