import type { ComponentProps } from "react"

import type { TechnicalConfigurationMatrix } from "../_components/comparison/TechnicalConfigurationMatrix"

type MatrixProps = ComponentProps<typeof TechnicalConfigurationMatrix>

export function TechnicalConfigurationEvaluationMatrixTestAdapter({
  result,
  activeEvaluationOptionId,
  activeEvaluationCriterionId,
  matchingEvaluationCriterionIds,
  evaluationDisabled,
  onOpenEvaluation,
  onPageChange,
  viewportHeightClassName,
}: MatrixProps) {
  if (!result || !activeEvaluationOptionId || !onOpenEvaluation) return null

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))

  return (
    <div
      data-testid="evaluation-matrix-adapter"
      data-viewport-height-class-name={viewportHeightClassName}
    >
      {result.data.criteria.map((row) => (
        <button
          key={row.criterion.id}
          type="button"
          data-testid="evaluation-criterion"
          data-criterion-id={row.criterion.id}
          data-filter-match={
            matchingEvaluationCriterionIds?.has(row.criterion.id) ? "true" : "false"
          }
          aria-current={row.criterion.id === activeEvaluationCriterionId ? "true" : undefined}
          disabled={evaluationDisabled}
          onClick={(event) =>
            onOpenEvaluation({
              optionId: activeEvaluationOptionId,
              criterionId: row.criterion.id,
              trigger: event.currentTarget,
            })
          }
        >
          {row.criterion.criterionCode}
        </button>
      ))}
      <span>{`Trang ${result.page}/${totalPages}`}</span>
      <button
        type="button"
        aria-label="Trang trước"
        disabled={evaluationDisabled || result.page <= 1}
        onClick={() => onPageChange(result.page - 1)}
      >
        Trang trước
      </button>
      <button
        type="button"
        aria-label="Trang tiếp theo"
        disabled={evaluationDisabled || result.page >= totalPages}
        onClick={() => onPageChange(result.page + 1)}
      >
        Trang tiếp theo
      </button>
    </div>
  )
}
