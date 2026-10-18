import { describe, expect, it } from "vitest"
import { currentTemperatureSlot, validateTemperatureCapture } from "./temperature-monitoring"
import type { TemperatureSlot } from "@/types/temperature-monitoring"

const overnight = {
  slot_start: "2026-07-02T15:00:00Z",
  slot_end: "2026-07-02T23:00:00Z",
} as TemperatureSlot

describe("authoritative temperature intervals", () => {
  it("selects only an unambiguous active server interval, including overnight", () => {
    expect(currentTemperatureSlot([overnight], "2026-07-02T16:00:00Z")).toBe(overnight)
    expect(currentTemperatureSlot([overnight], overnight.slot_end)).toBeNull()
    expect(currentTemperatureSlot([overnight, overnight], "2026-07-02T16:00:00Z")).toBeNull()
  })
  it("interprets wall time in the equipment timezone independently of browser timezone", () => {
    expect(
      validateTemperatureCapture(
        { ...overnight, display_timezone: "Asia/Ho_Chi_Minh" },
        "2026-07-02T23:00",
        "2026-07-03T00:00Z"
      )
    ).toBe("2026-07-02T16:00:00.000Z")
    const fold = {
      ...overnight,
      slot_start: "2026-11-01T00:00Z",
      slot_end: "2026-11-02T00:00Z",
      display_timezone: "America/New_York",
    }
    expect(() =>
      validateTemperatureCapture(fold, "2026-11-01T01:30", "2026-11-03T00:00Z")
    ).toThrow()
  })
  it("requires explicit historical observation time and rejects future/out-of-slot captures", () => {
    expect(() => validateTemperatureCapture(overnight, "", "2026-07-03T00:00:00Z")).toThrow()
    expect(() =>
      validateTemperatureCapture(overnight, overnight.slot_end, "2026-07-03T00:00:00Z")
    ).toThrow()
    expect(() =>
      validateTemperatureCapture(overnight, "2026-07-02T16:00:00Z", overnight.slot_start)
    ).toThrow()
    expect(
      validateTemperatureCapture(overnight, "2026-07-02T16:00:00Z", "2026-07-03T00:00:00Z")
    ).toBe("2026-07-02T16:00:00.000Z")
  })
})
