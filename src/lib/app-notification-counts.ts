export interface AppNotificationCounts {
  repair: number
  transfer: number
  maintenance: number
}

export type AppNotificationBadgeKey = keyof AppNotificationCounts

export const EMPTY_APP_NOTIFICATION_COUNTS: AppNotificationCounts = {
  repair: 0,
  transfer: 0,
  maintenance: 0,
}

const BADGE_CAP = 9

export function normalizeNotificationCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

export function formatNotificationBadgeCount(count: number): string | null {
  const normalizedCount = normalizeNotificationCount(count)

  if (normalizedCount <= 0) {
    return null
  }

  return normalizedCount > BADGE_CAP ? "9+" : String(normalizedCount)
}

export function sumNotificationBadgeCounts(
  keys: readonly AppNotificationBadgeKey[],
  counts: AppNotificationCounts
): number {
  return keys.reduce((total, key) => total + normalizeNotificationCount(counts[key]), 0)
}
