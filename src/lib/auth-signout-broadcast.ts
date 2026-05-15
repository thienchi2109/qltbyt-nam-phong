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

let fallbackSourceIdCounter = 0

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function createTabSourceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16)
    globalThis.crypto.getRandomValues(bytes)
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  }

  fallbackSourceIdCounter += 1
  return `tab-${Date.now().toString(36)}-${fallbackSourceIdCounter.toString(36)}`
}

const TAB_SOURCE_ID = createTabSourceId()

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

  if (typeof globalThis.window === "undefined") {
    return payload
  }

  let broadcastSucceeded = false
  try {
    const channel = new globalThis.BroadcastChannel(AUTH_SIGNOUT_CHANNEL)
    channel.postMessage(payload)
    channel.close()
    broadcastSucceeded = true
  } catch {
    // Storage fallback below still fans out to other tabs.
  }

  if (!broadcastSucceeded) {
    try {
      globalThis.localStorage.setItem(AUTH_SIGNOUT_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Same-tab signOut still proceeds even if browser storage is unavailable.
    }
  }

  return payload
}

export function subscribeAuthSignout(listener: (payload: AuthSignoutBroadcastPayload) => void): () => void {
  if (typeof globalThis.window === "undefined") {
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

  globalThis.addEventListener("storage", handleStorage)

  return () => {
    channel?.close()
    globalThis.removeEventListener("storage", handleStorage)
  }
}
