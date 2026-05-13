import { describe, expect, it } from "vitest"

import { buildCsvContent, escapeCsvCell } from "../csv-utils"

describe("csv utils", () => {
  it("escapes quotes and neutralizes spreadsheet formulas", () => {
    expect(escapeCsvCell('=1+1 "quoted"')).toBe(`"'=1+1 ""quoted"""`)
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
