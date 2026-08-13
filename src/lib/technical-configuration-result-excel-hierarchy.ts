import type { Worksheet } from "exceljs"

import type { TechnicalConfigurationResultWorkbookSheetModel } from "@/lib/technical-configuration-result-excel-contract"
import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES,
} from "@/lib/technical-configuration-evaluation"
import {
  TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS,
  type TechnicalConfigurationAggregateStatus,
} from "@/lib/technical-configuration-hierarchy-aggregate-status"
import {
  RESULT_EXCEL_COLORS,
  applyResultExcelDataCell,
  resultExcelPatternFill,
} from "@/lib/technical-configuration-result-excel-styles"

type MatrixSheetModel = Extract<TechnicalConfigurationResultWorkbookSheetModel, { kind: "matrix" }>
type StructuralRow = Exclude<MatrixSheetModel["rows"][number], { kind: "criterion" }>
type StructuralAggregate = StructuralRow["option_aggregates"][number]

const AGGREGATE_FILLS = {
  no_criteria: RESULT_EXCEL_COLORS.gray,
  failed: RESULT_EXCEL_COLORS.red,
  in_progress: RESULT_EXCEL_COLORS.amber,
  needs_clarification: RESULT_EXCEL_COLORS.amber,
  not_applicable: RESULT_EXCEL_COLORS.gray,
  passed: RESULT_EXCEL_COLORS.green,
} as const satisfies Record<TechnicalConfigurationAggregateStatus, string>

function formatStatusCounts(aggregate: StructuralAggregate) {
  return TECHNICAL_CONFIGURATION_DERIVED_STATUS_VALUES.flatMap((status) => {
    const count = aggregate.status_counts[status]
    return count > 0 ? [`${TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[status]}: ${count}`] : []
  }).join("; ")
}

function formatAggregate(aggregate: StructuralAggregate) {
  return [
    TECHNICAL_CONFIGURATION_AGGREGATE_STATUS_LABELS[aggregate.status],
    aggregate.descendant_count > 0 ? `${aggregate.descendant_count} tiêu chí` : "",
    formatStatusCounts(aggregate),
  ]
    .filter(Boolean)
    .join(" | ")
}

/** Renders a hierarchy row with one merged aggregate cell per option. */
export function renderTechnicalConfigurationResultStructuralRow(
  worksheet: Worksheet,
  row: StructuralRow,
  rowIndex: number,
  lastColumn: number
) {
  const worksheetRow = worksheet.addRow(["", row.name, "", ""])
  worksheetRow.height = 32

  for (let column = 1; column <= lastColumn; column += 1) {
    applyResultExcelDataCell(worksheetRow.getCell(column), rowIndex % 2 === 1)
  }
  const labelCell = worksheetRow.getCell(2)
  labelCell.font = { ...labelCell.font, bold: true }
  if (row.kind === "subgroup") {
    labelCell.alignment = { ...labelCell.alignment, indent: 1 }
  }

  row.option_aggregates.forEach((aggregate, optionIndex) => {
    const startColumn = 5 + optionIndex * 3
    const endColumn = startColumn + 2
    const startCell = worksheetRow.getCell(startColumn)
    startCell.value = formatAggregate(aggregate)
    startCell.fill = resultExcelPatternFill(AGGREGATE_FILLS[aggregate.status])
    worksheet.mergeCells(worksheetRow.number, startColumn, worksheetRow.number, endColumn)
  })

  return worksheetRow
}
