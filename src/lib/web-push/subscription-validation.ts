import { isRecord, exactKeys, versionIsOne, parsePositiveBigint } from "./validation-common"

export type SubscriptionRevokeRequest = {
  subscriptionId: string
  revision: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Validates a browser subscription revoke request. */
export function parseSubscriptionRevokeRequest(value: unknown): SubscriptionRevokeRequest | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "subscription_id", "revision"]) ||
    !versionIsOne(value.version)
  ) {
    return null
  }
  if (typeof value.subscription_id !== "string" || !UUID.test(value.subscription_id)) return null
  const revision = parsePositiveBigint(value.revision)
  return revision ? { subscriptionId: value.subscription_id, revision } : null
}

/** Validates and narrows a subscription registration response envelope. */
export function validateSubscriptionRegisterResponse(
  value: unknown
): Record<string, unknown> | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, ["version", "subscription_id", "revision"]) ||
    value.version !== 1 ||
    typeof value.subscription_id !== "string" ||
    !UUID.test(value.subscription_id) ||
    !parsePositiveBigint(value.revision)
  ) {
    return null
  }
  return value
}

/** Validates and narrows a subscription revoke response envelope. */
export function validateSubscriptionRevokeResponse(value: unknown): Record<string, unknown> | null {
  return isRecord(value) &&
    exactKeys(value, ["version", "revoked"]) &&
    value.version === 1 &&
    value.revoked === true
    ? value
    : null
}
