import { describe, expect, it } from "vitest"

import {
  formatRepairCostDisplay,
  formatRepairCostInput,
  parseRepairCostInput,
} from "../repairRequestCost"

describe("repairRequestCost", () => {
  it('parses "1.234.567" into a numeric value', () => {
    expect(parseRepairCostInput("1.234.567")).toBe(1234567)
  })

  it('parses "0" as zero instead of null', () => {
    expect(parseRepairCostInput("0")).toBe(0)
  })

  it("parses an empty string as null", () => {
    expect(parseRepairCostInput("")).toBeNull()
  })

  it("rejects negative values", () => {
    expect(() => parseRepairCostInput("-1000")).toThrow("Chi phí sửa chữa không hợp lệ")
  })

  it("rejects non-numeric input", () => {
    expect(() => parseRepairCostInput("abc")).toThrow("Chi phí sửa chữa không hợp lệ")
  })

  it("rejects malformed thousands separators", () => {
    expect(() => parseRepairCostInput("1.23")).toThrow("Chi phí sửa chữa không hợp lệ")
    expect(() => parseRepairCostInput("1234.567")).toThrow("Chi phí sửa chữa không hợp lệ")
  })

  it('formats 1234567 for input display as "1.234.567"', () => {
    expect(formatRepairCostInput(1234567)).toBe("1.234.567")
  })

  it("formats null input display as an empty string", () => {
    expect(formatRepairCostInput(null)).toBe("")
  })

  it("formats display values with the local currency suffix", () => {
    expect(formatRepairCostDisplay(1234567)).toBe("1.234.567 đ")
    expect(formatRepairCostDisplay(0)).toBe("0 đ")
    expect(formatRepairCostDisplay(null)).toBe("Chưa ghi nhận")
  })
})
