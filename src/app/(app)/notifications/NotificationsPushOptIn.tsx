"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { HomeScreenGuide, LockScreenPreview } from "./NotificationsPushOptInGuidance"

type VapidArtifact = { version: string; public_key: string }
type PublicKeyPayload = {
  registration_enabled: boolean
  vapid: VapidArtifact | null
}
type PushState =
  "loading" | "idle" | "enabled" | "disabled" | "blocked" | "unsupported" | "resubscribe" | "error"

const VAPID_VERSION_STORAGE_KEY = "web-push-vapid-key-version"
const SERVICE_WORKER_READY_TIMEOUT_MS = 8000

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
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
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

function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error("service_worker_timeout")),
      SERVICE_WORKER_READY_TIMEOUT_MS
    )
  })
  return Promise.race([navigator.serviceWorker.ready, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout)
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

function errorCode(error: unknown): string {
  return error instanceof Error ? error.message : "request_failed"
}

function statusText(state: PushState): string {
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
  }
}

function initialState(artifact: PublicKeyPayload | undefined, rotated = false): PushState {
  if (!artifact?.registration_enabled || !artifact.vapid) return "disabled"
  const stored = window.localStorage.getItem(VAPID_VERSION_STORAGE_KEY)
  return rotated || (stored !== null && stored !== artifact.vapid.version) ? "resubscribe" : "idle"
}

/** Registers durable browser state only after an explicit permission gesture. */
async function registerPush(vapid: VapidArtifact, forceResubscribe: boolean) {
  const registration = await waitForServiceWorker()
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
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(vapid.public_key),
  })
  const response = await fetch("/api/web-push/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: 1,
      vapid_key_version: vapid.version,
      subscription: subscriptionPayload(subscription),
    }),
  })
  const payload = await readResponse(response)
  if (payload.version !== 1 || typeof payload.subscription_id !== "string") {
    throw new Error("invalid_response")
  }
  window.localStorage.setItem(VAPID_VERSION_STORAGE_KEY, vapid.version)
}

async function readPreflight() {
  if (!supportsWebPush()) return { state: "unsupported" as const, artifact: null }
  if (Notification.permission === "denied") return { state: "blocked" as const, artifact: null }
  const artifact = await readPublicKey()
  return { state: initialState(artifact), artifact }
}

function displayState(
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

function rotationState(artifact: PublicKeyPayload | null | undefined): PushState {
  return artifact?.registration_enabled && artifact.vapid ? "resubscribe" : "disabled"
}

function registrationErrorState(error: unknown): PushState {
  const code = errorCode(error)
  if (code === "disabled") return "disabled"
  if (code === "unsupported") return "unsupported"
  return "error"
}

// Called synchronously by the click handler before any network or worker await.
function requestPermission(): Promise<NotificationPermission> {
  return Notification.permission === "default"
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission)
}

/** Keeps public-key fetching separate from the result of an explicit opt-in. */
export function NotificationsPushOptIn() {
  const [result, setResult] = React.useState<PushState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const preflight = useQuery({
    queryKey: ["web-push", "public-key"],
    queryFn: readPreflight,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const preflightError = preflight.isError
  const state = displayState(
    busy,
    preflight.isFetching,
    preflightError,
    result,
    preflight.data?.state
  )
  const actionDisabled =
    busy || ["loading", "disabled", "blocked", "unsupported", "enabled"].includes(state)

  const handleEnable = async () => {
    if (actionDisabled) return
    if (preflightError) {
      setResult(null)
      await preflight.refetch()
      return
    }
    const vapid = preflight.data?.artifact?.vapid
    if (!vapid) return
    setBusy(true)
    try {
      const permission = await requestPermission()
      if (permission !== "granted") {
        setResult("blocked")
        return
      }
      await registerPush(vapid, state === "resubscribe")
      setResult("enabled")
    } catch (error) {
      if (errorCode(error) === "key_version_mismatch") {
        const refreshed = await preflight.refetch()
        setResult(rotationState(refreshed.data?.artifact))
      } else {
        setResult(registrationErrorState(error))
      }
    } finally {
      setBusy(false)
    }
  }

  const actionLabel = preflightError
    ? "Thử lại"
    : state === "resubscribe"
      ? "Đăng ký lại thông báo"
      : "Bật thông báo"
  return (
    <Card className="overflow-hidden border-slate-200/80 bg-gradient-to-br from-white via-sky-50/40 to-amber-50/50 shadow-sm">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm">
            <Bell className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <CardTitle>Thông báo trên trình duyệt</CardTitle>
            <CardDescription>
              Bật thông báo trên trình duyệt không tự thêm bạn vào danh sách người nhận.
            </CardDescription>
          </div>
        </div>
        {state === "enabled" ? (
          <CheckCircle2 className="size-5 text-emerald-600" aria-label="Đã bật" />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="space-y-4">
            {busy ? (
              <p role="status" aria-live="polite" className="text-sm text-slate-700">
                Đang chuẩn bị đăng ký thông báo...
              </p>
            ) : state === "error" ? (
              <p role="alert" aria-live="assertive" className="text-sm text-red-700">
                {statusText(state)}
              </p>
            ) : (
              <p role="status" aria-live="polite" className="text-sm text-slate-700">
                {statusText(state)}
              </p>
            )}
            <Button
              type="button"
              className="text-sm"
              onClick={() => void handleEnable()}
              disabled={actionDisabled}
            >
              {busy ? "Đang bật thông báo" : actionLabel}
            </Button>
            {state === "blocked" ? (
              <p className="text-sm text-muted-foreground">
                Hãy cho phép thông báo trong cài đặt trình duyệt rồi quay lại trang này.
              </p>
            ) : null}
            {state === "resubscribe" ? (
              <p className="text-sm text-muted-foreground">
                Khóa bảo mật đã được thay đổi. Bạn cần thao tác lại để đăng ký subscription mới.
              </p>
            ) : null}
          </div>
          <LockScreenPreview />
        </div>
        <HomeScreenGuide />
      </CardContent>
    </Card>
  )
}
