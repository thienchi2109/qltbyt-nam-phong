import { describe, expect, it } from "vitest"

import { calculateUsageDurationMinutes } from "../usage-duration"

describe("calculateUsageDurationMinutes", () => {
  it("returns zero when the start timestamp is invalid", () => {
    expect(calculateUsageDurationMinutes("invalid-date", Date.parse("2026-05-13T00:10:00Z"))).toBe(0)
  })

  it("floors valid durations and clamps negative values", () => {
    expect(calculateUsageDurationMinutes("2026-05-13T00:00:30Z", Date.parse("2026-05-13T00:10:59Z"))).toBe(10)
    expect(calculateUsageDurationMinutes("2026-05-13T00:10:00Z", Date.parse("2026-05-13T00:00:00Z"))).toBe(0)
  })
})
