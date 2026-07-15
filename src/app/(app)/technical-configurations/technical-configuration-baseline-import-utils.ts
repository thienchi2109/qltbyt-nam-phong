import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import type { ValidationResult } from "@/components/bulk-import"
import type {
  TechnicalConfigurationBaselineWorkbookParseResult,
  TechnicalConfigurationBaselineWorkbookRow,
} from "@/lib/technical-configuration-baseline-excel-contract"

/** MIME type used for baseline workbook downloads. */
export const BASELINE_WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Validates the parser boundary before the workbook enters preview. */
export function validateParsedBaselineWorkbook(
  payloads: TechnicalConfigurationBaselineWorkbookParseResult[]
): ValidationResult<TechnicalConfigurationBaselineWorkbookParseResult> {
  if (payloads.length !== 1) {
    return {
      isValid: false,
      validRecords: [],
      errors: ["Template phải tạo đúng một payload cấu hình cơ sở."],
    }
  }

  return {
    isValid: true,
    validRecords: payloads,
    errors: [],
  }
}

/** Converts a baseline draft into ordered workbook rows. */
export function toBaselineWorkbookRows(
  version: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationBaselineWorkbookRow[] {
  return version.groups
    .toSorted((left, right) => left.sort_order - right.sort_order)
    .flatMap((group, groupIndex) => [
      {
        row_type: "GROUP" as const,
        group_order: groupIndex + 1,
        group_name: group.name,
        criterion_order: null,
        criterion_code: null,
        criterion_title: null,
        requirement_text: null,
      },
      ...group.criteria
        .toSorted((left, right) => left.sort_order - right.sort_order)
        .map((criterion, criterionIndex) => ({
          row_type: "CRITERION" as const,
          group_order: groupIndex + 1,
          group_name: null,
          criterion_order: criterionIndex + 1,
          criterion_code: criterion.criterion_code,
          criterion_title: criterion.title,
          requirement_text: criterion.requirement_text,
        })),
    ])
}

/** Returns an actionable import error while preserving a stable fallback. */
export function getBaselineImportErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) return fallback
  return error.message
}
