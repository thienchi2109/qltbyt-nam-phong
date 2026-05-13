import { describe, expect, it } from "vitest"

import { buildCsvContent, escapeCsvCell } from "@/lib/csv-utils"

describe("csv utils", () => {
  it("escapes quotes and neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell('=1+1 "quoted"')).toBe(`"'=1+1 ""quoted"""`)
  })

  it("neutralizes formulas with leading whitespace or control characters", () => {
    expect(escapeCsvCell("\t=1+1")).toBe(`"'\t=1+1"`)
    expect(escapeCsvCell(" =1+1")).toBe(`"' =1+1"`)
  })

  it("does not throw when object serialization fails", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => escapeCsvCell(circular)).not.toThrow()
    expect(escapeCsvCell(circular)).toBe('"[object Object]"')
  })

  it("preserves zero and false values", () => {
    expect(escapeCsvCell(0)).toBe('"0"')
    expect(escapeCsvCell(false)).toBe('"false"')
  })

  it("builds CSV rows from selected headers", () => {
    const csv = buildCsvContent(
      [{ name: '=cmd', count: 0, enabled: false }],
      ["name", "count", "enabled"]
    )

    expect(csv).toBe(['"name","count","enabled"', `"'=cmd","0","false"`].join("\n"))
  })
})
