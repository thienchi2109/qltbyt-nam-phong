import {
  COMPARISON_MATRIX_LAYOUT,
  getPinnedComparisonOptionLeft,
} from "@/app/(app)/technical-configurations/comparison-matrix-constants"
import type {
  TechnicalConfigurationComparisonEvidence,
  TechnicalConfigurationComparisonOptionValue,
  TechnicalConfigurationComparisonResult,
} from "@/app/(app)/technical-configurations/comparison-types"

import type { TechnicalConfigurationCriterionDetail } from "./TechnicalConfigurationCriterionPanel"

const EMPTY_EVIDENCE: TechnicalConfigurationComparisonEvidence = {
  documentCount: 0,
  citationCount: 0,
  hasEvidence: false,
}

type TechnicalConfigurationMatrixRowProps = {
  row: TechnicalConfigurationComparisonResult["data"]["criteria"][number]
  options: TechnicalConfigurationComparisonResult["data"]["options"]
  baselineVersionId: string
  pinnedOptionIds: readonly string[]
  valueByOptionId: ReadonlyMap<string, TechnicalConfigurationComparisonOptionValue>
  onOpenDetail: (detail: TechnicalConfigurationCriterionDetail) => void
}

function formatEvidenceSummary(evidence: TechnicalConfigurationComparisonEvidence) {
  if (!evidence.hasEvidence) return "Chưa có bằng chứng"
  return `${evidence.documentCount} tài liệu · ${evidence.citationCount} trích dẫn`
}

/** Renders one criterion across the sticky baseline and visible option columns. */
export function TechnicalConfigurationMatrixRow({
  row,
  options,
  baselineVersionId,
  pinnedOptionIds,
  valueByOptionId,
  onOpenDetail,
}: Readonly<TechnicalConfigurationMatrixRowProps>) {
  const title = row.criterion.title ?? "Chưa có tiêu đề"

  return (
    <tr
      data-testid="comparison-criterion-row"
      data-criterion-id={row.criterion.id}
      className="align-top"
    >
      <th
        className={`sticky left-0 z-30 ${COMPARISON_MATRIX_LAYOUT.criterionWidthClass} border-b border-r bg-background px-3 py-3 font-medium`}
        scope="row"
      >
        <span className="block text-xs text-muted-foreground">{row.criterion.criterionCode}</span>
        <span className="mt-1 block break-words">{title}</span>
      </th>
      <td
        className={`sticky ${COMPARISON_MATRIX_LAYOUT.baselineStickyLeftClass} z-30 ${COMPARISON_MATRIX_LAYOUT.baselineWidthClass} border-b border-r bg-background p-0`}
      >
        <button
          type="button"
          className="h-full w-full space-y-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          aria-label={`Xem chi tiết ${row.criterion.criterionCode} · Yêu cầu cơ sở`}
          onClick={() =>
            onOpenDetail({
              criterionCode: row.criterion.criterionCode,
              criterionTitle: title,
              optionLabel: null,
              requirementText: row.criterion.requirementText,
              responseText: null,
              supplementaryInformation: null,
              evidence: row.baselineEvidence,
              evidenceTarget: {
                kind: "baseline",
                baselineVersionId,
                criterionId: row.criterion.id,
              },
            })
          }
        >
          <p className="line-clamp-4 whitespace-pre-wrap break-words leading-5">
            {row.criterion.requirementText}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatEvidenceSummary(row.baselineEvidence)}
          </p>
        </button>
      </td>
      {options.map((option) => {
        const value = valueByOptionId.get(option.id)
        const response = value?.response
        const evidence = value?.evidence ?? EMPTY_EVIDENCE
        const pinnedIndex = pinnedOptionIds.indexOf(option.id)
        const isPinned = pinnedIndex >= 0

        return (
          <td
            key={option.id}
            data-testid="comparison-option-cell"
            data-criterion-id={row.criterion.id}
            data-option-id={option.id}
            data-pinned={isPinned ? "true" : "false"}
            className={`${COMPARISON_MATRIX_LAYOUT.optionWidthClass} border-b border-r bg-background p-0 ${
              isPinned ? "sticky z-20" : ""
            }`}
            style={isPinned ? { left: getPinnedComparisonOptionLeft(pinnedIndex) } : undefined}
          >
            <button
              type="button"
              className="h-full w-full space-y-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={`Xem chi tiết ${row.criterion.criterionCode} · ${option.displayLabel}`}
              onClick={() =>
                onOpenDetail({
                  criterionCode: row.criterion.criterionCode,
                  criterionTitle: title,
                  optionLabel: option.displayLabel,
                  requirementText: row.criterion.requirementText,
                  responseText: response?.responseText ?? null,
                  supplementaryInformation: response?.supplementaryInformation ?? null,
                  evidence,
                  evidenceTarget: {
                    kind: "option",
                    baselineVersionId,
                    optionId: option.id,
                    criterionId: row.criterion.id,
                  },
                })
              }
            >
              {response ? (
                <>
                  <p className="line-clamp-4 whitespace-pre-wrap break-words leading-5">
                    {response.responseText}
                  </p>
                  {response.supplementaryInformation ? (
                    <p className="text-xs font-medium text-foreground">Có thông tin bổ sung</p>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">Chưa có phản hồi</p>
              )}
              <p className="text-xs text-muted-foreground">{formatEvidenceSummary(evidence)}</p>
            </button>
          </td>
        )
      })}
    </tr>
  )
}
