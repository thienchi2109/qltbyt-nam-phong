import { describe, expect, it, vi } from "vitest"

import { toDateFilterValue } from "@/app/(app)/transfers/_components/useTransfersPageController"

describe("toDateFilterValue", () => {
  it("serializes the local calendar date without timezone shifting", () => {
    const localDate = new Date("2026-04-03T17:00:00.000Z")

    vi.spyOn(localDate, "getFullYear").mockReturnValue(2026)
    vi.spyOn(localDate, "getMonth").mockReturnValue(3)
    vi.spyOn(localDate, "getDate").mockReturnValue(4)
    vi.spyOn(localDate, "toISOString").mockReturnValue("2026-04-03T17:00:00.000Z")

    expect(toDateFilterValue(localDate)).toBe("2026-04-04")
  })

  it("returns undefined when the value is missing", () => {
    expect(toDateFilterValue(null)).toBeUndefined()
    expect(toDateFilterValue(undefined)).toBeUndefined()
  })
})
