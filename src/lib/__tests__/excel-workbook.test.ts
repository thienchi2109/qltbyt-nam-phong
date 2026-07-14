import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createExcelWorkbook,
  downloadBlob,
  readExcelFile,
  worksheetToJson,
} from "@/lib/excel-workbook"

describe("excel-workbook", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("creates and loads ExcelJS workbooks through the shared dynamic loader", async () => {
    const sourceWorkbook = await createExcelWorkbook()
    const firstSheet = sourceWorkbook.addWorksheet("First")
    firstSheet.addRow(["Name"])
    firstSheet.addRow(["Equipment A"])
    sourceWorkbook.addWorksheet("Second")
    const buffer = await sourceWorkbook.xlsx.writeBuffer()
    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(buffer),
    } as unknown as File

    const loaded = await readExcelFile(file)

    expect(file.arrayBuffer).toHaveBeenCalledTimes(1)
    expect(loaded.SheetNames).toEqual(["First", "Second"])
    expect(loaded.Sheets.First).toBeDefined()
    expect(loaded._workbook.getWorksheet("Second")).toBeDefined()
  })

  it("converts worksheet rows with headers and skips empty rows", async () => {
    const workbook = await createExcelWorkbook()
    const worksheet = workbook.addWorksheet("Data")
    worksheet.addRow(["Name", "Installed"])
    worksheet.addRow(["Equipment A", new Date("2026-07-14T00:00:00.000Z")])
    worksheet.addRow([])
    worksheet.addRow(["Equipment B", null])

    const rows = await worksheetToJson(worksheet)

    expect(rows).toEqual([
      {
        Name: "Equipment A",
        Installed: new Date("2026-07-14T00:00:00.000Z"),
      },
      {
        Name: "Equipment B",
      },
    ])
  })

  it("downloads a Blob with the exact filename and always cleans up", () => {
    const blob = new Blob(["workbook"])
    const anchor = document.createElement("a")
    const click = vi.spyOn(anchor, "click").mockImplementation(() => {
      throw new Error("click failed")
    })
    vi.spyOn(document, "createElement").mockReturnValue(anchor)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:workbook")
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL")

    expect(() => downloadBlob(blob, "Equipment.xlsx")).toThrow("click failed")
    expect(anchor.href).toBe("blob:workbook")
    expect(anchor.download).toBe("Equipment.xlsx")
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:workbook")
    expect(document.body.contains(anchor)).toBe(false)
  })
})
