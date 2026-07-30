import type { TechnicalConfigurationComparisonCriterionRow } from "../../comparison-types"

/** Normalizes an unknown assessment save failure for the evaluation panel. */
export function toTechnicalConfigurationSaveErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Không thể lưu đánh giá."
}

/** Keeps the requested criterion when it exists on the current bounded page. */
export function resolveTechnicalConfigurationCriterionId(
  criteria: TechnicalConfigurationComparisonCriterionRow[],
  requestedCriterionId: string | null
): string | null {
  if (requestedCriterionId && criteria.some((row) => row.criterion.id === requestedCriterionId)) {
    return requestedCriterionId
  }
  return criteria[0]?.criterion.id ?? null
}
