import type { ValidationResult } from "@/components/bulk-import"
import type {
  TechnicalConfigurationOptionWorkbookCriterion,
  TechnicalConfigurationOptionWorkbookParseResult,
  TechnicalConfigurationOptionWorkbookRow,
} from "@/lib/technical-configuration-option-excel-contract"

import type { TechnicalConfigurationBaselineDraftWire } from "./baseline-types"
import type { TechnicalConfigurationComparisonSetWire } from "./supplier-option-types"

/** MIME type used for supplier-option workbook downloads. */
export const OPTION_WORKBOOK_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Validates the shared parser boundary before authoritative preview. */
export function validateParsedTechnicalConfigurationOptionWorkbook(
  payloads: TechnicalConfigurationOptionWorkbookParseResult[]
): ValidationResult<TechnicalConfigurationOptionWorkbookParseResult> {
  if (payloads.length !== 1) {
    return {
      isValid: false,
      validRecords: [],
      errors: ["Template phải tạo đúng một payload phản hồi phương án."],
    }
  }

  return {
    isValid: true,
    validRecords: payloads,
    errors: [],
  }
}

/** Converts an exact baseline into the ordered read-only workbook context. */
export function toTechnicalConfigurationOptionWorkbookCriteria(
  baselineVersion: TechnicalConfigurationBaselineDraftWire
): TechnicalConfigurationOptionWorkbookCriterion[] {
  return baselineVersion.groups
    .toSorted((left, right) => left.sort_order - right.sort_order)
    .flatMap((group) =>
      group.criteria
        .toSorted((left, right) => left.sort_order - right.sort_order)
        .map((criterion) => ({
          group_order: group.sort_order,
          group_name: group.name,
          criterion_order: criterion.sort_order,
          criterion_id: criterion.id,
          criterion_code: criterion.criterion_code,
          criterion_title: criterion.title,
          requirement_text: criterion.requirement_text,
        }))
    )
}

/** Builds the authoritative full-snapshot workbook rows from the cached response set. */
export function toTechnicalConfigurationOptionWorkbookRows(
  baselineVersion: TechnicalConfigurationBaselineDraftWire,
  comparisonSet: TechnicalConfigurationComparisonSetWire | null
): TechnicalConfigurationOptionWorkbookRow[] {
  const responses = new Map(
    comparisonSet?.responses.map((response) => [response.criterion_id, response]) ?? []
  )

  return toTechnicalConfigurationOptionWorkbookCriteria(baselineVersion).map((criterion) => {
    const response = responses.get(criterion.criterion_id)
    return {
      ...criterion,
      response_text: response?.response_text ?? "",
      supplementary_information: response?.supplementary_information ?? "",
    }
  })
}

/** Rebinds transient parsed data to the refreshed dossier revision before re-preview. */
export function withTechnicalConfigurationOptionImportRevision(
  payload: TechnicalConfigurationOptionWorkbookParseResult,
  revision: number
): TechnicalConfigurationOptionWorkbookParseResult {
  return {
    metadata: {
      ...payload.metadata,
      dossier_revision: revision,
    },
    rows: payload.rows,
  }
}

/** Returns a usable import error while preserving server-provided detail. */
export function getTechnicalConfigurationOptionImportErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error && error.message ? error.message : fallback
}
