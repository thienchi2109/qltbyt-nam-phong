import { describe, expect, it } from "vitest"

import { formatNotificationBadgeCount } from "@/lib/app-notification-counts"

describe("formatNotificationBadgeCount", () => {
  it("returns null for counts that should not render a badge", () => {
    expect(formatNotificationBadgeCount(0)).toBeNull()
    expect(formatNotificationBadgeCount(-1)).toBeNull()
    expect(formatNotificationBadgeCount(Number.NaN)).toBeNull()
    expect(formatNotificationBadgeCount(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it("renders the exact normalized count without an upper display cap", () => {
    expect(formatNotificationBadgeCount(1)).toBe("1")
    expect(formatNotificationBadgeCount(9)).toBe("9")
    expect(formatNotificationBadgeCount(10)).toBe("10")
    expect(formatNotificationBadgeCount(12)).toBe("12")
    expect(formatNotificationBadgeCount(123)).toBe("123")
    expect(formatNotificationBadgeCount(12.8)).toBe("12")
  })
})
