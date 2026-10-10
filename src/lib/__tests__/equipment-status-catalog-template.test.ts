import { describe, expect, it } from "vitest"
import { Workbook } from "exceljs"
import { generateEquipmentImportTemplate } from "../excel-utils"

const activeValues = [
  "Hoạt động",
  "Chờ sửa chữa",
  "Chờ bảo trì",
  "Chờ hiệu chuẩn/kiểm định",
  "Ngưng sử dụng",
  "Chưa có nhu cầu sử dụng",
  "Thanh lý nội bộ",
  "Đang đánh giá kỹ thuật",
]

describe("catalog-backed equipment import template", () => {
  it("puts every supplied active label in the real workbook validation and instructions", async () => {
    const blob = (await Reflect.apply(generateEquipmentImportTemplate, undefined, [
      activeValues,
    ])) as Blob
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(blob)
    })
    const workbook = new Workbook()
    await workbook.xlsx.load(data)
    const sheet = workbook.getWorksheet("Template Thiết Bị")!
    const headerValues = sheet.getRow(1).values as string[]
    const statusColumn = headerValues.indexOf("Tình trạng")
    const validation = sheet.getCell(2, statusColumn).dataValidation
    const ranges = workbook.definedNames.getRanges(String(validation.formulae?.[0])).ranges
    expect(ranges).toEqual([`'Danh mục tình trạng'!$A$1:$A$${activeValues.length}`])
    const choices = workbook.getWorksheet("Danh mục tình trạng")!.getColumn(1).values as string[]
    expect(choices.slice(1)).toEqual(activeValues)
    expect(choices).not.toContain("Trạng thái đã ngừng cấp")
    const instructions = workbook.getWorksheet("Hướng dẫn")!
    const instructionText: string[] = []
    instructions.eachRow((row) => instructionText.push(JSON.stringify(row.values)))
    for (const value of activeValues) expect(instructionText.join("\n")).toContain(value)
  }, 30000)

  it.each(["Đang đánh giá kỹ thuật", "=Tình trạng nguyên văn"])(
    "supports a single literal label %s",
    async (label) => {
      const blob = await generateEquipmentImportTemplate([label])
      const data = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(blob)
      })
      const workbook = new Workbook()
      await workbook.xlsx.load(data)
      const sheet = workbook.getWorksheet("Template Thiết Bị")!
      const statusColumn = (sheet.getRow(1).values as string[]).indexOf("Tình trạng")
      const formula = String(sheet.getCell(2, statusColumn).dataValidation.formulae?.[0])
      expect(workbook.definedNames.getRanges(formula).ranges).toEqual([
        "'Danh mục tình trạng'!$A$1",
      ])
      expect(workbook.getWorksheet("Danh mục tình trạng")!.getCell("A1").value).toBe(label)
    },
    30000
  )

  it("refuses a template with no catalog rather than inventing six options", async () => {
    await expect(Reflect.apply(generateEquipmentImportTemplate, undefined, [[]])).rejects.toThrow()
  })
})
