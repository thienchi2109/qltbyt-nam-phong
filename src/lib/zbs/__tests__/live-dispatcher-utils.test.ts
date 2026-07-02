import { describe, expect, it } from "vitest"

import { getProviderSentAt } from "@/lib/zbs/live-dispatcher-utils"

describe("getProviderSentAt", () => {
  it("normalizes Unix-second sent_time values", () => {
    expect(
      getProviderSentAt(
        {
          data: {
            sent_time: "1719734401",
          },
        },
        new Date("2026-06-30T08:00:00.000Z")
      )
    ).toBe("2024-06-30T08:00:01.000Z")
  })

  it("falls back to sent_time when sent_at is empty", () => {
    expect(
      getProviderSentAt(
        {
          data: {
            sent_at: "",
            sent_time: "1719734401000",
          },
        },
        new Date("2026-06-30T08:00:00.000Z")
      )
    ).toBe("2024-06-30T08:00:01.000Z")
  })

  it("falls back to sent_time when sent_at is zero", () => {
    expect(
      getProviderSentAt(
        {
          data: {
            sent_at: 0,
            sent_time: "1719734401000",
          },
        },
        new Date("2026-06-30T08:00:00.000Z")
      )
    ).toBe("2024-06-30T08:00:01.000Z")
  })

  it("falls back to top-level sent_time", () => {
    expect(
      getProviderSentAt(
        {
          data: {},
          sent_time: "1719734401000",
        },
        new Date("2026-06-30T08:00:00.000Z")
      )
    ).toBe("2024-06-30T08:00:01.000Z")
  })
})
