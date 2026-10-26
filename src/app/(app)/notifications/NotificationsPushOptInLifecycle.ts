import {
  hasMatchingLocalBrowserSubscription,
  readBrowserSubscriptionRecord,
} from "@/lib/web-push/browser-lifecycle"
import { hasBrowserPushConsent } from "@/lib/web-push/browser-consent"
import {
  errorCode,
  readPublicKey,
  VAPID_VERSION_STORAGE_KEY,
  type PublicKeyPayload,
} from "@/lib/web-push/browser-registration"

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

function supportsWebPush(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window.PushManager !== "undefined"
  )
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
  if (hasBrowserPushConsent(ownerId) && Notification.permission === "granted") {
    return { state: "unconfirmed" as const, artifact }
  }
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
