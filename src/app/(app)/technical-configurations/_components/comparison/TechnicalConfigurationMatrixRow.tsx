import { ClipboardCheck } from "lucide-react"

import {
  COMPARISON_MATRIX_LAYOUT,
  getPinnedComparisonOptionLeft,
} from "@/app/(app)/technical-configurations/comparison-matrix-constants"
import type {
  TechnicalConfigurationComparisonEvidence,
  TechnicalConfigurationComparisonOptionValue,
  TechnicalConfigurationComparisonResult,
} from "@/app/(app)/technical-configurations/comparison-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS,
  type TechnicalConfigurationDerivedStatus,
} from "@/lib/technical-configuration-evaluation"
import { cn } from "@/lib/utils"

import type { TechnicalConfigurationCriterionDetail } from "./TechnicalConfigurationCriterionPanel"
import { createTechnicalConfigurationOptionCriterionDetail } from "./technical-configuration-criterion-detail"
import { TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS } from "../evaluation/technical-configuration-evaluation-status-badge"

export type TechnicalConfigurationMatrixEvaluationTarget = {
  optionId: string
  criterionId: string
  trigger: HTMLElement
}

type TechnicalConfigurationMatrixRowProps = {
  row: TechnicalConfigurationComparisonResult["data"]["criteria"][number]
  options: TechnicalConfigurationComparisonResult["data"]["options"]
  baselineVersionId: string
  pinnedOptionIds: readonly string[]
  valueByOptionId: ReadonlyMap<string, TechnicalConfigurationComparisonOptionValue>
  onOpenDetail: (detail: TechnicalConfigurationCriterionDetail) => void
  activeEvaluationOptionId?: string | null
  activeEvaluationCriterionId?: string | null
  assessmentStatusByCriterionId?: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
  matchingEvaluationCriterionIds?: ReadonlySet<string>
  evaluationDisabled?: boolean
  onOpenEvaluation?: (target: TechnicalConfigurationMatrixEvaluationTarget) => void
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
  activeEvaluationOptionId = null,
  activeEvaluationCriterionId = null,
  assessmentStatusByCriterionId,
  matchingEvaluationCriterionIds,
  evaluationDisabled = false,
  onOpenEvaluation,
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
        const detail = createTechnicalConfigurationOptionCriterionDetail({
          row,
          option,
          value,
          baselineVersionId,
        })
        const pinnedIndex = pinnedOptionIds.indexOf(option.id)
        const isPinned = pinnedIndex >= 0
        const isActiveEvaluationOption = option.id === activeEvaluationOptionId
        const isActiveEvaluationTarget =
          isActiveEvaluationOption && row.criterion.id === activeEvaluationCriterionId
        const isFilterMatch =
          isActiveEvaluationOption && Boolean(matchingEvaluationCriterionIds?.has(row.criterion.id))
        const assessmentStatus =
          assessmentStatusByCriterionId?.get(row.criterion.id) ?? "not_evaluated"
        const cellContent = (
          <>
            {detail.responseText !== null ? (
              <>
                <p className="line-clamp-4 whitespace-pre-wrap break-words leading-5">
                  {detail.responseText}
                </p>
                {detail.supplementaryInformation ? (
                  <p className="text-xs font-medium text-foreground">Có thông tin bổ sung</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Chưa có phản hồi</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatEvidenceSummary(detail.evidence)}
            </p>
            {isActiveEvaluationOption ? (
              <Badge
                variant={TECHNICAL_CONFIGURATION_EVALUATION_STATUS_BADGE_VARIANTS[assessmentStatus]}
                className="max-w-32 justify-center whitespace-normal text-center"
              >
                {TECHNICAL_CONFIGURATION_DERIVED_STATUS_LABELS[assessmentStatus]}
              </Badge>
            ) : null}
          </>
        )

        return (
          <td
            key={option.id}
            data-testid="comparison-option-cell"
            data-criterion-id={row.criterion.id}
            data-option-id={option.id}
            data-pinned={isPinned ? "true" : "false"}
            data-evaluation-active={isActiveEvaluationTarget ? "true" : "false"}
            data-evaluation-column={isActiveEvaluationOption ? "true" : "false"}
            data-filter-match={isFilterMatch ? "true" : "false"}
            className={cn(
              COMPARISON_MATRIX_LAYOUT.optionWidthClass,
              "border-b border-r bg-background p-0",
              isPinned && "sticky z-20",
              isActiveEvaluationOption && "bg-primary/5",
              isActiveEvaluationTarget && "ring-2 ring-inset ring-primary"
            )}
            style={isPinned ? { left: getPinnedComparisonOptionLeft(pinnedIndex) } : undefined}
          >
            {onOpenEvaluation ? (
              <div
                className={cn(
                  "flex h-full flex-col gap-2 px-3 py-3",
                  isFilterMatch && "bg-primary/10"
                )}
              >
                <button
                  type="button"
                  className="space-y-2 rounded-sm text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Xem chi tiết ${row.criterion.criterionCode} · ${option.displayLabel}`}
                  onClick={() => onOpenDetail(detail)}
                >
                  {cellContent}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="matrix-evaluation-action"
                  className="mt-auto w-full"
                  aria-label={`Đánh giá ${row.criterion.criterionCode} · ${option.displayLabel}`}
                  disabled={evaluationDisabled}
                  onClick={(event) =>
                    onOpenEvaluation({
                      optionId: option.id,
                      criterionId: row.criterion.id,
                      trigger: event.currentTarget,
                    })
                  }
                >
                  <ClipboardCheck aria-hidden="true" />
                  Đánh giá
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="h-full w-full space-y-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={`Xem chi tiết ${row.criterion.criterionCode} · ${option.displayLabel}`}
                onClick={() => onOpenDetail(detail)}
              >
                {cellContent}
              </button>
            )}
          </td>
        )
      })}
    </tr>
  )
}
