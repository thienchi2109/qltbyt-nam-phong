"use client"

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react"

import type { TechnicalConfigurationComparisonResult } from "@/app/(app)/technical-configurations/comparison-types"
import { Button } from "@/components/ui/button"

import type { TechnicalConfigurationCriterionDetail } from "./TechnicalConfigurationCriterionPanel"
import { TechnicalConfigurationMatrixRow } from "./TechnicalConfigurationMatrixRow"

type TechnicalConfigurationMatrixProps = {
  hasRequest: boolean
  result?: TechnicalConfigurationComparisonResult
  visibleOptionIds?: readonly string[]
  pinnedOptionIds?: readonly string[]
  focusedOptionId?: string | null
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  onRetry: () => void
  onPageChange: (page: number) => void
  onOpenDetail: (detail: TechnicalConfigurationCriterionDetail) => void
}

type ComparisonCriterionRow = TechnicalConfigurationComparisonResult["data"]["criteria"][number]

type ComparisonCriterionGroup = {
  id: string
  name: string
  rows: ComparisonCriterionRow[]
}

function groupCriterionRows(criteria: readonly ComparisonCriterionRow[]) {
  const groups: ComparisonCriterionGroup[] = []

  for (const row of criteria) {
    const currentGroup = groups[groups.length - 1]

    if (currentGroup?.id === row.group.id) {
      currentGroup.rows.push(row)
    } else {
      groups.push({ id: row.group.id, name: row.group.name, rows: [row] })
    }
  }

  return groups
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
  visibleOptionIds,
  pinnedOptionIds = [],
  focusedOptionId = null,
  isLoading = false,
  isError = false,
  error,
  onRetry,
  onPageChange,
  onOpenDetail,
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
  const criterionGroups = groupCriterionRows(criteria)
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const startItem = (result.page - 1) * result.pageSize + 1
  const endItem = Math.min(result.page * result.pageSize, result.total)

  return (
    <div className="space-y-3">
      <div
        data-testid="comparison-matrix-scroll"
        className="relative max-h-[calc(100vh-20rem)] min-h-[28rem] w-full overflow-auto rounded-md border"
      >
        <table className="min-w-max border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              <th
                data-testid="comparison-criterion-header"
                className="sticky left-0 top-0 z-50 w-[220px] min-w-[220px] max-w-[220px] border-b border-r bg-muted px-3 py-3 font-semibold"
                scope="col"
              >
                Tiêu chí
              </th>
              <th
                data-testid="comparison-baseline-header"
                className="sticky left-[220px] top-0 z-50 w-[360px] min-w-[360px] max-w-[360px] border-b border-r bg-muted px-3 py-3 font-semibold"
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
                    className={`sticky top-0 w-[320px] min-w-[320px] max-w-[320px] border-b border-r bg-muted px-3 py-3 font-semibold ${
                      isPinned ? "z-50" : "z-40"
                    }`}
                    style={isPinned ? { left: `${580 + pinnedIndex * 320}px` } : undefined}
                    scope="col"
                  >
                    <span className="block break-words">{option.displayLabel}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          {criterionGroups.map((group) => (
            <tbody key={group.id} data-testid="comparison-group-body">
              <tr>
                <th
                  className="border-b bg-muted/70 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground"
                  colSpan={renderedOptions.length + 2}
                  scope="rowgroup"
                >
                  {group.name}
                </th>
              </tr>
              {group.rows.map((row) => (
                <TechnicalConfigurationMatrixRow
                  key={row.criterion.id}
                  row={row}
                  options={renderedOptions}
                  pinnedOptionIds={renderedPinnedOptionIds}
                  valueByOptionId={
                    new Map(row.optionValues.map((value) => [value.optionId, value]))
                  }
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex min-h-10 items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground">
          Tiêu chí {startItem}-{endItem} trên {result.total} · Trang {result.page}/{totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Trang trước"
            disabled={result.page <= 1}
            onClick={() => onPageChange(result.page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Trang tiếp theo"
            disabled={result.page >= totalPages}
            onClick={() => onPageChange(result.page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
