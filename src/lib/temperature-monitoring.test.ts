import { describe, expect, it } from "vitest"
import {
  currentTemperatureSlot,
  validateTemperatureCapture,
  temperatureFormData,
} from "./temperature-monitoring"
import {
  temperatureFormValueSchema,
  temperatureMeasurementFormSchema,
  temperatureReviewFormSchema,
  temperatureDeviationFormSchema,
} from "./temperature-monitoring-form-schemas"
import type { TemperatureSlot } from "@/types/temperature-monitoring"

const overnight = {
  slot_start: "2026-07-02T15:00:00Z",
  slot_end: "2026-07-02T23:00:00Z",
} as TemperatureSlot

describe("authoritative temperature intervals", () => {
  it("keeps numeric input bounds and precision without rounding and maps registered checkbox semantics", () => {
    for (const value of ["", "-200", "300", "-0.1", "7.3", "5.00"])
      expect(temperatureFormValueSchema.safeParse(value).success).toBe(true)
    for (const value of ["-200.1", "300.1", "5.25", "NaN", "Infinity"])
      expect(temperatureFormValueSchema.safeParse(value).success).toBe(false)
    const values = temperatureFormData({ value: "5.0", unable: false, note: "nháp" })
    expect(values.get("value")).toBe("5.0")
    expect(values.has("unable")).toBe(false)
    expect(temperatureFormData({ unable: true }).get("unable")).toBe("on")
  })
  it("validates measurement fields without coercing or dropping the entered draft", () => {
    const draft = {
      value: "5.0",
      unable: false,
      captured: "2026-07-02T23:00",
      reason: "",
      note: "",
    }
    expect(temperatureMeasurementFormSchema.parse(draft)).toEqual(draft)
    for (const patch of [
      { value: "" },
      { captured: "" },
      { unable: true },
      { note: "x".repeat(2001) },
    ])
      expect(temperatureMeasurementFormSchema.safeParse({ ...draft, ...patch }).success).toBe(false)
    expect(
      temperatureMeasurementFormSchema.safeParse({
        ...draft,
        value: "",
        unable: true,
        reason: "Hỏng",
      }).success
    ).toBe(true)
  })
  it("validates proposal values only for amendment and requires an operation reason", () => {
    const draft = { action: "amend", value: "", unable: false, unableReason: "", reason: "Đọc lại" }
    expect(temperatureReviewFormSchema.safeParse(draft).success).toBe(false)
    expect(temperatureReviewFormSchema.safeParse({ ...draft, unable: true }).success).toBe(false)
    expect(
      temperatureReviewFormSchema.safeParse({ ...draft, unable: true, unableReason: "Hỏng" })
        .success
    ).toBe(true)
    for (const action of ["confirm", "reopen", "approve_amendment", "reject_amendment"])
      expect(
        temperatureReviewFormSchema.safeParse({ ...draft, action, value: "5.25" }).success
      ).toBe(true)
    expect(
      temperatureReviewFormSchema.safeParse({ ...draft, value: "5.1", reason: " " }).success
    ).toBe(false)
  })
  it("requires only the selected deviation operation's fields", () => {
    for (const action of ["start", "await_verification", "assign", "link_repair"])
      expect(temperatureDeviationFormSchema.safeParse({ action, reason: "" }).success).toBe(true)
    for (const action of ["update_action", "close", "severity", "cancel"])
      expect(temperatureDeviationFormSchema.safeParse({ action, reason: "" }).success).toBe(false)
    expect(
      temperatureDeviationFormSchema.safeParse({ action: "close", verification: "Đạt" }).success
    ).toBe(true)
    expect(
      temperatureDeviationFormSchema.safeParse({
        action: "update_action",
        immediate: "Kiểm tra",
        cause: "x".repeat(2001),
      }).success
    ).toBe(false)
    expect(
      temperatureDeviationFormSchema.safeParse({ action: "start", immediate: "x".repeat(2001) })
        .success
    ).toBe(true)
  })
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
