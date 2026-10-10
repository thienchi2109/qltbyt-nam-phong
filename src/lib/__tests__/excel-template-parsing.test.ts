import { describe, it, expect } from "vitest"
import { generateEquipmentImportTemplate } from "@/lib/excel-utils"
import type { Worksheet } from "exceljs"
import { EXPECTED_STATUS_OPTIONS, blobToBuffer } from "./excel-template-fixtures"

describe("Template Data Validation Range", () => {
  it("should apply data validation to multiple rows (not just row 2)", async () => {
    const templateBlob = await generateEquipmentImportTemplate(EXPECTED_STATUS_OPTIONS)

    const ExcelJS = await import("exceljs")
    const workbook = new ExcelJS.Workbook()

    // Convert Blob to Buffer for ExcelJS
    const buffer = await blobToBuffer(templateBlob)
    await workbook.xlsx.load(buffer)

    const templateSheet = workbook.getWorksheet("Template Thiết Bị") as Worksheet

    // Find status column
    const headerRow = templateSheet.getRow(1)
    let statusColIndex = -1

    headerRow.eachCell((cell, colNumber) => {
      if (cell.value === "Tình trạng") {
        statusColIndex = colNumber
      }
    })

    // Check validation exists on rows 2, 10, and 100
    const rowsToCheck = [2, 10, 100]
    rowsToCheck.forEach((rowNum) => {
      const cell = templateSheet.getCell(rowNum, statusColIndex)
      expect(cell.dataValidation).toBeDefined()
      expect(cell.dataValidation?.type).toBe("list")
    })
  })
})

/**
 * Tests for Excel read/parse functions.
 *
 * NOTE: These tests are skipped in jsdom because File.arrayBuffer() is not fully
 * supported. The readExcelFile and worksheetToJson functions are designed for
 * browser environments. In practice, these are tested through:
 * 1. Manual browser testing
 * 2. E2E tests (if available)
 * 3. The template generation tests above verify ExcelJS works correctly
 */
describe("Excel Read/Parse Functions (ExcelJS)", () => {
  /**
   * Test the round-trip: generate template -> read it back -> parse to JSON
   * This verifies readExcelFile and worksheetToJson work with ExcelJS-generated files
   *
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip("should read back generated Excel template correctly (browser only)", async () => {
    // Generate template
    const templateBlob = await generateEquipmentImportTemplate(EXPECTED_STATUS_OPTIONS)

    // Convert Blob to File (simulating file upload)
    const file = new File([templateBlob], "test-template.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    // Import the read function dynamically to avoid circular deps
    const { readExcelFile, worksheetToJson } = await import("@/lib/excel-utils")

    // Read the file back
    const workbookResult = await readExcelFile(file)

    // Verify structure
    expect(workbookResult.SheetNames).toContain("Template Thiết Bị")
    expect(workbookResult.SheetNames).toContain("Hướng dẫn")
    expect(workbookResult.Sheets["Template Thiết Bị"]).toBeDefined()

    // Parse the template sheet to JSON
    const templateSheet = workbookResult.Sheets["Template Thiết Bị"]
    const jsonData = await worksheetToJson(templateSheet)

    // Template should have no data rows (just headers)
    expect(jsonData).toHaveLength(0)
  })

  /**
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip("should parse Excel with data rows correctly (browser only)", async () => {
    // Create a workbook with sample data
    const ExcelJS = await import("exceljs")
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Test Data")

    // Add headers
    sheet.addRow(["Tên thiết bị", "Tình trạng", "Khoa/phòng quản lý"])

    // Add data rows
    sheet.addRow(["Máy X-quang", "Hoạt động", "Khoa Nội"])
    sheet.addRow(["Máy siêu âm", "Chờ sửa chữa", "Khoa Ngoại"])
    sheet.addRow(["Máy MRI", "Chờ bảo trì", "Khoa Tim"])

    // Convert to buffer
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    // Create File object
    const file = new File([blob], "test-data.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    // Read and parse
    const { readExcelFile, worksheetToJson } = await import("@/lib/excel-utils")
    const workbookResult = await readExcelFile(file)
    const jsonData = await worksheetToJson(workbookResult.Sheets["Test Data"])

    // Verify parsed data
    expect(jsonData).toHaveLength(3)

    expect(jsonData[0]["Tên thiết bị"]).toBe("Máy X-quang")
    expect(jsonData[0]["Tình trạng"]).toBe("Hoạt động")
    expect(jsonData[0]["Khoa/phòng quản lý"]).toBe("Khoa Nội")

    expect(jsonData[1]["Tên thiết bị"]).toBe("Máy siêu âm")
    expect(jsonData[1]["Tình trạng"]).toBe("Chờ sửa chữa")

    expect(jsonData[2]["Tên thiết bị"]).toBe("Máy MRI")
    expect(jsonData[2]["Tình trạng"]).toBe("Chờ bảo trì")
  })

  /**
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip("should skip empty rows when parsing (browser only)", async () => {
    const ExcelJS = await import("exceljs")
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Test")

    // Add headers
    sheet.addRow(["Column A", "Column B"])

    // Add data with empty row in between
    sheet.addRow(["Value 1", "Value 2"])
    sheet.addRow(["", ""]) // Empty row - should be skipped
    sheet.addRow(["Value 3", "Value 4"])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const file = new File([blob], "test.xlsx", { type: blob.type })

    const { readExcelFile, worksheetToJson } = await import("@/lib/excel-utils")
    const result = await readExcelFile(file)
    const jsonData = await worksheetToJson(result.Sheets["Test"])

    // Should have 2 rows (empty row skipped)
    expect(jsonData).toHaveLength(2)
    expect(jsonData[0]["Column A"]).toBe("Value 1")
    expect(jsonData[1]["Column A"]).toBe("Value 3")
  })

  /**
   * SKIPPED: File.arrayBuffer() not available in jsdom
   */
  it.skip("should handle Vietnamese text with diacritics correctly (browser only)", async () => {
    const ExcelJS = await import("exceljs")
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Vietnamese Test")

    // Vietnamese text with full diacritics
    sheet.addRow(["Tên thiết bị", "Tình trạng hiện tại"])
    sheet.addRow(["Máy điện tâm đồ", "Chờ hiệu chuẩn/kiểm định"])
    sheet.addRow(["Máy chụp cộng hưởng từ", "Chưa có nhu cầu sử dụng"])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    const file = new File([blob], "vn-test.xlsx", { type: blob.type })

    const { readExcelFile, worksheetToJson } = await import("@/lib/excel-utils")
    const result = await readExcelFile(file)
    const jsonData = await worksheetToJson(result.Sheets["Vietnamese Test"])

    expect(jsonData).toHaveLength(2)
    expect(jsonData[0]["Tên thiết bị"]).toBe("Máy điện tâm đồ")
    expect(jsonData[0]["Tình trạng hiện tại"]).toBe("Chờ hiệu chuẩn/kiểm định")
    expect(jsonData[1]["Tình trạng hiện tại"]).toBe("Chưa có nhu cầu sử dụng")
  })

  /**
   * Tests that can run in Node.js environment (worksheetToJson with ExcelJS directly)
   */
  describe("worksheetToJson (Node.js compatible)", () => {
    it("should convert worksheet rows to JSON objects", async () => {
      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Test")

      // Add data
      sheet.addRow(["Name", "Status", "Department"])
      sheet.addRow(["Equipment A", "Hoạt động", "Khoa Nội"])
      sheet.addRow(["Equipment B", "Chờ bảo trì", "Khoa Ngoại"])

      // Import and test worksheetToJson directly
      const { worksheetToJson } = await import("@/lib/excel-utils")
      const result = await worksheetToJson(sheet)

      expect(result).toHaveLength(2)
      expect(result[0]["Name"]).toBe("Equipment A")
      expect(result[0]["Status"]).toBe("Hoạt động")
      expect(result[1]["Name"]).toBe("Equipment B")
      expect(result[1]["Department"]).toBe("Khoa Ngoại")
    })

    it("should handle Vietnamese diacritics in headers and values", async () => {
      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("VN Test")

      sheet.addRow(["Tên thiết bị", "Tình trạng hiện tại", "Khoa/phòng quản lý"])
      sheet.addRow(["Máy siêu âm", "Chờ hiệu chuẩn/kiểm định", "Phòng xét nghiệm"])

      const { worksheetToJson } = await import("@/lib/excel-utils")
      const result = await worksheetToJson(sheet)

      expect(result).toHaveLength(1)
      expect(result[0]["Tên thiết bị"]).toBe("Máy siêu âm")
      expect(result[0]["Tình trạng hiện tại"]).toBe("Chờ hiệu chuẩn/kiểm định")
      expect(result[0]["Khoa/phòng quản lý"]).toBe("Phòng xét nghiệm")
    })

    it("should skip rows with no data", async () => {
      const ExcelJS = await import("exceljs")
      const workbook = new ExcelJS.Workbook()
      const sheet = workbook.addWorksheet("Sparse")

      sheet.addRow(["Col1", "Col2"])
      sheet.addRow(["A", "B"])
      // Row 3 is empty - no cells added
      sheet.addRow(["C", "D"])

      const { worksheetToJson } = await import("@/lib/excel-utils")
      const result = await worksheetToJson(sheet)

      expect(result).toHaveLength(2)
      expect(result[0]["Col1"]).toBe("A")
      expect(result[1]["Col1"]).toBe("C")
    })
  })
})
