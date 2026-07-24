import type {
  TechnicalConfigurationBaselineCriterionWire,
  TechnicalConfigurationBaselineDraftWire,
} from "./baseline-types"
import type {
  TechnicalConfigurationComparisonSetWire,
  TechnicalConfigurationOptionResponseWire,
  TechnicalConfigurationOptionWire,
} from "./supplier-option-types"

export type TechnicalConfigurationOptionResponseDraft = {
  responseText: string
  supplementaryInformation: string
}

export type TechnicalConfigurationOptionResponseDraftPatch =
  Partial<TechnicalConfigurationOptionResponseDraft>

/** Empty local draft used when an exact-baseline comparison set has no response yet. */
export const EMPTY_OPTION_RESPONSE_DRAFT: TechnicalConfigurationOptionResponseDraft = {
  responseText: "",
  supplementaryInformation: "",
}

/** Flattens exact-version criteria without changing the canonical baseline snapshot. */
export function flattenTechnicalConfigurationBaselineCriteria(
  baselineVersion: TechnicalConfigurationBaselineDraftWire | null
): TechnicalConfigurationBaselineCriterionWire[] {
  if (!baselineVersion) return []
  return baselineVersion.groups
    .toSorted((left, right) => left.sort_order - right.sort_order)
    .flatMap((group) =>
      group.criteria.toSorted((left, right) => left.sort_order - right.sort_order)
    )
}

/** Finds the response bound to one criterion inside an exact-baseline comparison set. */
export function findTechnicalConfigurationOptionResponse(
  snapshot: TechnicalConfigurationComparisonSetWire | null,
  criterionId: string | null
): TechnicalConfigurationOptionResponseWire | null {
  if (!snapshot || !criterionId) return null
  return snapshot.responses.find((response) => response.criterion_id === criterionId) ?? null
}

/** Converts a persisted response into the local multiline editor shape. */
export function toTechnicalConfigurationOptionResponseDraft(
  response: TechnicalConfigurationOptionResponseWire | null
): TechnicalConfigurationOptionResponseDraft {
  if (!response) return { ...EMPTY_OPTION_RESPONSE_DRAFT }
  return {
    responseText: response.response_text,
    supplementaryInformation: response.supplementary_information,
  }
}

/** Compares local response text without normalizing meaningful whitespace or line breaks. */
export function areTechnicalConfigurationOptionResponseDraftsEqual(
  left: TechnicalConfigurationOptionResponseDraft,
  right: TechnicalConfigurationOptionResponseDraft
): boolean {
  return (
    left.responseText === right.responseText &&
    left.supplementaryInformation === right.supplementaryInformation
  )
}

/** Requires a scoring response while keeping supplementary text optional and non-scoring. */
export function validateTechnicalConfigurationOptionResponseDraft(
  draft: TechnicalConfigurationOptionResponseDraft,
  criterionId: string | null
): string | null {
  if (!criterionId) return "Chưa có tiêu chí để lưu phản hồi."
  return draft.responseText.trim() ? null : "Phản hồi tiêu chí là bắt buộc."
}

/** Replaces one criterion response while preserving the remaining exact-baseline responses. */
export function replaceTechnicalConfigurationOptionResponse(
  snapshot: TechnicalConfigurationComparisonSetWire,
  response: TechnicalConfigurationOptionResponseWire
): TechnicalConfigurationComparisonSetWire {
  const hasResponse = snapshot.responses.some((item) => item.criterion_id === response.criterion_id)
  return {
    ...snapshot,
    revision: response.revision,
    updated_at: response.updated_at,
    updated_by: response.updated_by,
    responses: hasResponse
      ? snapshot.responses.map((item) =>
          item.criterion_id === response.criterion_id ? response : item
        )
      : [...snapshot.responses, response],
  }
}

/** Returns the latest timestamp visible for the current option/criterion context. */
export function getTechnicalConfigurationOptionResponseUpdatedAt(
  option: TechnicalConfigurationOptionWire,
  snapshot: TechnicalConfigurationComparisonSetWire | null,
  criterionId: string | null
): string {
  const response = findTechnicalConfigurationOptionResponse(snapshot, criterionId)
  if (!response) return option.updated_at
  return new Date(response.updated_at).getTime() > new Date(option.updated_at).getTime()
    ? response.updated_at
    : option.updated_at
}

/** Maps option-response persistence failures to one actionable workspace message. */
export function getTechnicalConfigurationOptionResponseErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (!(error instanceof Error)) return fallback
  if (error.message === "stale_revision") {
    return "Dữ liệu hồ sơ đã thay đổi. Tải lại dữ liệu trước khi lưu lại."
  }
  if (error.message === "archived_dossier") {
    return "Hồ sơ đã lưu trữ và chỉ được xem."
  }
  return error.message || fallback
}
