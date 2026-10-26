import {
  hasMatchingLocalBrowserSubscription,
  readBrowserSubscriptionRecord,
  retryBrowserSubscriptionCleanup,
  waitForPendingBrowserSubscriptionCleanup,
  writeBrowserSubscriptionRecord,
} from "./browser-lifecycle"
import { hasBrowserPushConsent, onBrowserPushConsentWithdrawn } from "./browser-consent"
import { validateSubscriptionRegisterResponse } from "./subscription-validation"

export type VapidArtifact = { version: string; public_key: string }
export type PublicKeyPayload = { registration_enabled: boolean; vapid: VapidArtifact | null }
export type RegistrationResult = { subscriptionId: string; revision: string; endpoint: string }

/** Remembers which VAPID key created this browser's current subscription. */
export const VAPID_VERSION_STORAGE_KEY = "web-push-vapid-key-version"

type RegistrationFlight = {
  controller: AbortController
  promise: Promise<RegistrationResult>
  waiters: number
}

const registrationFlights = new Map<string, RegistrationFlight>()

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")
  const binary = window.atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const code =
      payload && typeof payload === "object" && !Array.isArray(payload) && "error" in payload
        ? (payload.error as { code?: unknown } | null)?.code
        : null
    throw new Error(typeof code === "string" ? code : "request_failed")
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_response")
  }
  return payload as Record<string, unknown>
}

function abortError(): DOMException {
  return new DOMException("Operation cancelled", "AbortError")
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError()
}

function waitForServiceWorker(signal: AbortSignal): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("service_worker_timeout")), 8000)
  })
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    onAbort = () => reject(abortError())
    signal.addEventListener("abort", onAbort, { once: true })
  })
  return Promise.race([navigator.serviceWorker.ready, timeoutPromise, abortPromise]).finally(() => {
    if (timeout) clearTimeout(timeout)
    if (onAbort) signal.removeEventListener("abort", onAbort)
  })
}

/** Fetches and validates the browser's registration controls and public VAPID key. */
export async function readPublicKey(): Promise<PublicKeyPayload> {
  const payload = await readResponse(await fetch("/api/web-push/public-key"))
  const vapid = payload.vapid
  if (
    payload.version !== 1 ||
    typeof payload.registration_enabled !== "boolean" ||
    !(vapid === null || (typeof vapid === "object" && vapid !== null))
  ) {
    throw new Error("invalid_response")
  }
  if (!vapid) return { registration_enabled: false, vapid: null }
  const artifact = vapid as Record<string, unknown>
  if (typeof artifact.version !== "string" || typeof artifact.public_key !== "string") {
    throw new Error("invalid_response")
  }
  return {
    registration_enabled: payload.registration_enabled,
    vapid: { version: artifact.version, public_key: artifact.public_key },
  }
}

function waitForRegistrationFlight<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort: (() => void) | undefined
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(abortError())
      return
    }
    onAbort = () => reject(abortError())
    signal.addEventListener("abort", onAbort, { once: true })
  })
  return Promise.race([promise, abortPromise]).finally(() => {
    if (onAbort) signal.removeEventListener("abort", onAbort)
  })
}

async function sendRegistrationRequest(
  body: string,
  endpoint: string,
  signal: AbortSignal
): Promise<RegistrationResult> {
  let lastError: unknown = new Error("request_failed")
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("/api/web-push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body,
      })
      const payload = await readResponse(response)
      if (!validateSubscriptionRegisterResponse(payload)) throw new Error("invalid_response")
      return {
        subscriptionId: payload.subscription_id as string,
        revision: String(payload.revision),
        endpoint,
      }
    } catch (error) {
      if (signal.aborted) throw error
      lastError = error
      const code = errorCode(error)
      if (!(
        error instanceof TypeError ||
        ["request_failed", "unavailable", "rate_limited"].includes(code)
      )) {
        throw error
      }
    }
  }
  throw lastError
}

function subscriptionPayload(subscription: PushSubscription) {
  const value = subscription.toJSON()
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error("invalid_subscription")
  }
  return {
    endpoint: value.endpoint,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth },
  }
}

/** Normalizes an operation failure to the existing notification UI error code. */
export function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "request_failed"
}

/** Registers a browser endpoint with bounded retries and shared in-flight requests. */
export async function registerPush(
  vapid: VapidArtifact,
  forceResubscribe: boolean,
  signal: AbortSignal,
  onRequestSent?: (endpoint: string) => void
): Promise<RegistrationResult> {
  throwIfAborted(signal)
  const registration = await waitForServiceWorker(signal)
  throwIfAborted(signal)
  if (!registration.pushManager) throw new Error("unsupported")
  let subscription = await registration.pushManager.getSubscription()
  const storedVersion = window.localStorage.getItem(VAPID_VERSION_STORAGE_KEY)
  if (
    subscription &&
    (forceResubscribe || (storedVersion !== null && storedVersion !== vapid.version))
  ) {
    await subscription.unsubscribe()
    subscription = null
  }
  throwIfAborted(signal)
  const createdSubscription = !subscription
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapid.public_key),
  })
  if (signal.aborted) {
    if (createdSubscription) await subscription.unsubscribe()
    throw abortError()
  }
  const body = JSON.stringify({
    version: 1,
    vapid_key_version: vapid.version,
    subscription: subscriptionPayload(subscription),
  })
  throwIfAborted(signal)

  const key = body
  let flight = registrationFlights.get(key)
  if (!flight) {
    onRequestSent?.(subscription.endpoint)
    const controller = new AbortController()
    const promise = sendRegistrationRequest(body, subscription.endpoint, controller.signal)
    flight = { controller, promise, waiters: 0 }
    registrationFlights.set(key, flight)
    const currentFlight = flight
    const clearFlight = () => {
      if (registrationFlights.get(key) === currentFlight) registrationFlights.delete(key)
    }
    void promise.then(clearFlight, clearFlight)
  } else {
    onRequestSent?.(subscription.endpoint)
  }

  flight.waiters += 1
  try {
    return await waitForRegistrationFlight(flight.promise, signal)
  } catch (error) {
    if (signal.aborted && createdSubscription && flight.waiters === 1) {
      try {
        if (!(await subscription.unsubscribe())) throw new Error("web_push_unsubscribe_failed")
      } catch {
        throw new Error("web_push_unsubscribe_failed")
      }
    }
    throw error
  } finally {
    flight.waiters -= 1
    if (flight.waiters === 0) flight.controller.abort()
  }
}

/** Cleans deferred owner state, registers the endpoint, and persists validated metadata. */
export async function registerBrowserSubscription(
  ownerId: string,
  vapid: VapidArtifact,
  forceResubscribe: boolean,
  signal: AbortSignal,
  onRequestSent?: (endpoint: string) => void,
  requireConsent = false
): Promise<RegistrationResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener("abort", abort, { once: true })
  if (signal.aborted) abort()
  const stopConsentListener = requireConsent
    ? onBrowserPushConsentWithdrawn(ownerId, abort)
    : () => undefined
  const operationSignal = controller.signal
  try {
    throwIfAborted(operationSignal)
    if (requireConsent && !hasBrowserPushConsent(ownerId)) throw new Error("web_push_opt_out")
    const stored = readBrowserSubscriptionRecord(ownerId)
    if (stored?.status === "revoking") {
      if ((await retryBrowserSubscriptionCleanup(ownerId, operationSignal)) === "pending") {
        throw new Error("web_push_cleanup_failed")
      }
    }
    await waitForPendingBrowserSubscriptionCleanup()
    throwIfAborted(operationSignal)
    if (requireConsent && !hasBrowserPushConsent(ownerId)) throw new Error("web_push_opt_out")
    const current = readBrowserSubscriptionRecord(ownerId)
    if (
      !forceResubscribe &&
      current?.status === "enabled" &&
      current.vapidKeyVersion === vapid.version &&
      current.subscriptionId &&
      current.revision &&
      current.endpoint &&
      (await hasMatchingLocalBrowserSubscription(ownerId))
    ) {
      throwIfAborted(operationSignal)
      if (requireConsent && !hasBrowserPushConsent(ownerId)) throw new Error("web_push_opt_out")
      return {
        subscriptionId: current.subscriptionId,
        revision: current.revision,
        endpoint: current.endpoint,
      }
    }

    const registered = await registerPush(vapid, forceResubscribe, operationSignal, (endpoint) => {
      const previous = readBrowserSubscriptionRecord(ownerId)
      writeBrowserSubscriptionRecord({
        version: 1,
        ownerId,
        vapidKeyVersion: vapid.version,
        status: "unconfirmed",
        endpoint,
        ...(previous?.subscriptionId && previous.revision
          ? { subscriptionId: previous.subscriptionId, revision: previous.revision }
          : {}),
      })
      onRequestSent?.(endpoint)
    })
    throwIfAborted(operationSignal)
    if (requireConsent && !hasBrowserPushConsent(ownerId)) throw new Error("web_push_opt_out")
    writeBrowserSubscriptionRecord({
      version: 1,
      ownerId,
      vapidKeyVersion: vapid.version,
      status: "enabled",
      subscriptionId: registered.subscriptionId,
      revision: registered.revision,
      endpoint: registered.endpoint,
    })
    window.localStorage.setItem(VAPID_VERSION_STORAGE_KEY, vapid.version)
    return registered
  } finally {
    signal.removeEventListener("abort", abort)
    stopConsentListener()
  }
}
