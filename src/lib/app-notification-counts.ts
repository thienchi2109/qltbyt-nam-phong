export interface AppNotificationCounts {
  repair: number
  transfer: number
  maintenance: number
}

export type AppNotificationBadgeKey = keyof AppNotificationCounts

/** Empty notification count state used before scoped counts are loaded. */
export const EMPTY_APP_NOTIFICATION_COUNTS: AppNotificationCounts = {
  repair: 0,
  transfer: 0,
  maintenance: 0,
}

/** Converts unknown RPC count values into non-negative integer badge counts. */
export function normalizeNotificationCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/** Formats a normalized app notification count for badge display. */
export function formatNotificationBadgeCount(count: number): string | null {
  const normalizedCount = normalizeNotificationCount(count)

  if (normalizedCount <= 0) {
    return null
  }

  return String(normalizedCount)
}

/** Sums selected notification count fields using the shared count normalizer. */
export function sumNotificationBadgeCounts(
  keys: readonly AppNotificationBadgeKey[],
  counts: AppNotificationCounts
): number {
  return keys.reduce((total, key) => total + normalizeNotificationCount(counts[key]), 0)
}
