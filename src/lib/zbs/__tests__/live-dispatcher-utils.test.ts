import { describe, expect, it } from "vitest"

import { getProviderSentAt } from "../live-dispatcher-utils"

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
})
