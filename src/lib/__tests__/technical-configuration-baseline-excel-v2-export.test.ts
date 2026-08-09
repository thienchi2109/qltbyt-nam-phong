import type { Cell } from "exceljs"
import { describe, expect, it } from "vitest"

import {
  createTechnicalConfigurationBaselineWorkbookV2Model,
  type TechnicalConfigurationBaselineWorkbookV2GroupSource,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"
import {
  createTechnicalConfigurationBaselineWorkbookV2,
  serializeTechnicalConfigurationBaselineWorkbookV2,
} from "@/lib/technical-configuration-baseline-excel-v2-export"

const METADATA = {
  dossier_id: "dossier-1",
  baseline_version_id: "baseline-version-1",
  baseline_revision: 7,
  generated_at: "2026-08-09T10:15:00.000Z",
} as const

const CURRENT_DATA_GROUPS: readonly TechnicalConfigurationBaselineWorkbookV2GroupSource[] = [
  {
    id: "section-1",
    name: "Yêu cầu chung – thiết bị",
    criteria: [
      {
        id: "criterion-direct",
        criterion_code: "TC-001",
        title: "Tiêu đề nội bộ",
        requirement_text: "Dòng một\nDòng hai – khe hở ≤ 5 µm",
      },
    ],
    subgroups: [
      {
        id: "subgroup-1",
        name: "Điều kiện vận hành",
        criteria: [
          {
            id: "criterion-subgroup",
            criterion_code: "TC-002",
            title: null,
            requirement_text: "Hoạt động ổn định ở 40 °C",
          },
        ],
      },
    ],
  },
  {
    id: "section-2",
    name: "Yêu cầu khác",
    criteria: [],
    subgroups: [],
  },
]

function getPatternFillColor(cell: Cell): string | undefined {
  return cell.fill.type === "pattern" ? cell.fill.fgColor?.argb : undefined
}

describe("technical configuration baseline XLSX v2 workbook export", () => {
  it("builds the current-data workbook model with two visible columns and hidden round-trip identity", () => {
    const model = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "current-data",
      metadata: METADATA,
      groups: CURRENT_DATA_GROUPS,
    })

    expect(model.sheets.map((sheet) => [sheet.name, sheet.state])).toEqual([
      ["Nhập cấu hình", "visible"],
      ["Hướng dẫn & Ví dụ", "visible"],
      ["_meta", "hidden"],
    ])

    const configuration = model.sheets.find((sheet) => sheet.kind === "configuration")
    expect(configuration).toBeDefined()
    if (!configuration) return

    expect(
      configuration.columns.filter((column) => !column.hidden).map((column) => column.header)
    ).toEqual(["STT", "NỘI DUNG YÊU CẦU"])
    expect(
      configuration.columns.filter((column) => column.hidden).map((column) => column.header)
    ).toEqual([
      "__main_section_id",
      "__subgroup_id",
      "__criterion_id",
      "__criterion_code",
      "__criterion_title",
    ])

    expect(configuration.rows).toEqual([
      {
        kind: "section",
        stt: "I",
        content: "Yêu cầu chung – thiết bị",
        main_section_id: "section-1",
        subgroup_id: null,
        criterion_id: null,
        criterion_code: null,
        criterion_title: null,
      },
      {
        kind: "criterion",
        stt: null,
        content: "Dòng một\nDòng hai – khe hở ≤ 5 µm",
        main_section_id: "section-1",
        subgroup_id: null,
        criterion_id: "criterion-direct",
        criterion_code: "TC-001",
        criterion_title: "Tiêu đề nội bộ",
      },
      {
        kind: "subgroup",
        stt: "1",
        content: "Điều kiện vận hành",
        main_section_id: "section-1",
        subgroup_id: "subgroup-1",
        criterion_id: null,
        criterion_code: null,
        criterion_title: null,
      },
      {
        kind: "criterion",
        stt: null,
        content: "Hoạt động ổn định ở 40 °C",
        main_section_id: "section-1",
        subgroup_id: "subgroup-1",
        criterion_id: "criterion-subgroup",
        criterion_code: "TC-002",
        criterion_title: null,
      },
      {
        kind: "section",
        stt: "II",
        content: "Yêu cầu khác",
        main_section_id: "section-2",
        subgroup_id: null,
        criterion_id: null,
        criterion_code: null,
        criterion_title: null,
      },
    ])
  })

  it("builds a blank template with examples only on the instructions sheet and versioned metadata", () => {
    const model = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "blank-template",
      metadata: METADATA,
    })

    const configuration = model.sheets.find((sheet) => sheet.kind === "configuration")
    const instructions = model.sheets.find((sheet) => sheet.kind === "instructions")
    const meta = model.sheets.find((sheet) => sheet.kind === "meta")

    expect(configuration?.rows).toEqual([])
    expect(instructions?.rows).toEqual([
      {
        kind: "title",
        stt: null,
        content: "HƯỚNG DẪN NHẬP CẤU HÌNH",
      },
      {
        kind: "instruction",
        stt: "STT La Mã",
        content: "Mục chính, ví dụ I, II, III.",
      },
      {
        kind: "instruction",
        stt: "STT số nguyên",
        content: "Nhóm con của mục chính gần nhất, ví dụ 1, 2, 3.",
      },
      {
        kind: "instruction",
        stt: "STT để trống",
        content: "Tiêu chí; có thể nhập nội dung nhiều dòng trong một ô.",
      },
      {
        kind: "example-header",
        stt: "STT",
        content: "NỘI DUNG YÊU CẦU",
      },
      {
        kind: "example-section",
        stt: "I",
        content: "Yêu cầu kỹ thuật",
      },
      {
        kind: "example-criterion",
        stt: null,
        content: "Độ chính xác ≤ 0,5 mm\nHỗ trợ tiếng Việt.",
      },
      {
        kind: "example-subgroup",
        stt: "1",
        content: "Điều kiện vận hành",
      },
      {
        kind: "example-criterion",
        stt: null,
        content: "Hoạt động ổn định ở 40 °C.",
      },
    ])
    expect(meta?.metadata).toEqual({
      template_kind: "technical_configuration_baseline",
      template_version: 2,
      dossier_id: "dossier-1",
      baseline_version_id: "baseline-version-1",
      baseline_revision: 7,
      generated_at: "2026-08-09T10:15:00.000Z",
    })
  })

  it("renders the current-data model with stable layout, styles, hidden identity, and a frozen header", async () => {
    const model = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "current-data",
      metadata: METADATA,
      groups: CURRENT_DATA_GROUPS,
    })
    const workbook = await createTechnicalConfigurationBaselineWorkbookV2(model)
    const configuration = workbook.getWorksheet("Nhập cấu hình")

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Nhập cấu hình",
      "Hướng dẫn & Ví dụ",
      "_meta",
    ])
    expect(configuration).toBeDefined()
    if (!configuration) return

    expect(configuration.getRow(1).values).toEqual([
      undefined,
      "STT",
      "NỘI DUNG YÊU CẦU",
      "__main_section_id",
      "__subgroup_id",
      "__criterion_id",
      "__criterion_code",
      "__criterion_title",
    ])
    expect(configuration.columns.map((column) => column.hidden === true)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ])
    expect(configuration.columns.map((column) => column.width)).toEqual([
      12, 72, 24, 24, 24, 20, 40,
    ])
    expect(configuration.views).toEqual([
      {
        state: "frozen",
        ySplit: 1,
        topLeftCell: "A2",
        activeCell: "A2",
      },
    ])

    expect(configuration.getCell("A2").value).toBe("I")
    expect(configuration.getCell("B3").value).toBe("Dòng một\nDòng hai – khe hở ≤ 5 µm")
    expect(configuration.getCell("C3").value).toBe("section-1")
    expect(configuration.getCell("E3").value).toBe("criterion-direct")
    expect(configuration.getCell("F3").value).toBe("TC-001")
    expect(configuration.getCell("G3").value).toBe("Tiêu đề nội bộ")
    expect(configuration.getCell("B3").alignment).toMatchObject({
      vertical: "top",
      wrapText: true,
    })
    expect(configuration.getCell("A2").alignment).toMatchObject({
      horizontal: "center",
    })
    expect(configuration.getRow(3).height).toBeUndefined()

    expect(getPatternFillColor(configuration.getCell("A1"))).toBe("FF166534")
    expect(configuration.getCell("A1").font).toMatchObject({
      bold: true,
      color: { argb: "FFFFFFFF" },
    })
    expect(getPatternFillColor(configuration.getCell("B2"))).toBe("FFE2F0D9")
    expect(getPatternFillColor(configuration.getCell("B4"))).toBe("FFF3F4F6")
    expect(getPatternFillColor(configuration.getCell("B3"))).toBe("FFFFFFFF")
    expect(configuration.getCell("B2").font.bold).toBe(true)
    expect(configuration.getCell("B4").font.bold).toBe(true)

    expect(workbook.getWorksheet("_meta")?.state).toBe("hidden")
    expect(workbook.getWorksheet("Hướng dẫn & Ví dụ")?.getRow(7).height).toBeUndefined()
  })

  it("preserves Unicode, multiline text, hidden fields, styles, and blank-template layout after serialization", async () => {
    const currentDataModel = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "current-data",
      metadata: METADATA,
      groups: CURRENT_DATA_GROUPS,
    })
    const serialized = await serializeTechnicalConfigurationBaselineWorkbookV2(currentDataModel)
    const ExcelJS = await import("exceljs")
    const loaded = new ExcelJS.Workbook()
    await loaded.xlsx.load(serialized)

    const configuration = loaded.getWorksheet("Nhập cấu hình")
    expect(configuration?.getCell("B3").value).toBe("Dòng một\nDòng hai – khe hở ≤ 5 µm")
    expect(configuration?.getCell("G3").value).toBe("Tiêu đề nội bộ")
    expect(configuration?.getColumn(3).hidden).toBe(true)
    expect(configuration?.views[0]).toMatchObject({ state: "frozen", ySplit: 1 })
    expect(configuration ? getPatternFillColor(configuration.getCell("B2")) : undefined).toBe(
      "FFE2F0D9"
    )
    expect(loaded.getWorksheet("_meta")?.state).toBe("hidden")
    expect(loaded.getWorksheet("Hướng dẫn & Ví dụ")?.getCell("A1").value).toBe(
      "HƯỚNG DẪN NHẬP CẤU HÌNH"
    )

    const blankModel = createTechnicalConfigurationBaselineWorkbookV2Model({
      intent: "blank-template",
      metadata: METADATA,
    })
    const blankWorkbook = await createTechnicalConfigurationBaselineWorkbookV2(blankModel)
    expect(blankWorkbook.getWorksheet("Nhập cấu hình")?.rowCount).toBe(1)
    expect(blankWorkbook.getWorksheet("Hướng dẫn & Ví dụ")?.getCell("B7").value).toBe(
      "Độ chính xác ≤ 0,5 mm\nHỗ trợ tiếng Việt."
    )
  })
})
