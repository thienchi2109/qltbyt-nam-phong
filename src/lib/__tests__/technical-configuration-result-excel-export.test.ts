import type { Cell, Fill, Workbook } from "exceljs"
import { describe, expect, it } from "vitest"

import { createExcelWorkbook } from "@/lib/excel-workbook"
import { createTechnicalConfigurationResultWorkbookModel } from "@/lib/technical-configuration-result-excel-contract"
import {
  createTechnicalConfigurationResultWorkbook,
  serializeTechnicalConfigurationResultWorkbook,
} from "@/lib/technical-configuration-result-excel-export"
import {
  createHierarchicalResultWorkbookFixture,
  createResultWorkbookFixture,
  createSingleOptionEmptyCriteriaResultWorkbookFixture,
} from "@/lib/__tests__/technical-configuration-result-excel-fixtures"

const TITLE_FILL = "FF166534"
const HEADER_FILL = "FF2E7D32"
const BORDER_COLOR = "FFD1D5DB"
const ZEBRA_FILL = "FFF3F4F6"
const AMBER_FILL = "FFFFF3CD"
const MEETS_FILL = "FFD1FAE5"

function getWorksheet(workbook: Workbook, name: string) {
  const worksheet = workbook.getWorksheet(name)
  if (!worksheet) throw new Error(`Expected worksheet ${name}.`)
  return worksheet
}

function getPatternFill(cell: Cell) {
  const fill = cell.fill as Fill
  if (fill.type !== "pattern") throw new Error(`Expected pattern fill at ${cell.address}.`)
  return fill
}

function getCellText(cell: Cell): string {
  const value = cell.value
  if (value === null || value === undefined) return ""
  if (typeof value === "object" && "text" in value) return value.text
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((part) => part.text).join("")
  }
  return String(value)
}

function getWorkbookText(workbook: Workbook) {
  const values: string[] = []
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => values.push(getCellText(cell)))
    })
  })
  return values.join("\n")
}

function expectThinGrayBorder(cell: Cell) {
  for (const edge of ["top", "left", "bottom", "right"] as const) {
    expect(cell.border[edge]).toMatchObject({
      style: "thin",
      color: { argb: BORDER_COLOR },
    })
  }
}

function expectStandardDataCell(cell: Cell) {
  expectThinGrayBorder(cell)
  expect(cell.alignment).toMatchObject({
    vertical: "top",
    wrapText: true,
  })
}

function expectNoForbiddenWorkbookContent(workbook: Workbook) {
  const workbookText = getWorkbookText(workbook)
  expect(workbookText).not.toMatch(/\b(chart|score|percentage)\b/i)
  expect(workbookText).not.toMatch(/(điểm số|tỷ lệ|quyết định trao thầu)/i)
  expect(JSON.stringify(workbook.model)).not.toMatch(/gradient|chart/i)
}

describe("technical configuration result ExcelJS renderer", () => {
  it("renders the full overview and ranking sheets with exact values and presentation", async () => {
    const input = createResultWorkbookFixture({
      mode: "full",
      optionCount: 2,
      criterionCount: 3,
      rankingFactory: (row, index) =>
        index === 0
          ? {
              ...row,
              eligibility: "incomplete",
              incomplete_criterion_count: 1,
              failed_count: 1,
              insufficient_evidence_count: 2,
              exceeds_count: 0,
              rank: null,
            }
          : row,
    })
    const model = createTechnicalConfigurationResultWorkbookModel(input)

    const workbook = await createTechnicalConfigurationResultWorkbook(model)

    expect(workbook.worksheets.map((sheet) => [sheet.name, sheet.state])).toEqual([
      ["Tổng quan", "visible"],
      ["Xếp hạng", "visible"],
      ["Ma trận chi tiết", "visible"],
      ["_meta", "hidden"],
    ])

    const overview = getWorksheet(workbook, "Tổng quan")
    expect(overview.model.merges).toEqual(expect.arrayContaining(["A1:H2", "A3:H3", "A13:H13"]))
    expect(overview.getCell("A1").value).toBe("KẾT QUẢ SO SÁNH CẤU HÌNH KỸ THUẬT")
    expect(overview.getCell("A3").value).toBe("Cau hinh may sieu am")
    expect(overview.getCell("A5").value).toBe("Mã hồ sơ")
    expect(overview.getCell("B5").value).toBe(input.manifest.dossier.id)
    expect(overview.getCell("A6").value).toBe("Phiên bản cấu hình cơ sở")
    expect(overview.getCell("B6").value).toBe(3)
    expect(overview.getCell("A7").value).toBe("Khóa lúc")
    expect(overview.getCell("B7").value).toBe("2026-08-01T02:03:04.000Z")
    expect(overview.getCell("D5").value).toBe("Tổng phương án")
    expect(overview.getCell("E5").value).toBe(2)
    expect(overview.getCell("D6").value).toBe("Tổng tiêu chí")
    expect(overview.getCell("E6").value).toBe(3)
    expect(overview.getCell("D7").value).toBe("Đủ điều kiện")
    expect(overview.getCell("E7").value).toBe(1)
    expect(overview.getCell("D8").value).toBe("Chưa hoàn thiện")
    expect(overview.getCell("E8").value).toBe(1)
    expect(String(overview.getCell("A13").value)).toMatch(/xếp hạng chỉ mang tính tham khảo/i)
    expect(getPatternFill(overview.getCell("A13")).fgColor).toEqual({ argb: AMBER_FILL })
    expect(overview.getRow(16).values).toEqual([
      undefined,
      "Hạng",
      "Mã PA",
      "Nhà cung cấp",
      "Model",
      "Trạng thái",
      "Đã hoàn thiện",
      "Chưa hoàn thiện",
      "Ghi chú",
    ])
    expect(overview.getRow(17).values).toEqual([
      undefined,
      "",
      "Phuong an 1",
      "Nha cung cap 1",
      "Model 1",
      "Chưa hoàn thiện",
      2,
      1,
      "Không đạt: 1; Thiếu bằng chứng: 2",
    ])
    expect(getPatternFill(overview.getCell("E17")).fgColor).toEqual({ argb: AMBER_FILL })
    expect(getPatternFill(overview.getCell("E18")).fgColor).toEqual({ argb: MEETS_FILL })

    const ranking = getWorksheet(workbook, "Xếp hạng")
    expect(ranking.model.merges).toEqual(expect.arrayContaining(["A1:H2", "A3:H3"]))
    expect(ranking.getRow(5).values).toEqual(overview.getRow(16).values)
    expect(ranking.getRow(6).values).toEqual(overview.getRow(17).values)
    expect(ranking.getRow(7).values).toEqual([
      undefined,
      2,
      "Phuong an 2",
      "Nha cung cap 2",
      "Model 2",
      "Đủ điều kiện",
      3,
      0,
      "Vượt yêu cầu: 1",
    ])
    expect(ranking.autoFilter).toEqual({ from: "A5", to: "H7" })
    expect(ranking.views[0]).toMatchObject({ state: "frozen", ySplit: 5 })
    expect(ranking.getColumn(3).width).toBe(28)
    expect(ranking.getColumn(8).width).toBe(32)
    expect(ranking.getRow(1).height).toBe(30)
    expect(ranking.getRow(3).height).toBe(24)
    expect(ranking.getRow(5).height).toBe(36)
    expect(getPatternFill(ranking.getCell("A1")).fgColor).toEqual({ argb: TITLE_FILL })
    expect(ranking.getCell("A1").font).toMatchObject({ bold: true, color: { argb: "FFFFFFFF" } })
    expect(getPatternFill(ranking.getCell("A5")).fgColor).toEqual({ argb: HEADER_FILL })
    expect(getPatternFill(ranking.getCell("A7")).fgColor).toEqual({ argb: ZEBRA_FILL })
    expect(getPatternFill(ranking.getCell("E6")).fgColor).toEqual({ argb: AMBER_FILL })
    expect(getPatternFill(ranking.getCell("E7")).fgColor).toEqual({ argb: MEETS_FILL })
    expectStandardDataCell(ranking.getCell("C6"))
    expectNoForbiddenWorkbookContent(workbook)
  })

  it("renders the detailed matrix with frozen headers, dimensions, status fills and hyperlinks", async () => {
    const input = createResultWorkbookFixture({
      mode: "detailed_matrix_only",
      optionCount: 1,
      criterionCount: 1,
      matrixFactory: (cell) => ({
        ...cell,
        supplementary_information: "Phiếu thông số kỹ thuật",
        document_links: [
          {
            document_id: "document-1",
            document_name: "Thông số máy",
            document_url: "https://example.com/spec.pdf",
            citation_id: "CIT-001",
            page_section: "trang 4",
            excerpt: "Dải tần đầu dò",
          },
        ],
      }),
    })
    const model = createTechnicalConfigurationResultWorkbookModel(input)

    const workbook = await createTechnicalConfigurationResultWorkbook(model)

    expect(workbook.worksheets.map((sheet) => [sheet.name, sheet.state])).toEqual([
      ["Tổng quan", "visible"],
      ["Ma trận chi tiết", "visible"],
      ["_meta", "hidden"],
    ])
    const overviewText = getWorkbookText(workbook)
    expect(overviewText).not.toContain("XẾP HẠNG THAM KHẢO")
    expect(overviewText).not.toContain("xếp hạng chỉ mang tính tham khảo")

    const matrix = getWorksheet(workbook, "Ma trận chi tiết")
    expect(matrix.model.merges).toEqual(
      expect.arrayContaining(["A1:G1", "A2:G2", "A3:G3", "A4:D4", "E4:G4"])
    )
    expect(matrix.getCell("A1").value).toBe("MA TRẬN SO SÁNH CHI TIẾT")
    expect(matrix.getCell("A2").value).toBe("Cau hinh may sieu am")
    expect(matrix.getCell("E4").value).toBe("Phuong an 1 - Nha cung cap 1 - Model 1")
    expect(matrix.getRow(5).values).toEqual([
      undefined,
      "STT",
      "Nhóm tiêu chí",
      "Mã tiêu chí",
      "Yêu cầu cấu hình cơ sở",
      "Phản hồi nhà cung cấp",
      "Thông tin bổ sung / tài liệu",
      "Kết luận đánh giá",
    ])
    expect(matrix.getRow(6).values.slice(1, 6)).toEqual([
      "",
      "Nhom tieu chi 1",
      "",
      "",
      "Đạt | 1 tiêu chí | Đạt: 1",
    ])
    expect(matrix.model.merges).toEqual(expect.arrayContaining(["E6:G6"]))
    expect(matrix.getRow(7).values).toEqual([
      undefined,
      1,
      "Nhom tieu chi 1",
      "TC-001",
      "Yeu cau cau hinh 1",
      "Phan hoi 1-1",
      {
        text: "Phiếu thông số kỹ thuật\n[CIT-001] Thông số máy (trang 4) - https://example.com/spec.pdf",
        hyperlink: "https://example.com/spec.pdf",
        tooltip: "Dải tần đầu dò",
      },
      "Đạt",
    ])
    expect(matrix.views[0]).toMatchObject({ state: "frozen", xSplit: 4, ySplit: 5 })
    expect(matrix.autoFilter).toEqual({ from: "A5", to: "G7" })
    expect(matrix.getColumn(1).width).toBe(8)
    expect(matrix.getColumn(4).width).toBe(42)
    expect(matrix.getColumn(6).width).toBe(40)
    expect(matrix.getRow(1).height).toBe(30)
    expect(matrix.getRow(5).height).toBe(36)
    expect(matrix.getRow(7).height).toBe(60)
    expect(getPatternFill(matrix.getCell("A1")).fgColor).toEqual({ argb: TITLE_FILL })
    expect(getPatternFill(matrix.getCell("A5")).fgColor).toEqual({ argb: HEADER_FILL })
    expect(getPatternFill(matrix.getCell("G7")).fgColor).toEqual({ argb: MEETS_FILL })
    expectStandardDataCell(matrix.getCell("F7"))
    expectNoForbiddenWorkbookContent(workbook)
    expect(matrix.getRow(2).height).toBe(24)
    expect(matrix.getRow(3).height).toBe(24)
  })

  it("renders hierarchy aggregates as merged summaries without response or assessment cells", async () => {
    const model = createTechnicalConfigurationResultWorkbookModel(
      createHierarchicalResultWorkbookFixture()
    )
    const workbook = await createTechnicalConfigurationResultWorkbook(model)
    const matrix = getWorksheet(workbook, "Ma trận chi tiết")

    expect(matrix.model.merges).toEqual(expect.arrayContaining(["E6:G6", "E8:G8"]))
    expect(matrix.getRow(6).values.slice(1, 6)).toEqual([
      "",
      "Nhom tieu chi 1",
      "",
      "",
      "Đạt | 2 tiêu chí | Đạt: 2",
    ])
    expect(matrix.getRow(8).values.slice(1, 6)).toEqual([
      "",
      "Phan nhom 1",
      "",
      "",
      "Đạt | 1 tiêu chí | Đạt: 1",
    ])
    expect(matrix.getCell("F6").master.address).toBe("E6")
    expect(matrix.getCell("G6").master.address).toBe("E6")
    expect(matrix.getCell("F8").master.address).toBe("E8")
    expect(matrix.getCell("G8").master.address).toBe("E8")
    expect(matrix.getCell("B6").font).toMatchObject({ bold: true })
    expect(matrix.getCell("B6").alignment.indent).toBeFalsy()
    expect(matrix.getCell("B8").font).toMatchObject({ bold: true })
    expect(matrix.getCell("B8").alignment.indent).toBe(1)
    expect(matrix.getRow(7).values).toEqual(
      expect.arrayContaining(["TC-001", "Phan hoi 1-1", "Đạt"])
    )
    expect(matrix.getRow(9).values).toEqual(
      expect.arrayContaining(["TC-002", "Phan hoi 2-1", "Đạt"])
    )
  })

  it("omits a redundant zero count from no-criteria structural summaries", async () => {
    const fixture = createSingleOptionEmptyCriteriaResultWorkbookFixture()
    const option = fixture.optionAxis[0]
    if (!option) throw new Error("Expected one option.")
    const model = createTechnicalConfigurationResultWorkbookModel({
      ...fixture,
      hierarchyRows: [
        {
          kind: "section",
          id: "section-empty",
          name: "Nhom chua co tieu chi",
          sortOrder: 1,
          optionAggregates: [
            {
              optionId: option.option_id,
              status: "no_criteria",
              descendantCount: 0,
              statusCounts: {
                not_evaluated: 0,
                not_applicable: 0,
                fails: 0,
                unclear: 0,
                insufficient_evidence: 0,
                exceeds: 0,
                meets: 0,
              },
            },
          ],
        },
      ],
    })

    const workbook = await createTechnicalConfigurationResultWorkbook(model)
    const matrix = getWorksheet(workbook, "Ma trận chi tiết")

    expect(matrix.getCell("E6").value).toBe("Chưa có tiêu chí")
  })

  it.each([
    ["full", ["Tổng quan", "Xếp hạng", "Ma trận chi tiết", "_meta"]],
    ["ranking_only", ["Tổng quan", "Xếp hạng", "_meta"]],
    ["detailed_matrix_only", ["Tổng quan", "Ma trận chi tiết", "_meta"]],
  ] as const)(
    "preserves exact sheet order and hidden state for %s",
    async (mode, expectedNames) => {
      const input = createResultWorkbookFixture({ mode, optionCount: 1, criterionCount: 1 })
      const model = createTechnicalConfigurationResultWorkbookModel(input)

      const bytes = await serializeTechnicalConfigurationResultWorkbook(model)
      const workbook = await createExcelWorkbook()
      await workbook.xlsx.load(bytes)

      expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(expectedNames)
      const overview = getWorksheet(workbook, "Tổng quan")
      expect(overview.model.merges).toEqual(expect.arrayContaining(["A1:H2", "A3:H3"]))
      expect(overview.getCell("A1").value).toBe("KẾT QUẢ SO SÁNH CẤU HÌNH KỸ THUẬT")
      expect(getPatternFill(overview.getCell("A1")).fgColor).toEqual({ argb: TITLE_FILL })
      expect(overview.getRow(1).height).toBe(30)

      if (expectedNames.includes("Xếp hạng")) {
        const ranking = getWorksheet(workbook, "Xếp hạng")
        expect(ranking.model.merges).toEqual(expect.arrayContaining(["A1:H2", "A3:H3"]))
        expect(ranking.views[0]).toMatchObject({ state: "frozen", ySplit: 5 })
        expect(ranking.autoFilter).toBe("A5:H6")
        expect(getPatternFill(ranking.getCell("A5")).fgColor).toEqual({ argb: HEADER_FILL })
        expectStandardDataCell(ranking.getCell("C6"))
      }

      if (expectedNames.includes("Ma trận chi tiết")) {
        const matrix = getWorksheet(workbook, "Ma trận chi tiết")
        expect(matrix.model.merges).toEqual(
          expect.arrayContaining(["A1:G1", "A2:G2", "A3:G3", "A4:D4", "E4:G4"])
        )
        expect(matrix.views[0]).toMatchObject({ state: "frozen", xSplit: 4, ySplit: 5 })
        expect(matrix.autoFilter).toBe("A5:G7")
        expect(matrix.getColumn(6).width).toBe(40)
        expectStandardDataCell(matrix.getCell("F7"))
      }

      const meta = getWorksheet(workbook, "_meta")
      expect(meta.state).toBe("hidden")
      expect(
        meta.getRows(1, 14)?.map((row) => [row.getCell(1).value, row.getCell(2).value])
      ).toEqual([
        ["key", "value"],
        ["template_kind", "technical_configuration_result"],
        ["template_version", 1],
        ["dossier_id", input.manifest.dossier.id],
        ["baseline_version_id", input.manifest.baseline_version.id],
        ["snapshot_token", "snapshot-v1"],
        ["ranking_snapshot_token", "ranking-v1"],
        ["content_mode", mode],
        ["option_scope", "all"],
        ["criterion_scope", "all"],
        ["ordered_option_ids", "[]"],
        ["ordered_criterion_ids", "[]"],
        ["generated_at", "2026-08-02T12:34:56.000Z"],
        ["generated_by", "Nguyen Van A"],
      ])
    }
  )
})
