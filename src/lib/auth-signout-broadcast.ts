import type { AuthPendingSignoutReason } from "@/types/auth"

export const AUTH_SIGNOUT_CHANNEL = "qltbyt:auth-signout"
export const AUTH_SIGNOUT_STORAGE_KEY = "qltbyt:auth-signout"

export type AuthSignoutBroadcastPayload = {
  type: "auth:signout"
  reason: AuthPendingSignoutReason
  callbackUrl: string
  issuedAt: number
  sourceId: string
}

type AuthSignoutBroadcastInput = {
  reason: AuthPendingSignoutReason
  callbackUrl: string
  issuedAt?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const TAB_SOURCE_ID = Math.random().toString(36).slice(2)

export function isAuthSignoutBroadcastPayload(value: unknown): value is AuthSignoutBroadcastPayload {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.type === "auth:signout" &&
    typeof value.reason === "string" &&
    typeof value.callbackUrl === "string" &&
    typeof value.issuedAt === "number" &&
    typeof value.sourceId === "string"
  )
}

function parseAuthSignoutPayload(value: string | null): AuthSignoutBroadcastPayload | null {
  if (!value) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(value)
    return isAuthSignoutBroadcastPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function broadcastAuthSignout({
  reason,
  callbackUrl,
  issuedAt = Date.now(),
}: AuthSignoutBroadcastInput): AuthSignoutBroadcastPayload {
  const payload: AuthSignoutBroadcastPayload = {
    type: "auth:signout",
    reason,
    callbackUrl,
    issuedAt,
    sourceId: TAB_SOURCE_ID,
  }

  if (typeof window === "undefined") {
    return payload
  }

  try {
    const channel = new BroadcastChannel(AUTH_SIGNOUT_CHANNEL)
    channel.postMessage(payload)
    channel.close()
  } catch {
    // Storage fallback below still fans out to other tabs.
  }

  try {
    window.localStorage.setItem(AUTH_SIGNOUT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Same-tab signOut still proceeds even if browser storage is unavailable.
  }

  return payload
}

export function subscribeAuthSignout(listener: (payload: AuthSignoutBroadcastPayload) => void): () => void {
  if (typeof window === "undefined") {
    return () => {}
  }

  const channel = (() => {
    try {
      return new BroadcastChannel(AUTH_SIGNOUT_CHANNEL)
    } catch {
      return null
    }
  })()

  if (channel) {
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (isAuthSignoutBroadcastPayload(event.data) && event.data.sourceId !== TAB_SOURCE_ID) {
        listener(event.data)
      }
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SIGNOUT_STORAGE_KEY) {
      return
    }

    const payload = parseAuthSignoutPayload(event.newValue)
    if (payload && payload.sourceId !== TAB_SOURCE_ID) {
      listener(payload)
    }
  }

  window.addEventListener("storage", handleStorage)

  return () => {
    channel?.close()
    window.removeEventListener("storage", handleStorage)
  }
}
