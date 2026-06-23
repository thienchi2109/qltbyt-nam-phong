import type { VisibilityState } from "@tanstack/react-table"

const STORAGE_KEY_PREFIX = "equipment:columnVisibility:v1:user:"

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: VisibilityState) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Browser storage can be unavailable or full; keep table state in memory.
  }
}

function parseVisibility(value: string | null): VisibilityState | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }

    const visibility: VisibilityState = {}
    for (const [columnId, isVisible] of Object.entries(parsed)) {
      if (typeof isVisible !== "boolean") {
        return null
      }
      visibility[columnId] = isVisible
    }

    return visibility
  } catch {
    return null
  }
}

/** Reads the current user's persisted Equipment column visibility with defaults. */
export function getEquipmentColumnVisibility(
  userId: string | undefined,
  defaultVisibility: VisibilityState
): VisibilityState {
  if (!userId) return defaultVisibility

  const storedVisibility = parseVisibility(safeGet(getStorageKey(userId)))
  return storedVisibility ? { ...defaultVisibility, ...storedVisibility } : defaultVisibility
}

/** Persists the current user's Equipment column visibility preference. */
export function setEquipmentColumnVisibility(
  userId: string | undefined,
  visibility: VisibilityState
) {
  if (!userId) return

  safeSet(getStorageKey(userId), visibility)
}
