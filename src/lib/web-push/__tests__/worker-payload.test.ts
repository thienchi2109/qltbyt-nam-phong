import { describe, expect, it } from "vitest"

import { parseWebPushNotificationPayload, truncateUtf8 } from "../worker-payload"

const notificationId = "00000000-0000-4000-8000-000000000001"

function payload(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    notification_id: notificationId,
    title: "Thiết bị cần xử lý",
    body: "Khoa Huyết học\nMô tả sự cố",
    url: "/repair-requests?action=view&requestId=42",
    tag: "repair-request:42",
    ...overrides,
  }
}

describe("browser Web Push payloads", () => {
  it("truncates Unicode text without splitting a code point", () => {
    const value = "Máy ly tâm 🧪".repeat(100)
    const truncated = truncateUtf8(value, 64)

    expect(truncated.endsWith("…")).toBe(true)
    expect(new TextEncoder().encode(truncated).byteLength).toBeLessThanOrEqual(64)
    expect([...truncated].join("")).toBe(truncated)
  })

  it("accepts the text-only repair deep-link contract and derives a stable tag", () => {
    const result = parseWebPushNotificationPayload(payload({ tag: "repair-request:42" }))

    expect(result).toEqual({
      notificationId,
      title: "Thiết bị cần xử lý",
      body: "Khoa Huyết học\nMô tả sự cố",
      url: "/repair-requests?action=view&requestId=42",
      tag: "repair-request:42",
    })
  })

  it("keeps oversized display text within the browser byte budgets", () => {
    const result = parseWebPushNotificationPayload(
      payload({ title: "Thiết bị ".repeat(100), body: "🧪 mô tả ".repeat(500) })
    )

    expect(result).not.toBeNull()
    expect(new TextEncoder().encode(result?.title ?? "").byteLength).toBeLessThanOrEqual(256)
    expect(new TextEncoder().encode(result?.body ?? "").byteLength).toBeLessThanOrEqual(2057)
    expect(result?.title.endsWith("…")).toBe(true)
    expect(result?.body.endsWith("…")).toBe(true)
  })

  it.each([
    { url: "https://evil.example/repair-requests?action=view&requestId=42" },
    { url: "/repair-requests?action=view&requestId=42", tag: "unsafe-tag" },
    { url: "/repair-requests?action=view&requestId=42#unsafe" },
    { extra: "<img src=x onerror=alert(1)>" },
  ])("rejects unsafe worker payload %#", (override) => {
    expect(parseWebPushNotificationPayload(payload(override))).toBeNull()
  })
})
