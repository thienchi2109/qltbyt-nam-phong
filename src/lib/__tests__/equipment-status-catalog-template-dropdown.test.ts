import { Workbook } from "exceljs"
import { describe, expect, it } from "vitest"
import { generateEquipmentImportTemplate } from "../equipment-import-template"
import { blobToBuffer } from "./excel-template-fixtures"

function getDropdownValues(workbook: Workbook, formula: string): string[] {
  if (formula.startsWith('"')) {
    expect(
      formula.length,
      "Excel inline validation lists cannot exceed 255 characters"
    ).toBeLessThanOrEqual(255)
    return formula.slice(1, -1).split(",")
  }

  const references = workbook.definedNames.getRanges(formula.replace(/^=/, "")).ranges
  expect(references, "Dropdown must resolve to stored workbook cells").toHaveLength(1)
  const reference = references[0]
  const [sheetName, range] = reference.split("!")
  const sheet = workbook.getWorksheet(sheetName.replace(/^'|'$/g, "").replaceAll("''", "'"))!
  const match = /^\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(range)!
  const values: string[] = []
  for (let row = Number(match[2]); row <= Number(match[4]); row++) {
    values.push(String(sheet.getCell(`${match[1]}${row}`).value))
  }
  return values
}

describe("real workbook catalog dropdown roundtrip", () => {
  it.each([
    {
      name: "comma and quote labels",
      labels: ["Hoạt động", "Đang kiểm tra, chờ xác nhận", 'Đang đánh giá "thiết bị"'],
    },
    {
      name: "catalog longer than Excel's inline list limit",
      labels: Array.from(
        { length: 20 },
        (_, index) => `Tình trạng đánh giá kỹ thuật số ${index + 1}`
      ),
    },
  ])(
    "preserves exact choices for $name",
    async ({ labels }) => {
      const blob = await generateEquipmentImportTemplate(labels)
      const workbook = new Workbook()
      await workbook.xlsx.load(await blobToBuffer(blob))
      const sheet = workbook.getWorksheet("Template Thiết Bị")!
      const statusColumn = (sheet.getRow(1).values as string[]).indexOf("Tình trạng")
      for (const row of [2, 1000]) {
        const validation = sheet.getCell(row, statusColumn).dataValidation
        expect(validation.type).toBe("list")
        expect(getDropdownValues(workbook, String(validation.formulae?.[0]))).toEqual(labels)
      }
    },
    30000
  )
})
