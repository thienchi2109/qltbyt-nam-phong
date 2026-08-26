"use client"

import type { ReactNode } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { TechnicalConfigurationEvaluationStatusFilter } from "../../assessment-types"
import type { TechnicalConfigurationOptionWire } from "../../supplier-option-types"
import {
  buildTechnicalConfigurationEvaluationFilterCounts,
  type TechnicalConfigurationEvaluationProgress,
} from "./technical-configuration-evaluation-progress"
import { TechnicalConfigurationEvaluationFilters } from "./TechnicalConfigurationEvaluationFilters"
import { TechnicalConfigurationEvaluationLoadError } from "./TechnicalConfigurationEvaluationLoadError"

type TechnicalConfigurationEvaluationMatrixControlsProps = {
  options: readonly TechnicalConfigurationOptionWire[]
  activeOptionId: string
  onOptionChange: (optionId: string) => void
  statusFilter: TechnicalConfigurationEvaluationStatusFilter
  onStatusFilterChange: (filter: TechnicalConfigurationEvaluationStatusFilter) => void
  disabled: boolean
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  progress: TechnicalConfigurationEvaluationProgress | null
  navigatorControl: ReactNode
  totalMatches: number
  isCurrentCriterionFilteredOut: boolean
  hasNoMoreMatches: boolean
}

/** Keeps supplier targeting and save-next filtering visible above the unified matrix. */
// react-doctor-disable-next-line react-doctor/no-many-boolean-props -- Query, navigation, and projection flags are independent states owned by separate hooks.
export function TechnicalConfigurationEvaluationMatrixControls({
  options,
  activeOptionId,
  onOptionChange,
  statusFilter,
  onStatusFilterChange,
  disabled,
  isLoading,
  isError,
  error,
  onRetry,
  progress,
  navigatorControl,
  totalMatches,
  isCurrentCriterionFilteredOut,
  hasNoMoreMatches,
}: Readonly<TechnicalConfigurationEvaluationMatrixControlsProps>) {
  return (
    <section className="space-y-3" aria-label="Điều khiển luồng đánh giá">
      <div className="grid gap-4 border-y py-3 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.2fr)_auto] lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="technical-configuration-evaluation-option">Phương án đánh giá</Label>
          <Select value={activeOptionId} onValueChange={onOptionChange} disabled={disabled}>
            <SelectTrigger
              id="technical-configuration-evaluation-option"
              aria-label="Phương án đánh giá"
              className="w-full"
            >
              <SelectValue placeholder="Chọn phương án" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.display_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TechnicalConfigurationEvaluationFilters
          value={statusFilter}
          counts={progress ? buildTechnicalConfigurationEvaluationFilterCounts(progress) : null}
          onValueChange={onStatusFilterChange}
          disabled={disabled}
        />
        <div className="flex lg:justify-end">{navigatorControl}</div>
      </div>

      {isLoading ? (
        <div
          className="grid min-h-12 gap-2 sm:grid-cols-2"
          data-testid="evaluation-flow-skeleton"
          role="status"
        >
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <span className="sr-only">Đang cập nhật luồng đánh giá...</span>
        </div>
      ) : null}
      {isError ? (
        <TechnicalConfigurationEvaluationLoadError
          title="Không thể tải luồng đánh giá"
          error={error}
          fallback="Không thể tải danh sách tiêu chí theo trạng thái."
          onRetry={onRetry}
        />
      ) : null}
      {!isLoading && !isError && totalMatches === 0 ? (
        <Alert>
          <AlertTitle>Không có tiêu chí phù hợp</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {statusFilter === "all"
                ? "Phiên bản cấu hình này chưa có tiêu chí để đánh giá."
                : "Không có tiêu chí nào khớp bộ lọc đang chọn."}
            </p>
            {statusFilter !== "all" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onStatusFilterChange("all")}
              >
                Xóa bộ lọc
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {isCurrentCriterionFilteredOut ? (
        <p className="text-sm text-muted-foreground" role="status">
          Tiêu chí đang mở không còn thuộc luồng đánh giá hiện tại.
        </p>
      ) : null}
      {hasNoMoreMatches ? (
        <p className="text-sm text-muted-foreground" role="status">
          Không còn tiêu chí phù hợp với luồng đánh giá.
        </p>
      ) : null}
    </section>
  )
}
