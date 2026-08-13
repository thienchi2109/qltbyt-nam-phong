"use client"

import { Loader2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type {
  TechnicalConfigurationAssessmentWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../../assessment-types"
import { TechnicalConfigurationCriterionPagination } from "../comparison/TechnicalConfigurationCriterionPagination"
import type { TechnicalConfigurationEvaluationHierarchyRow } from "./technical-configuration-evaluation-hierarchy"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "./technical-configuration-evaluation-navigation"
import type { TechnicalConfigurationEvaluationProgress } from "./technical-configuration-evaluation-progress"
import { TechnicalConfigurationCriterionList } from "./TechnicalConfigurationCriterionList"
import { TechnicalConfigurationEvaluationFilters } from "./TechnicalConfigurationEvaluationFilters"
import { TechnicalConfigurationEvaluationLoadError } from "./TechnicalConfigurationEvaluationLoadError"

type TechnicalConfigurationEvaluationNavigatorPaneProps = {
  statusFilter: TechnicalConfigurationEvaluationStatusFilter
  onStatusFilterChange: (value: TechnicalConfigurationEvaluationStatusFilter) => void
  criteria: readonly TechnicalConfigurationEvaluationHierarchyRow<TechnicalConfigurationEvaluationCriterionListItem>[]
  progress: TechnicalConfigurationEvaluationProgress | null
  assessmentsByCriterionId: Readonly<Record<string, TechnicalConfigurationAssessmentWire>>
  currentCriterionId: string | null
  onSelectCriterion: (criterionId: string) => void
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  disabled: boolean
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  isCurrentCriterionFilteredOut: boolean
  hasNoMoreMatches: boolean
  listOnly?: boolean
  expandedRowIds?: ReadonlySet<string>
  onExpandedRowIdsChange?: (expandedRowIds: ReadonlySet<string>) => void
}

/** Renders the filtered hierarchy with optional standalone controls and status chrome. */
export function TechnicalConfigurationEvaluationNavigatorPane({
  statusFilter,
  onStatusFilterChange,
  criteria,
  progress,
  assessmentsByCriterionId,
  currentCriterionId,
  onSelectCriterion,
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
  isLoading,
  isError,
  error,
  onRetry,
  isCurrentCriterionFilteredOut,
  hasNoMoreMatches,
  listOnly = false,
  expandedRowIds,
  onExpandedRowIdsChange,
}: Readonly<TechnicalConfigurationEvaluationNavigatorPaneProps>) {
  return (
    <div className="space-y-3">
      {listOnly ? null : (
        <TechnicalConfigurationEvaluationFilters
          value={statusFilter}
          onValueChange={onStatusFilterChange}
          disabled={disabled}
        />
      )}
      {isLoading ? (
        <div
          className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {listOnly ? "Đang tải tiêu chí đánh giá..." : "Đang lọc tiêu chí..."}
        </div>
      ) : null}
      {isError ? (
        <TechnicalConfigurationEvaluationLoadError
          title={listOnly ? "Không thể tải tiêu chí đánh giá" : "Không thể lọc tiêu chí đánh giá"}
          error={error}
          fallback={
            listOnly
              ? "Không thể tải danh sách tiêu chí đánh giá."
              : "Không thể tải danh sách tiêu chí đã lọc."
          }
          onRetry={listOnly ? undefined : onRetry}
        />
      ) : null}
      {!listOnly && !isLoading && !isError && total === 0 ? (
        <Alert>
          <AlertTitle>Không có tiêu chí phù hợp</AlertTitle>
          <AlertDescription>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || statusFilter === "all"}
              onClick={() => onStatusFilterChange("all")}
            >
              Xóa bộ lọc
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!listOnly && isCurrentCriterionFilteredOut ? (
        <p className="text-sm text-muted-foreground" role="status">
          Tiêu chí đang mở không còn phù hợp với bộ lọc sau khi lưu.
        </p>
      ) : null}
      {!listOnly && hasNoMoreMatches ? (
        <p className="text-sm text-muted-foreground" role="status">
          Không còn tiêu chí phù hợp với bộ lọc.
        </p>
      ) : null}
      {!isLoading && !isError && total > 0 ? (
        <>
          <TechnicalConfigurationCriterionList
            rows={criteria}
            hierarchyProgress={progress?.hierarchy ?? null}
            assessmentsByCriterionId={assessmentsByCriterionId}
            currentCriterionId={currentCriterionId}
            onSelectCriterion={onSelectCriterion}
            disabled={disabled}
            expandedRowIds={expandedRowIds}
            onExpandedRowIdsChange={onExpandedRowIdsChange}
          />
          {listOnly ? null : (
            <TechnicalConfigurationCriterionPagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              disabled={disabled}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
