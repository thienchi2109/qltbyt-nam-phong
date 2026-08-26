"use client"

import { ChevronLeft, RefreshCw } from "lucide-react"

import {
  COMPARISON_MATRIX_LAYOUT,
  getPinnedComparisonOptionLeft,
} from "@/app/(app)/technical-configurations/comparison-matrix-constants"
import type { TechnicalConfigurationBaselineGroupWire } from "@/app/(app)/technical-configurations/baseline-types"
import type { TechnicalConfigurationComparisonResult } from "@/app/(app)/technical-configurations/comparison-types"
import {
  buildTechnicalConfigurationComparisonHierarchyRows,
  type TechnicalConfigurationComparisonHierarchyRow,
} from "@/app/(app)/technical-configurations/technical-configuration-comparison-hierarchy"
import { Button } from "@/components/ui/button"
import type { TechnicalConfigurationDerivedStatus } from "@/lib/technical-configuration-evaluation"

import type { TechnicalConfigurationCriterionDetail } from "./TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationCriterionPagination } from "./TechnicalConfigurationCriterionPagination"
import { TechnicalConfigurationMatrixHeadingRow } from "./TechnicalConfigurationMatrixHeadingRow"
import {
  TechnicalConfigurationMatrixRow,
  type TechnicalConfigurationMatrixEvaluationTarget,
} from "./TechnicalConfigurationMatrixRow"

type TechnicalConfigurationMatrixProps = {
  hasRequest: boolean
  result?: TechnicalConfigurationComparisonResult
  baselineGroups?: readonly TechnicalConfigurationBaselineGroupWire[]
  visibleOptionIds?: readonly string[]
  pinnedOptionIds?: readonly string[]
  focusedOptionId?: string | null
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRetry: () => void
  onPageChange: (page: number) => void
  onOpenDetail: (detail: TechnicalConfigurationCriterionDetail) => void
  activeEvaluationOptionId?: string | null
  activeEvaluationCriterionId?: string | null
  assessmentStatusByCriterionId?: ReadonlyMap<string, TechnicalConfigurationDerivedStatus>
  matchingEvaluationCriterionIds?: ReadonlySet<string>
  evaluationDisabled?: boolean
  onOpenEvaluation?: (target: TechnicalConfigurationMatrixEvaluationTarget) => void
  viewportHeightClassName?: string
}

function MatrixState({ children, role }: { children: React.ReactNode; role?: "alert" | "status" }) {
  return (
    <div
      className="flex min-h-72 items-center justify-center border-y px-6 py-12 text-center text-sm text-muted-foreground"
      role={role}
    >
      {children}
    </div>
  )
}

/** Renders the bounded read-only comparison page with frozen desktop columns. */
export function TechnicalConfigurationMatrix({
  hasRequest,
  result,
  baselineGroups,
  visibleOptionIds,
  pinnedOptionIds = [],
  focusedOptionId = null,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  onPageChange,
  onOpenDetail,
  activeEvaluationOptionId = null,
  activeEvaluationCriterionId = null,
  assessmentStatusByCriterionId,
  matchingEvaluationCriterionIds,
  evaluationDisabled = false,
  onOpenEvaluation,
  viewportHeightClassName = "max-h-[calc(100vh-20rem)]",
}: Readonly<TechnicalConfigurationMatrixProps>) {
  if (!hasRequest) {
    return (
      <MatrixState>Chọn phiên bản cơ sở và ít nhất một phương án để bắt đầu so sánh.</MatrixState>
    )
  }

  if (isLoading) {
    return <MatrixState role="status">Đang tải ma trận so sánh...</MatrixState>
  }

  if (isError) {
    return (
      <MatrixState role="alert">
        <div className="space-y-3">
          <p>{error?.message || "Không thể tải ma trận so sánh."}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Thử lại
          </Button>
        </div>
      </MatrixState>
    )
  }

  if (!result) {
    return <MatrixState>Trang này chưa có tiêu chí để so sánh.</MatrixState>
  }

  if (result.data.criteria.length === 0) {
    return (
      <MatrixState>
        <div className="space-y-3">
          <p>Trang này chưa có tiêu chí để so sánh.</p>
          {result.page > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={evaluationDisabled}
              onClick={() => onPageChange(result.page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
              Trang trước
            </Button>
          ) : null}
        </div>
      </MatrixState>
    )
  }

  const { criteria, options } = result.data
  const effectiveVisibleOptionIds =
    focusedOptionId === null
      ? (visibleOptionIds ?? options.map((option) => option.id))
      : [focusedOptionId]
  const visibleOptionIdSet = new Set(effectiveVisibleOptionIds)
  const pinnedOptionIdSet = new Set(focusedOptionId === null ? pinnedOptionIds : [])
  const renderedOptions = [
    ...options.filter(
      (option) => visibleOptionIdSet.has(option.id) && pinnedOptionIdSet.has(option.id)
    ),
    ...options.filter(
      (option) => visibleOptionIdSet.has(option.id) && !pinnedOptionIdSet.has(option.id)
    ),
  ]
  const renderedPinnedOptionIds: string[] = []
  for (const option of renderedOptions) {
    if (pinnedOptionIdSet.has(option.id)) {
      renderedPinnedOptionIds.push(option.id)
    }
  }
  const hierarchyRows = buildTechnicalConfigurationComparisonHierarchyRows(baselineGroups, criteria)
  const sectionBodies: TechnicalConfigurationComparisonHierarchyRow[][] = []
  for (const row of hierarchyRows) {
    if (row.kind === "section") {
      sectionBodies.push([row])
    } else {
      sectionBodies[sectionBodies.length - 1]?.push(row)
    }
  }
  return (
    <div className="space-y-3">
      <div
        data-testid="comparison-matrix-scroll"
        className={`relative min-h-[28rem] w-full overflow-auto rounded-md border ${viewportHeightClassName}`}
      >
        <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th
                data-testid="comparison-criterion-header"
                className={`sticky left-0 top-0 z-50 ${COMPARISON_MATRIX_LAYOUT.criterionWidthClass} border-b border-r bg-muted px-3 py-3 font-semibold`}
                scope="col"
              >
                Tiêu chí
              </th>
              <th
                data-testid="comparison-baseline-header"
                className={`sticky ${COMPARISON_MATRIX_LAYOUT.baselineStickyLeftClass} top-0 z-50 ${COMPARISON_MATRIX_LAYOUT.baselineWidthClass} border-b border-r bg-muted px-3 py-3 font-semibold`}
                scope="col"
              >
                Yêu cầu cơ sở
              </th>
              {renderedOptions.map((option) => {
                const pinnedIndex = renderedPinnedOptionIds.indexOf(option.id)
                const isPinned = pinnedIndex >= 0
                return (
                  <th
                    key={option.id}
                    data-testid="comparison-option-header"
                    data-option-id={option.id}
                    data-pinned={isPinned ? "true" : "false"}
                    className={`sticky top-0 ${COMPARISON_MATRIX_LAYOUT.optionWidthClass} border-b border-r bg-muted px-3 py-3 font-semibold ${
                      isPinned ? "z-50" : "z-40"
                    }`}
                    style={
                      isPinned ? { left: getPinnedComparisonOptionLeft(pinnedIndex) } : undefined
                    }
                    scope="col"
                  >
                    <span className="block break-words">{option.displayLabel}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          {sectionBodies.map((sectionRows) => (
            <tbody
              key={sectionRows[0]?.kind === "section" ? sectionRows[0].id : "comparison-section"}
              data-testid="comparison-group-body"
            >
              {sectionRows.map((row) =>
                row.kind === "criterion" ? (
                  <TechnicalConfigurationMatrixRow
                    key={row.row.criterion.id}
                    row={row.row}
                    options={renderedOptions}
                    baselineVersionId={result.data.baselineVersion.id}
                    pinnedOptionIds={renderedPinnedOptionIds}
                    valueByOptionId={
                      new Map(row.row.optionValues.map((value) => [value.optionId, value]))
                    }
                    onOpenDetail={onOpenDetail}
                    activeEvaluationOptionId={activeEvaluationOptionId}
                    activeEvaluationCriterionId={activeEvaluationCriterionId}
                    assessmentStatusByCriterionId={assessmentStatusByCriterionId}
                    matchingEvaluationCriterionIds={matchingEvaluationCriterionIds}
                    evaluationDisabled={evaluationDisabled}
                    onOpenEvaluation={onOpenEvaluation}
                  />
                ) : (
                  <TechnicalConfigurationMatrixHeadingRow
                    key={`${row.kind}-${row.id}`}
                    row={row}
                    columnCount={renderedOptions.length + 2}
                  />
                )
              )}
            </tbody>
          ))}
        </table>
      </div>

      <TechnicalConfigurationCriterionPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        onPageChange={onPageChange}
        disabled={evaluationDisabled}
      />
    </div>
  )
}
