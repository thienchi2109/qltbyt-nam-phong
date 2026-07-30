import type {
  TechnicalConfigurationComparisonCriterionRow,
  TechnicalConfigurationComparisonOption,
  TechnicalConfigurationComparisonOptionValue,
} from "../../comparison-types"
import type { TechnicalConfigurationCriterionDetail } from "./TechnicalConfigurationCriterionPanel"

const EMPTY_EVIDENCE = {
  documentCount: 0,
  citationCount: 0,
  hasEvidence: false,
} as const

/** Builds the shared P10B option-detail contract for comparison and evaluation. */
export function createTechnicalConfigurationOptionCriterionDetail({
  row,
  option,
  value,
  baselineVersionId,
}: {
  row: TechnicalConfigurationComparisonCriterionRow
  option: TechnicalConfigurationComparisonOption
  value: TechnicalConfigurationComparisonOptionValue | undefined
  baselineVersionId: string
}): TechnicalConfigurationCriterionDetail {
  return {
    criterionCode: row.criterion.criterionCode,
    criterionTitle: row.criterion.title ?? "Chưa có tiêu đề",
    optionLabel: option.displayLabel,
    requirementText: row.criterion.requirementText,
    responseText: value?.response?.responseText ?? null,
    supplementaryInformation: value?.response?.supplementaryInformation ?? null,
    evidence: value?.evidence ?? EMPTY_EVIDENCE,
    evidenceTarget: {
      kind: "option",
      baselineVersionId,
      optionId: option.id,
      criterionId: row.criterion.id,
    },
  }
}
