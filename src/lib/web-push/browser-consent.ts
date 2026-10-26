const STORAGE_PREFIX = "qltbyt:web-push:consent:"
const CONSENT_CHANGE_EVENT = "qltbyt:web-push:consent-change"

function storageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(ownerId)}`
}

/** Reads owner consent, distinguishing a missing legacy choice from explicit opt-out. */
export function readBrowserPushConsent(ownerId: string): boolean | null {
  if (!ownerId || typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(storageKey(ownerId))
    if (value === null) return null
    return value === "true"
  } catch {
    return false
  }
}

/** Reports whether this account opted in on the current browser. */
export function hasBrowserPushConsent(ownerId: string): boolean {
  return readBrowserPushConsent(ownerId) === true
}

/** Persists an account's choice and notifies in-flight registration listeners. */
export function setBrowserPushConsent(ownerId: string, enabled: boolean): void {
  if (!ownerId || typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(ownerId), String(enabled))
  } catch {
    // Browser storage is best effort; the browser subscription remains authoritative.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: { ownerId, enabled } }))
}

/** Watches consent withdrawal in this document or another tab; returns its cleanup. */
export function onBrowserPushConsentWithdrawn(ownerId: string, callback: () => void): () => void {
  if (!ownerId || typeof window === "undefined") return () => undefined
  const onChange = (event: Event) => {
    const detail = (event as CustomEvent<{ ownerId?: string; enabled?: boolean }>).detail
    if (detail?.ownerId === ownerId && detail.enabled === false) callback()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(ownerId) && event.newValue !== "true") callback()
  }
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(CONSENT_CHANGE_EVENT, onChange)
    window.removeEventListener("storage", onStorage)
  }
}
