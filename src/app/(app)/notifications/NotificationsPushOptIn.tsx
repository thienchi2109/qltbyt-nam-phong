"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  cleanupBrowserSubscription,
  discardLocalBrowserSubscription,
  readBrowserSubscriptionRecord,
  retryBrowserSubscriptionCleanup,
  waitForPendingBrowserSubscriptionCleanup,
  writeBrowserSubscriptionRecord,
} from "@/lib/web-push/browser-lifecycle"
import { HomeScreenGuide, LockScreenPreview } from "./NotificationsPushOptInGuidance"
import {
  VAPID_VERSION_STORAGE_KEY,
  displayState,
  errorCode,
  readPreflight,
  registerPush,
  registrationErrorState,
  requestPermission,
  rotationState,
  statusText,
  type PushState,
} from "./NotificationsPushOptInLifecycle"

/** Keeps public-key fetching separate from the result of an explicit opt-in. */
type PushOperation = {
  id: number
  controller: AbortController
  kind: "register" | "revoke"
}

/** Web Push lifecycle entrypoint. */
export function NotificationsPushOptIn({ userId }: { userId: string }) {
  const [result, setResult] = React.useState<PushState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [operationKind, setOperationKind] = React.useState<"register" | "revoke">("register")
  const [operationPhase, setOperationPhase] = React.useState<"preparing" | "requesting">(
    "preparing"
  )
  const [retryExhausted, setRetryExhausted] = React.useState(false)
  const operationRef = React.useRef<PushOperation | null>(null)
  const operationIdRef = React.useRef(0)
  const registrationAttemptsRef = React.useRef(0)
  const previousOwnerRef = React.useRef(userId)
  const ownerCleanupRef = React.useRef<Promise<unknown>>(Promise.resolve())
  const ownerCleanupFailedRef = React.useRef(false)
  const preflight = useQuery({
    queryKey: ["web-push", "public-key", userId],
    queryFn: () => readPreflight(userId),
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
  const persistedRevoke = readBrowserSubscriptionRecord(userId)?.status === "revoking"
  const actionDisabled =
    busy ||
    retryExhausted ||
    ["loading", "disabled", "blocked", "unsupported", "enabled"].includes(state)

  React.useEffect(() => {
    const previousOwner = previousOwnerRef.current
    if (previousOwner !== userId) {
      operationRef.current?.controller.abort()
      operationRef.current = null
      setBusy(false)
      setResult(null)
      setRetryExhausted(false)
      setOperationKind("register")
      registrationAttemptsRef.current = 0
      ownerCleanupFailedRef.current = true
      const cleanup = discardLocalBrowserSubscription(previousOwner)
      const trackedCleanup = cleanup
        .then(() => {
          if (ownerCleanupRef.current === trackedCleanup) ownerCleanupFailedRef.current = false
        })
        .catch(() => undefined)
      ownerCleanupRef.current = trackedCleanup
      previousOwnerRef.current = userId
    }
  }, [userId])

  React.useEffect(() => {
    return () => {
      operationRef.current?.controller.abort()
    }
  }, [])

  const isCurrentOperation = (operation: PushOperation): boolean =>
    operationRef.current?.id === operation.id && !operation.controller.signal.aborted

  const cancelOperation = () => {
    const operation = operationRef.current
    if (!operation) return
    operation.controller.abort()
    operationRef.current = null
    setBusy(false)
    setOperationPhase("preparing")
    const stored = readBrowserSubscriptionRecord(userId)
    setOperationKind(operation.kind)
    if (operation.kind === "revoke" && stored?.subscriptionId && stored.revision) {
      writeBrowserSubscriptionRecord({ ...stored, status: "revoking" })
    } else {
      writeBrowserSubscriptionRecord({
        version: 1,
        ownerId: userId,
        vapidKeyVersion: stored?.vapidKeyVersion ?? preflight.data?.artifact?.vapid?.version ?? "",
        status: "cancelled",
        ...(stored?.subscriptionId && stored.revision
          ? { subscriptionId: stored.subscriptionId, revision: stored.revision }
          : {}),
      })
    }
    setResult("cancelled")
  }

  const beginOperation = (kind: "register" | "revoke") => {
    const operation = {
      id: operationIdRef.current + 1,
      controller: new AbortController(),
      kind,
    }
    operationIdRef.current = operation.id
    operationRef.current = operation
    setOperationKind(kind)
    setOperationPhase("preparing")
    setBusy(true)
    return operation
  }

  const handleEnable = async () => {
    if (actionDisabled) return
    if (persistedRevoke) {
      const operation = beginOperation("revoke")
      setOperationPhase("requesting")
      try {
        const cleanup = await retryBrowserSubscriptionCleanup(userId, operation.controller.signal)
        if (isCurrentOperation(operation)) {
          setResult(cleanup === "pending" ? "unconfirmed" : "idle")
          if (cleanup !== "pending") setOperationKind("register")
        }
      } finally {
        if (operationRef.current?.id === operation.id) {
          operationRef.current = null
          setBusy(false)
          setOperationPhase("preparing")
        }
      }
      return
    }
    if (preflightError) {
      setResult(null)
      await preflight.refetch()
      return
    }
    const vapid = preflight.data?.artifact?.vapid
    if (!vapid) return
    if (registrationAttemptsRef.current >= 3) {
      setRetryExhausted(true)
      return
    }
    registrationAttemptsRef.current += 1
    const operation = beginOperation("register")
    // Capture permission in the click handler before waiting on account cleanup.
    let permissionPromise: Promise<NotificationPermission>
    try {
      permissionPromise = requestPermission()
      await ownerCleanupRef.current
      await waitForPendingBrowserSubscriptionCleanup()
      if (!isCurrentOperation(operation)) return
      if (ownerCleanupFailedRef.current) {
        setResult("error")
        return
      }
      const permission = await permissionPromise
      if (!isCurrentOperation(operation)) return
      if (permission !== "granted") {
        setResult("blocked")
        return
      }
      setOperationPhase("requesting")
      const registered = await registerPush(
        vapid,
        state === "resubscribe",
        operation.controller.signal,
        () => {
          if (!isCurrentOperation(operation)) return
          setOperationPhase("requesting")
          const stored = readBrowserSubscriptionRecord(userId)
          writeBrowserSubscriptionRecord({
            version: 1,
            ownerId: userId,
            vapidKeyVersion: vapid.version,
            status: "unconfirmed",
            ...(stored?.subscriptionId && stored.revision
              ? { subscriptionId: stored.subscriptionId, revision: stored.revision }
              : {}),
          })
        }
      )
      if (!isCurrentOperation(operation)) return
      writeBrowserSubscriptionRecord({
        version: 1,
        ownerId: userId,
        vapidKeyVersion: vapid.version,
        status: "enabled",
        subscriptionId: registered.subscriptionId,
        revision: registered.revision,
        endpoint: registered.endpoint,
      })
      window.localStorage.setItem(VAPID_VERSION_STORAGE_KEY, vapid.version)
      registrationAttemptsRef.current = 0
      setRetryExhausted(false)
      setResult("enabled")
    } catch (error) {
      if (!isCurrentOperation(operation)) return
      if (errorCode(error) === "key_version_mismatch") {
        const refreshed = await preflight.refetch()
        if (!isCurrentOperation(operation)) return
        setResult(rotationState(refreshed.data?.artifact))
      } else {
        const nextState = registrationErrorState(error)
        setResult(nextState)
        if (registrationAttemptsRef.current >= 3) setRetryExhausted(true)
      }
    } finally {
      if (operationRef.current?.id === operation.id) {
        operationRef.current = null
        setBusy(false)
        setOperationPhase("preparing")
      }
    }
  }

  const handleDisable = async () => {
    if (busy) return
    const operation = beginOperation("revoke")
    try {
      const cleanup = await cleanupBrowserSubscription(
        userId,
        () => {
          if (isCurrentOperation(operation)) setOperationPhase("requesting")
        },
        operation.controller.signal
      )
      if (!isCurrentOperation(operation)) return
      if (cleanup === "pending") {
        setResult("unconfirmed")
        return
      }
      setOperationKind("register")
      setResult("idle")
    } finally {
      if (operationRef.current?.id === operation.id) {
        operationRef.current = null
        setBusy(false)
        setOperationPhase("preparing")
      }
    }
  }

  const actionLabel =
    operationKind === "revoke" && persistedRevoke
      ? "Thử lại"
      : preflightError || state === "error" || state === "unconfirmed"
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
                {operationKind === "revoke"
                  ? "Đang tắt thông báo trên trình duyệt..."
                  : operationPhase === "requesting"
                    ? "Đã gửi yêu cầu đăng ký thông báo..."
                    : "Đang chuẩn bị đăng ký thông báo..."}
              </p>
            ) : state === "error" ? (
              <p role="alert" aria-live="assertive" className="text-sm text-red-700">
                {statusText(state, operationKind)}
              </p>
            ) : (
              <p role="status" aria-live="polite" className="text-sm text-slate-700">
                {state === "unconfirmed" && (operationKind === "revoke" || persistedRevoke)
                  ? "Đã tắt cục bộ nhưng chưa xác nhận thu hồi trên máy chủ. Vui lòng thử lại."
                  : statusText(state, operationKind)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="text-sm"
                onClick={() => void handleEnable()}
                disabled={actionDisabled}
              >
                {busy
                  ? operationKind === "revoke"
                    ? "Đang tắt thông báo"
                    : "Đang bật thông báo"
                  : actionLabel}
              </Button>
              {busy ? (
                <Button type="button" variant="outline" onClick={cancelOperation}>
                  Hủy thao tác
                </Button>
              ) : null}
              {state === "enabled" ? (
                <Button type="button" variant="outline" onClick={() => void handleDisable()}>
                  Tắt thông báo
                </Button>
              ) : null}
            </div>
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
