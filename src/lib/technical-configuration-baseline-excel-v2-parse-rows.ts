import type { Worksheet } from "exceljs"

import { BASELINE_WORKBOOK_V2_COLUMNS } from "@/lib/technical-configuration-baseline-excel-v2-contract"
import {
  throwIfTechnicalConfigurationBaselineWorkbookV2Issues,
  type TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy,
  type TechnicalConfigurationBaselineWorkbookV2Issue,
  type TechnicalConfigurationBaselineWorkbookV2ParsedRow,
} from "@/lib/technical-configuration-baseline-excel-v2-parse-contract"
import { toNullableTechnicalConfigurationBaselineWorkbookV2Text } from "@/lib/technical-configuration-baseline-excel-v2-parse-cells"

const ROMAN_MARKER_PATTERN = /^(?=[IVXLCDM]+$)M*(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i
const POSITIVE_INTEGER_MARKER_PATTERN = /^[1-9][0-9]*$/

function classifyRowMarker(stt: string | null): "GROUP" | "SUBGROUP" | "CRITERION" | null {
  if (stt === null) return "CRITERION"
  if (ROMAN_MARKER_PATTERN.test(stt)) return "GROUP"
  if (POSITIVE_INTEGER_MARKER_PATTERN.test(stt)) return "SUBGROUP"
  return null
}

/** Parses visible hierarchy rows in physical order and validates hidden identity hints. */
export function parseTechnicalConfigurationBaselineWorkbookV2Rows(
  worksheet: Worksheet,
  existingHierarchy: TechnicalConfigurationBaselineWorkbookV2ExistingHierarchy
): TechnicalConfigurationBaselineWorkbookV2ParsedRow[] {
  const issues: TechnicalConfigurationBaselineWorkbookV2Issue[] = []
  const rows: TechnicalConfigurationBaselineWorkbookV2ParsedRow[] = []
  const criteriaById = new Map(
    existingHierarchy.criteria.map((criterion) => [criterion.id, criterion])
  )
  const seenGroupIds = new Set<string>()
  const seenSubgroupIds = new Set<string>()
  const seenCriterionIds = new Set<string>()
  let groupOrder = 0
  let subgroupOrder = 0
  let criterionOrder = 0
  let hasCurrentGroup = false
  let hasCurrentSubgroup = false
  let suppressMissingParentCascade = false
  const invalidateSubgroupBoundary = () => {
    hasCurrentSubgroup = false
    suppressMissingParentCascade = true
  }
  const populatedRowNumbers: number[] = []

  worksheet.eachRow((_worksheetRow, rowNumber) => {
    if (rowNumber > 1) populatedRowNumbers.push(rowNumber)
  })

  for (const rowNumber of populatedRowNumbers) {
    const worksheetRow = worksheet.getRow(rowNumber)
    const values = BASELINE_WORKBOOK_V2_COLUMNS.map((_, index) =>
      toNullableTechnicalConfigurationBaselineWorkbookV2Text(worksheetRow.getCell(index + 1).value)
    )
    const [stt, content, groupId, subgroupId, criterionId, criterionCode] = values
    if (values.every((value) => value === null)) continue

    const rowType = classifyRowMarker(stt)
    if (!rowType) {
      issues.push({
        code: "unsupported_marker",
        row: rowNumber,
        column: "stt",
        message: "STT phải là số La Mã, số nguyên dương hoặc để trống.",
      })
      continue
    }
    if (!content) {
      issues.push({
        code: "empty_content",
        row: rowNumber,
        column: "content",
        message: "NỘI DUNG YÊU CẦU là bắt buộc cho mọi dòng có dữ liệu.",
      })
      if (rowType === "GROUP") {
        hasCurrentGroup = false
        hasCurrentSubgroup = false
        suppressMissingParentCascade = true
      } else if (rowType === "SUBGROUP") {
        invalidateSubgroupBoundary()
      }
      continue
    }

    if (rowType === "GROUP") {
      if (subgroupId || criterionId || criterionCode) {
        issues.push({
          code: "wrong_identity_kind",
          row: rowNumber,
          message: "Dòng mục chính chỉ được mang main_section_id.",
        })
        hasCurrentGroup = false
        hasCurrentSubgroup = false
        suppressMissingParentCascade = true
        continue
      }
      if (groupId && seenGroupIds.has(groupId)) {
        issues.push({
          code: "duplicate_identity",
          row: rowNumber,
          column: "main_section_id",
          message: "main_section_id bị lặp trong workbook.",
        })
        hasCurrentGroup = false
        hasCurrentSubgroup = false
        suppressMissingParentCascade = true
        continue
      }

      groupOrder += 1
      subgroupOrder = 0
      criterionOrder = 0
      hasCurrentGroup = true
      hasCurrentSubgroup = false
      suppressMissingParentCascade = false
      if (groupId) seenGroupIds.add(groupId)
      rows.push({
        row: rowNumber,
        row_type: "GROUP",
        group_order: groupOrder,
        group_id: groupId,
        group_name: content,
      })
      continue
    }

    if (rowType === "SUBGROUP") {
      if (criterionId || criterionCode) {
        issues.push({
          code: "wrong_identity_kind",
          row: rowNumber,
          message: "Dòng nhóm con không được mang identity tiêu chí.",
        })
        invalidateSubgroupBoundary()
        continue
      }
      if (groupId !== null && subgroupId === null) {
        issues.push({
          code: "partial_identity",
          row: rowNumber,
          message: "main_section_id không được tồn tại khi subgroup_id bị thiếu.",
        })
        invalidateSubgroupBoundary()
        continue
      }
      if (subgroupId && seenSubgroupIds.has(subgroupId)) {
        issues.push({
          code: "duplicate_identity",
          row: rowNumber,
          column: "subgroup_id",
          message: "subgroup_id bị lặp trong workbook.",
        })
        invalidateSubgroupBoundary()
        continue
      }
      if (!hasCurrentGroup) {
        if (!suppressMissingParentCascade) {
          issues.push({
            code: "subgroup_without_section",
            row: rowNumber,
            message: "Mọi nội dung phải đứng sau một mục chính.",
          })
        }
        invalidateSubgroupBoundary()
        continue
      }

      subgroupOrder += 1
      hasCurrentSubgroup = true
      suppressMissingParentCascade = false
      if (subgroupId) seenSubgroupIds.add(subgroupId)
      rows.push({
        row: rowNumber,
        row_type: "SUBGROUP",
        group_order: groupOrder,
        subgroup_order: subgroupOrder,
        subgroup_id: subgroupId,
        subgroup_name: content,
      })
      continue
    }

    if ((criterionId === null) !== (criterionCode === null)) {
      issues.push({
        code: "partial_identity",
        row: rowNumber,
        message: "criterion_id và criterion_code phải cùng có hoặc cùng trống.",
      })
      continue
    }

    const existingCriterion = criterionId ? criteriaById.get(criterionId) : undefined
    if (criterionId && seenCriterionIds.has(criterionId)) {
      issues.push({
        code: "duplicate_identity",
        row: rowNumber,
        column: "criterion_id",
        message: "criterion_id bị lặp trong workbook.",
      })
      continue
    }
    if (!criterionId && (groupId || subgroupId)) {
      issues.push({
        code: "partial_identity",
        row: rowNumber,
        message: "Tiêu chí mới không được mang một phần hidden identity.",
      })
      continue
    }
    if (suppressMissingParentCascade) continue
    if (!hasCurrentGroup) {
      if (!suppressMissingParentCascade) {
        issues.push({
          code: "content_before_section",
          row: rowNumber,
          message: "Mọi nội dung phải đứng sau một mục chính.",
        })
      }
      continue
    }

    criterionOrder += 1
    if (criterionId) seenCriterionIds.add(criterionId)
    rows.push({
      row: rowNumber,
      row_type: "CRITERION",
      group_order: groupOrder,
      subgroup_order: hasCurrentSubgroup ? subgroupOrder : null,
      criterion_order: criterionOrder,
      criterion_id: criterionId,
      criterion_code: criterionCode,
      criterion_title: existingCriterion?.title ?? null,
      requirement_text: content,
    })
  }

  throwIfTechnicalConfigurationBaselineWorkbookV2Issues(issues)
  return rows
}
