import type { Cell, FillPattern, Workbook, Worksheet } from "exceljs"

import { createExcelWorkbook } from "@/lib/excel-workbook"
import {
  BASELINE_WORKBOOK_V2_META_KEYS,
  createTechnicalConfigurationBaselineWorkbookV2Model,
} from "@/lib/technical-configuration-baseline-excel-v2-contract"

type WorkbookModel = ReturnType<typeof createTechnicalConfigurationBaselineWorkbookV2Model>
type WorkbookSheetModel = WorkbookModel["sheets"][number]
type ConfigurationSheetModel = Extract<WorkbookSheetModel, { kind: "configuration" }>
type InstructionsSheetModel = Extract<WorkbookSheetModel, { kind: "instructions" }>
type MetaSheetModel = Extract<WorkbookSheetModel, { kind: "meta" }>

const BASELINE_WORKBOOK_V2_COLORS = {
  header: "FF166534",
  section: "FFE2F0D9",
  subgroup: "FFF3F4F6",
  criterion: "FFFFFFFF",
  instruction: "FFFFF8E1",
  border: "FFD1D5DB",
} as const

function patternFill(color: string): FillPattern {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  }
}

function applyThinBorder(cell: Cell) {
  const edge = {
    style: "thin" as const,
    color: { argb: BASELINE_WORKBOOK_V2_COLORS.border },
  }
  cell.border = { top: edge, left: edge, bottom: edge, right: edge }
}

function applyHeaderStyle(cell: Cell) {
  cell.fill = patternFill(BASELINE_WORKBOOK_V2_COLORS.header)
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  }
  applyThinBorder(cell)
}

function applyDataStyle(cell: Cell, kind: ConfigurationSheetModel["rows"][number]["kind"]) {
  const fillColor = {
    section: BASELINE_WORKBOOK_V2_COLORS.section,
    subgroup: BASELINE_WORKBOOK_V2_COLORS.subgroup,
    criterion: BASELINE_WORKBOOK_V2_COLORS.criterion,
  }[kind]

  cell.fill = patternFill(fillColor)
  cell.font = { bold: kind !== "criterion" }
  cell.alignment = {
    horizontal: Number(cell.col) === 1 ? "center" : "left",
    vertical: "top",
    wrapText: true,
  }
  applyThinBorder(cell)
}

function styleRowCells(worksheet: Worksheet, rowNumber: number, styleCell: (cell: Cell) => void) {
  for (let columnNumber = 1; columnNumber <= worksheet.columnCount; columnNumber += 1) {
    styleCell(worksheet.getCell(rowNumber, columnNumber))
  }
}

function renderConfigurationSheet(workbook: Workbook, model: ConfigurationSheetModel) {
  const worksheet = workbook.addWorksheet(model.name)
  worksheet.state = model.state
  worksheet.columns = model.columns.map((column) => ({
    key: column.key,
    header: column.header,
    width: column.width,
    hidden: column.hidden,
  }))
  worksheet.getRow(1).height = 32
  styleRowCells(worksheet, 1, applyHeaderStyle)

  model.rows.forEach((row) => {
    const worksheetRow = worksheet.addRow({
      stt: row.stt,
      content: row.content,
      main_section_id: row.main_section_id,
      subgroup_id: row.subgroup_id,
      criterion_id: row.criterion_id,
      criterion_code: row.criterion_code,
      criterion_title: row.criterion_title,
    })
    styleRowCells(worksheet, worksheetRow.number, (cell) => applyDataStyle(cell, row.kind))
  })

  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
    },
  ]
}

function applyInstructionRowStyle(
  worksheet: Worksheet,
  rowNumber: number,
  kind: InstructionsSheetModel["rows"][number]["kind"]
) {
  if (kind === "title") {
    worksheet.mergeCells(rowNumber, 1, rowNumber, 2)
  }

  styleRowCells(worksheet, rowNumber, (cell) => {
    if (kind === "title" || kind === "example-header") {
      applyHeaderStyle(cell)
      return
    }

    let fillColor: string
    switch (kind) {
      case "example-section":
        fillColor = BASELINE_WORKBOOK_V2_COLORS.section
        break
      case "example-subgroup":
        fillColor = BASELINE_WORKBOOK_V2_COLORS.subgroup
        break
      case "instruction":
        fillColor = BASELINE_WORKBOOK_V2_COLORS.instruction
        break
      default:
        fillColor = BASELINE_WORKBOOK_V2_COLORS.criterion
    }

    cell.fill = patternFill(fillColor)
    cell.font = { bold: kind !== "example-criterion" }
    cell.alignment = {
      horizontal: Number(cell.col) === 1 ? "center" : "left",
      vertical: "top",
      wrapText: true,
    }
    applyThinBorder(cell)
  })
}

function renderInstructionsSheet(workbook: Workbook, model: InstructionsSheetModel) {
  const worksheet = workbook.addWorksheet(model.name)
  worksheet.state = model.state
  worksheet.getColumn(1).width = 20
  worksheet.getColumn(2).width = 72

  model.rows.forEach((row) => {
    const worksheetRow = worksheet.addRow(
      row.kind === "title" ? [row.content, null] : [row.stt, row.content]
    )
    applyInstructionRowStyle(worksheet, worksheetRow.number, row.kind)
  })
}

function renderMetaSheet(workbook: Workbook, model: MetaSheetModel) {
  const worksheet = workbook.addWorksheet(model.name)
  worksheet.state = model.state
  worksheet.addRow(["key", "value"])
  BASELINE_WORKBOOK_V2_META_KEYS.forEach((key) => {
    worksheet.addRow([key, model.metadata[key]])
  })
  worksheet.getColumn(1).width = 28
  worksheet.getColumn(2).width = 64
}

/** Renders the library-only XLSX v2 workbook model without triggering a download. */
export async function createTechnicalConfigurationBaselineWorkbookV2(
  model: WorkbookModel
): Promise<Workbook> {
  const workbook = await createExcelWorkbook()

  model.sheets.forEach((sheet) => {
    switch (sheet.kind) {
      case "configuration":
        renderConfigurationSheet(workbook, sheet)
        break
      case "instructions":
        renderInstructionsSheet(workbook, sheet)
        break
      case "meta":
        renderMetaSheet(workbook, sheet)
        break
    }
  })

  return workbook
}

/** Serializes the library-only XLSX v2 workbook without creating a Blob or download. */
export async function serializeTechnicalConfigurationBaselineWorkbookV2(model: WorkbookModel) {
  const workbook = await createTechnicalConfigurationBaselineWorkbookV2(model)
  return workbook.xlsx.writeBuffer()
}
