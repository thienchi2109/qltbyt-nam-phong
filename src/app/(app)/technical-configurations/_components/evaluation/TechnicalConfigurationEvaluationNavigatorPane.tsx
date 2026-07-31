"use client"

import { Loader2 } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type {
  TechnicalConfigurationAssessmentWire,
  TechnicalConfigurationEvaluationStatusFilter,
} from "../../assessment-types"
import { TechnicalConfigurationCriterionPagination } from "../comparison/TechnicalConfigurationCriterionPagination"
import type { TechnicalConfigurationEvaluationCriterionListItem } from "./technical-configuration-evaluation-navigation"
import { TechnicalConfigurationCriterionList } from "./TechnicalConfigurationCriterionList"
import { TechnicalConfigurationEvaluationFilters } from "./TechnicalConfigurationEvaluationFilters"
import { TechnicalConfigurationEvaluationLoadError } from "./TechnicalConfigurationEvaluationLoadError"

type TechnicalConfigurationEvaluationNavigatorPaneProps = {
  statusFilter: TechnicalConfigurationEvaluationStatusFilter
  onStatusFilterChange: (value: TechnicalConfigurationEvaluationStatusFilter) => void
  criteria: readonly TechnicalConfigurationEvaluationCriterionListItem[]
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
}

/** Renders P12B2 filters, filtered list, pagination and deterministic end states. */
export function TechnicalConfigurationEvaluationNavigatorPane({
  statusFilter,
  onStatusFilterChange,
  criteria,
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
}: Readonly<TechnicalConfigurationEvaluationNavigatorPaneProps>) {
  return (
    <div className="space-y-3">
      <TechnicalConfigurationEvaluationFilters
        value={statusFilter}
        onValueChange={onStatusFilterChange}
        disabled={disabled}
      />
      {isLoading ? (
        <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Đang lọc tiêu chí...
        </div>
      ) : null}
      {isError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể lọc tiêu chí đánh giá"
          error={error}
          fallback="Không thể tải danh sách tiêu chí đã lọc."
          onRetry={onRetry}
        />
      ) : null}
      {!isLoading && !isError && total === 0 ? (
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
      {isCurrentCriterionFilteredOut ? (
        <p className="text-sm text-muted-foreground" role="status">
          Tiêu chí đang mở không còn phù hợp với bộ lọc sau khi lưu.
        </p>
      ) : null}
      {hasNoMoreMatches ? (
        <p className="text-sm text-muted-foreground" role="status">
          Không còn tiêu chí phù hợp với bộ lọc.
        </p>
      ) : null}
      {!isLoading && !isError && total > 0 ? (
        <>
          <TechnicalConfigurationCriterionList
            criteria={criteria}
            assessmentsByCriterionId={assessmentsByCriterionId}
            currentCriterionId={currentCriterionId}
            onSelectCriterion={onSelectCriterion}
            disabled={disabled}
          />
          <TechnicalConfigurationCriterionPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            disabled={disabled}
          />
        </>
      ) : null}
    </div>
  )
}
