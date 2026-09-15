import { parseSubscriptionRevokeRequest, validateSubscriptionRevokeResponse } from "./validation"

const STORAGE_PREFIX = "qltbyt:web-push:subscription:"
const STORAGE_VERSION = 1
const CLEANUP_TIMEOUT_MS = 400
const CLEANUP_ATTEMPTS = 2
const localDiscardInFlight = new Map<string, Promise<void>>()

/** Web Push lifecycle entrypoint. */
export type BrowserSubscriptionStatus = "enabled" | "unconfirmed" | "cancelled" | "revoking"

/** Web Push lifecycle entrypoint. */
export type BrowserSubscriptionRecord = {
  version: 1
  ownerId: string
  vapidKeyVersion: string
  status: BrowserSubscriptionStatus
  endpoint?: string
  subscriptionId?: string
  revision?: string
}

type CleanupResult = "skipped" | "local" | "remote" | "pending"

function storageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(ownerId)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isValidRecord(value: unknown, ownerId: string): value is BrowserSubscriptionRecord {
  if (
    !isRecord(value) ||
    value.version !== STORAGE_VERSION ||
    value.ownerId !== ownerId ||
    typeof value.vapidKeyVersion !== "string" ||
    !["enabled", "unconfirmed", "cancelled", "revoking"].includes(String(value.status))
  ) {
    return false
  }
  if (value.subscriptionId === undefined && value.revision === undefined) return true
  if (typeof value.subscriptionId !== "string" || typeof value.revision !== "string") return false
  if (value.endpoint !== undefined && typeof value.endpoint !== "string") return false
  return (
    parseSubscriptionRevokeRequest({
      version: 1,
      subscription_id: value.subscriptionId,
      revision: value.revision,
    }) !== null
  )
}

/** Web Push lifecycle entrypoint. */
export async function hasMatchingLocalBrowserSubscription(ownerId: string): Promise<boolean> {
  const record = readBrowserSubscriptionRecord(ownerId)
  if (!record?.endpoint || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return false
  }
  try {
    const registration = await withTimeout(navigator.serviceWorker.ready, CLEANUP_TIMEOUT_MS)
    const subscription = await withTimeout(
      registration.pushManager.getSubscription(),
      CLEANUP_TIMEOUT_MS
    )
    return subscription?.endpoint === record.endpoint
  } catch {
    return false
  }
}

/** Web Push lifecycle entrypoint. */
export function readBrowserSubscriptionRecord(ownerId: string): BrowserSubscriptionRecord | null {
  if (!ownerId || typeof window === "undefined") return null
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey(ownerId)) ?? "null")
    return isValidRecord(value, ownerId) ? value : null
  } catch {
    return null
  }
}

/** Web Push lifecycle entrypoint. */
export function writeBrowserSubscriptionRecord(record: BrowserSubscriptionRecord): void {
  if (!record.ownerId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(record.ownerId), JSON.stringify(record))
  } catch {
    // Browser storage is best effort; the browser subscription remains authoritative.
  }
}

/** Web Push lifecycle entrypoint. */
export function removeBrowserSubscriptionRecord(ownerId: string): void {
  if (!ownerId || typeof window === "undefined") return
  try {
    window.localStorage.removeItem(storageKey(ownerId))
  } catch {
    // Continue logout even when browser storage is unavailable.
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Operation cancelled", "AbortError")
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("web_push_cleanup_timeout")), timeoutMs)
  })
  const abortPromise = new Promise<never>((_, reject) => {
    if (!signal) return
    onAbort = () => reject(new DOMException("Operation cancelled", "AbortError"))
    signal.addEventListener("abort", onAbort, { once: true })
  })
  return Promise.race(
    signal ? [promise, timeoutPromise, abortPromise] : [promise, timeoutPromise]
  ).finally(() => {
    if (timeout) clearTimeout(timeout)
    if (signal && onAbort) signal.removeEventListener("abort", onAbort)
  })
}

async function unsubscribeLocalSubscription(
  expectedEndpoint?: string,
  signal?: AbortSignal
): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
  throwIfAborted(signal)
  const registration = await withTimeout(navigator.serviceWorker.ready, CLEANUP_TIMEOUT_MS, signal)
  throwIfAborted(signal)
  const subscription = await withTimeout(
    registration.pushManager.getSubscription(),
    CLEANUP_TIMEOUT_MS,
    signal
  )
  if (!subscription || !expectedEndpoint || subscription.endpoint !== expectedEndpoint) return
  throwIfAborted(signal)
  const unsubscribed = await withTimeout(subscription.unsubscribe(), CLEANUP_TIMEOUT_MS, signal)
  if (!unsubscribed) {
    throwIfAborted(signal)
    const remaining = await withTimeout(
      registration.pushManager.getSubscription(),
      CLEANUP_TIMEOUT_MS,
      signal
    )
    if (remaining) throw new Error("web_push_unsubscribe_failed")
  }
}

async function revokeRemoteSubscription(
  record: BrowserSubscriptionRecord,
  signal?: AbortSignal
): Promise<void> {
  if (!record.subscriptionId || !record.revision) return
  const controller = new AbortController()
  const abortController = () => controller.abort()
  signal?.addEventListener("abort", abortController, { once: true })
  try {
    throwIfAborted(signal)
    await withTimeout(
      (async () => {
        throwIfAborted(signal)
        const response = await fetch("/api/web-push/subscriptions/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: 1,
            subscription_id: record.subscriptionId,
            revision: record.revision,
          }),
          signal: controller.signal,
        })
        let payload: unknown = null
        try {
          payload = await response.json()
        } catch {
          payload = null
        }
        if (!response.ok || !validateSubscriptionRevokeResponse(payload)) {
          throw new Error("web_push_revoke_failed")
        }
      })(),
      CLEANUP_TIMEOUT_MS,
      signal
    )
  } finally {
    signal?.removeEventListener("abort", abortController)
    controller.abort()
  }
}

/** Cleans the current browser's subscription without touching another owner's record. */
export async function cleanupBrowserSubscription(
  ownerId: string,
  onRequestSent?: () => void,
  signal?: AbortSignal
): Promise<CleanupResult> {
  if (!ownerId || typeof window === "undefined") return "skipped"
  if (signal?.aborted) return "pending"
  const record = readBrowserSubscriptionRecord(ownerId)
  let localClean = false
  try {
    await unsubscribeLocalSubscription(record?.endpoint, signal)
    localClean = true
  } catch {
    // A stuck browser API must not hold logout forever.
    if (signal?.aborted) return "pending"
  }

  if (!record?.subscriptionId || !record.revision) {
    if (localClean) removeBrowserSubscriptionRecord(ownerId)
    return localClean ? "local" : "pending"
  }

  if (signal?.aborted) return "pending"
  writeBrowserSubscriptionRecord({ ...record, status: "revoking" })
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "pending"
  for (let attempt = 0; attempt < CLEANUP_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) return "pending"
    try {
      onRequestSent?.()
      await revokeRemoteSubscription(record, signal)
      if (signal?.aborted) return "pending"
      const current = readBrowserSubscriptionRecord(ownerId)
      if (
        localClean &&
        current?.subscriptionId === record.subscriptionId &&
        current.revision === record.revision
      ) {
        removeBrowserSubscriptionRecord(ownerId)
        return "remote"
      }
      writeBrowserSubscriptionRecord({ ...record, status: "revoking" })
      return "pending"
    } catch {
      if (signal?.aborted) return "pending"
      if (attempt + 1 < CLEANUP_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  return "pending"
}

/** Removes the local browser subscription during an account transition. */
export async function discardLocalBrowserSubscription(ownerId: string): Promise<void> {
  if (!ownerId || typeof window === "undefined") return
  const existing = localDiscardInFlight.get(ownerId)
  if (existing) return existing

  const cleanup = discardLocalBrowserSubscriptionOnce(ownerId)
  localDiscardInFlight.set(ownerId, cleanup)
  cleanup
    .finally(() => {
      if (localDiscardInFlight.get(ownerId) === cleanup) localDiscardInFlight.delete(ownerId)
    })
    .catch(() => undefined)
  return cleanup
}

/** Blocks a new owner until browser cleanup started by another auth transition settles. */
export async function waitForPendingBrowserSubscriptionCleanup(): Promise<void> {
  while (localDiscardInFlight.size > 0) {
    await Promise.all([...localDiscardInFlight.values()])
  }
}

async function discardLocalBrowserSubscriptionOnce(ownerId: string): Promise<void> {
  const record = readBrowserSubscriptionRecord(ownerId)
  if (!record) {
    return
  }
  try {
    await unsubscribeLocalSubscription(record.endpoint)
  } catch (error) {
    writeBrowserSubscriptionRecord({ ...record, status: "revoking" })
    throw error
  }
  writeBrowserSubscriptionRecord({ ...record, status: "revoking" })
}

/** Retries a previously failed revoke only for the matching authenticated owner. */
export async function retryBrowserSubscriptionCleanup(
  ownerId: string,
  signal?: AbortSignal
): Promise<CleanupResult> {
  const record = readBrowserSubscriptionRecord(ownerId)
  if (record?.status !== "revoking") return "skipped"
  return cleanupBrowserSubscription(ownerId, undefined, signal)
}
