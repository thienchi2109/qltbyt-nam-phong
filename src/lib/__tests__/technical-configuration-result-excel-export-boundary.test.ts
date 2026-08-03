import type { Fill } from "exceljs"
import { describe, expect, it } from "vitest"

import { createExcelWorkbook } from "@/lib/excel-workbook"
import {
  RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET,
  createTechnicalConfigurationResultWorkbookModel,
} from "@/lib/technical-configuration-result-excel-contract"
import { serializeTechnicalConfigurationResultWorkbook } from "@/lib/technical-configuration-result-excel-export"
import { createResultWorkbookFixture } from "@/lib/__tests__/technical-configuration-result-excel-fixtures"

const HEADER_FILL = "FF2E7D32"
const BORDER_COLOR = "FFD1D5DB"
const FAILS_FILL = "FFFEE2E2"
const FIRST_DOCUMENT_URL = "https://example.com/final-option-a.pdf"
const SECOND_DOCUMENT_URL = "https://example.com/final-option-b.pdf"

function getPatternFill(fill: Fill) {
  if (fill.type !== "pattern") throw new Error("Expected a pattern fill.")
  return fill
}

describe("technical configuration result ExcelJS renderer boundary", () => {
  it("serializes and reloads the physical-column continuation without truncating values or presentation", async () => {
    const finalOptionIndex = RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET
    const input = createResultWorkbookFixture({
      mode: "detailed_matrix_only",
      optionCount: finalOptionIndex + 1,
      criterionCount: 1,
      matrixFactory: (cell, _criterionIndex, optionIndex) =>
        optionIndex === finalOptionIndex
          ? {
              ...cell,
              response_text: "Phản hồi phương án cuối",
              supplementary_information: "Tài liệu phương án cuối",
              document_links: [
                {
                  document_id: "document-a",
                  document_name: "Tài liệu A",
                  document_url: FIRST_DOCUMENT_URL,
                  citation_id: "CIT-A",
                  page_section: "trang 1",
                  excerpt: "Trích đoạn A",
                },
                {
                  document_id: "document-b",
                  document_name: "Tài liệu B",
                  document_url: SECOND_DOCUMENT_URL,
                  citation_id: "CIT-B",
                  page_section: "trang 2",
                  excerpt: "Trích đoạn B",
                },
              ],
              conclusion: "fails",
            }
          : cell,
    })
    const model = createTechnicalConfigurationResultWorkbookModel(input)

    const bytes = await serializeTechnicalConfigurationResultWorkbook(model)
    const loaded = await createExcelWorkbook()
    await loaded.xlsx.load(bytes)

    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(loaded.worksheets.map((sheet) => sheet.name)).toEqual([
      "Tổng quan",
      "Ma trận chi tiết",
      "Ma trận chi tiết 2",
      "_meta",
    ])

    const first = loaded.getWorksheet("Ma trận chi tiết")
    const second = loaded.getWorksheet("Ma trận chi tiết 2")
    if (!first || !second) throw new Error("Expected both matrix worksheets.")

    expect(first.columnCount).toBe(16_384)
    expect(second.columnCount).toBe(7)
    expect(first.model.merges).toEqual(
      expect.arrayContaining(["A1:XFD1", "A2:XFD2", "A3:XFD3", "A4:D4"])
    )
    expect(second.model.merges).toEqual(
      expect.arrayContaining(["A1:G1", "A2:G2", "A3:G3", "A4:D4", "E4:G4"])
    )
    expect(first.getCell(4, 16_382).value).toContain(
      `Phuong an ${RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET}`
    )
    expect(first.getCell(6, 16_382).value).toBe(
      `Phan hoi 1-${RESULT_WORKBOOK_MAX_OPTIONS_PER_MATRIX_SHEET}`
    )
    expect(second.getCell("E4").value).toContain(`Phuong an ${finalOptionIndex + 1}`)
    expect(second.getCell("E6").value).toBe("Phản hồi phương án cuối")
    expect(second.getCell("F6").value).toEqual({
      text:
        `Tài liệu phương án cuối\n[CIT-A] Tài liệu A (trang 1) - ${FIRST_DOCUMENT_URL}` +
        `\n[CIT-B] Tài liệu B (trang 2) - ${SECOND_DOCUMENT_URL}`,
      hyperlink: FIRST_DOCUMENT_URL,
    })
    expect(second.getCell("G6").value).toBe("Không đạt")

    for (const worksheet of [first, second]) {
      expect(worksheet.views[0]).toMatchObject({ state: "frozen", xSplit: 4, ySplit: 5 })
      expect(worksheet.autoFilter).toBeDefined()
      expect(getPatternFill(worksheet.getCell("A5").fill).fgColor).toEqual({
        argb: HEADER_FILL,
      })
      expect(worksheet.getCell("A6").border.bottom).toMatchObject({
        style: "thin",
        color: { argb: BORDER_COLOR },
      })
      expect(worksheet.getCell("A6").alignment).toMatchObject({
        vertical: "top",
        wrapText: true,
      })
    }
    expect(second.getColumn(6).width).toBe(40)
    expect(second.getRow(6).height).toBe(60)
    expect(getPatternFill(second.getCell("G6").fill).fgColor).toEqual({
      argb: FAILS_FILL,
    })
    expect(loaded.getWorksheet("_meta")?.state).toBe("hidden")
  }, 120_000)
})
