import {
  hasMatchingLocalBrowserSubscription,
  readBrowserSubscriptionRecord,
} from "@/lib/web-push/browser-lifecycle"
import { validateSubscriptionRegisterResponse } from "@/lib/web-push/subscription-validation"

/** Web Push lifecycle entrypoint. */
export type VapidArtifact = { version: string; public_key: string }
/** Web Push lifecycle entrypoint. */
export type PublicKeyPayload = {
  registration_enabled: boolean
  vapid: VapidArtifact | null
}
/** Web Push lifecycle entrypoint. */
export type PushState =
  | "loading"
  | "idle"
  | "enabled"
  | "disabled"
  | "blocked"
  | "unsupported"
  | "resubscribe"
  | "error"
  | "unconfirmed"
  | "cancelled"

/** Web Push lifecycle entrypoint. */
export const VAPID_VERSION_STORAGE_KEY = "web-push-vapid-key-version"

function supportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window.PushManager !== "undefined"
  )
}

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

function waitForServiceWorker(signal: AbortSignal): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("service_worker_timeout")), 8000)
  })
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(new DOMException("Operation cancelled", "AbortError"))
    signal.addEventListener("abort", onAbort, { once: true })
  })
  return Promise.race([navigator.serviceWorker.ready, timeoutPromise, abortPromise]).finally(() => {
    if (timeout) clearTimeout(timeout)
    if (onAbort) signal.removeEventListener("abort", onAbort)
  })
}

async function readPublicKey(): Promise<PublicKeyPayload> {
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

/** Web Push lifecycle entrypoint. */
export function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "request_failed"
}

/** Web Push lifecycle entrypoint. */
export function statusText(
  state: PushState,
  operationKind: "register" | "revoke" = "register"
): string {
  switch (state) {
    case "loading":
      return "Đang kiểm tra khả năng nhận thông báo..."
    case "idle":
      return "Thông báo đang tắt trên trình duyệt này."
    case "enabled":
      return "Thông báo đã bật trên trình duyệt."
    case "disabled":
      return "Đăng ký thông báo đang tạm tắt."
    case "blocked":
      return "Thông báo bị chặn trong trình duyệt."
    case "unsupported":
      return "Trình duyệt này chưa hỗ trợ thông báo Web Push."
    case "resubscribe":
      return "Cần đăng ký lại thông báo để dùng khóa bảo mật mới."
    case "error":
      return "Không thể bật thông báo trên trình duyệt. Vui lòng thử lại."
    case "unconfirmed":
      return "Yêu cầu đã gửi nhưng chưa xác nhận trên máy chủ. Vui lòng thử lại."
    case "cancelled":
      return operationKind === "revoke"
        ? "Đã hủy thao tác tắt thông báo."
        : "Đã hủy thao tác đăng ký thông báo."
  }
}

function initialState(artifact: PublicKeyPayload | undefined, rotated = false): PushState {
  if (!artifact?.registration_enabled || !artifact.vapid) return "disabled"
  const stored = window.localStorage.getItem(VAPID_VERSION_STORAGE_KEY)
  return rotated || (stored !== null && stored !== artifact.vapid.version) ? "resubscribe" : "idle"
}

/** Web Push lifecycle entrypoint. */
export async function registerPush(
  vapid: VapidArtifact,
  forceResubscribe: boolean,
  signal: AbortSignal,
  onRequestSent?: () => void
) {
  const registration = await waitForServiceWorker(signal)
  if (signal.aborted) throw new DOMException("Operation cancelled", "AbortError")
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
  if (signal.aborted) throw new DOMException("Operation cancelled", "AbortError")
  const createdSubscription = !subscription
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapid.public_key),
  })
  if (signal.aborted) {
    if (createdSubscription) await subscription.unsubscribe()
    throw new DOMException("Operation cancelled", "AbortError")
  }
  const body = JSON.stringify({
    version: 1,
    vapid_key_version: vapid.version,
    subscription: subscriptionPayload(subscription),
  })
  let lastError: unknown = new Error("request_failed")
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      onRequestSent?.()
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
        endpoint: subscription.endpoint,
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

/** Web Push lifecycle entrypoint. */
export async function readPreflight(ownerId: string) {
  if (!supportsWebPush()) return { state: "unsupported" as const, artifact: null }
  if (Notification.permission === "denied") return { state: "blocked" as const, artifact: null }
  const artifact = await readPublicKey()
  const stored = readBrowserSubscriptionRecord(ownerId)
  if (
    stored?.status === "enabled" &&
    stored.vapidKeyVersion === artifact.vapid?.version &&
    (await hasMatchingLocalBrowserSubscription(ownerId))
  ) {
    return { state: "enabled" as const, artifact }
  }
  if (stored?.status === "revoking" || stored?.status === "unconfirmed") {
    return { state: "unconfirmed" as const, artifact }
  }
  if (stored?.status === "cancelled") return { state: "cancelled" as const, artifact }
  return { state: initialState(artifact), artifact }
}

/** Web Push lifecycle entrypoint. */
export function displayState(
  busy: boolean,
  fetching: boolean,
  failed: boolean,
  result: PushState | null,
  initial?: PushState
): PushState {
  if (busy || fetching) return "loading"
  if (failed) return "error"
  return result ?? initial ?? "loading"
}

/** Web Push lifecycle entrypoint. */
export function rotationState(artifact: PublicKeyPayload | null | undefined): PushState {
  return artifact?.registration_enabled && artifact.vapid ? "resubscribe" : "disabled"
}

/** Web Push lifecycle entrypoint. */
export function registrationErrorState(error: unknown): PushState {
  const code = errorCode(error)
  if (code === "disabled") return "disabled"
  if (code === "unsupported") return "unsupported"
  if (
    code === "request_failed" ||
    code === "unavailable" ||
    code === "rate_limited" ||
    error instanceof TypeError
  ) {
    return "unconfirmed"
  }
  return "error"
}

/** Web Push lifecycle entrypoint. */
export function requestPermission(): Promise<NotificationPermission> {
  return Notification.permission === "default"
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission)
}
