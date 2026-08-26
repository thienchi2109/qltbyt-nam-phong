"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { TechnicalConfigurationEvaluationStatusFilter } from "../../assessment-types"
import type { TechnicalConfigurationEvaluationFilterCounts } from "./technical-configuration-evaluation-progress"

const FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "not_evaluated", label: "Chưa đánh giá" },
  { value: "fails", label: "Không đạt" },
  { value: "insufficient_evidence", label: "Chưa đủ bằng chứng" },
] as const satisfies readonly {
  value: TechnicalConfigurationEvaluationStatusFilter
  label: string
}[]

type TechnicalConfigurationEvaluationFiltersProps = {
  value: TechnicalConfigurationEvaluationStatusFilter
  counts: TechnicalConfigurationEvaluationFilterCounts | null
  onValueChange: (value: TechnicalConfigurationEvaluationStatusFilter) => void
  disabled?: boolean
}

/** Renders the single selected P12B2 derived-status filter. */
export function TechnicalConfigurationEvaluationFilters({
  value,
  counts,
  onValueChange,
  disabled = false,
}: Readonly<TechnicalConfigurationEvaluationFiltersProps>) {
  const getCount = (filter: TechnicalConfigurationEvaluationStatusFilter) => counts?.[filter] ?? "-"

  return (
    <div>
      <div
        className="hidden w-fit items-center gap-1 border bg-muted/30 p-1 sm:flex"
        role="group"
        aria-label="Bộ lọc trạng thái đánh giá"
      >
        {FILTERS.map((filter) => {
          const isActive = filter.value === value
          return (
            <Button
              key={filter.value}
              type="button"
              variant={isActive ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-2 px-3"
              aria-pressed={isActive}
              aria-label={`${filter.label} ${getCount(filter.value)}`}
              disabled={disabled}
              onClick={() => onValueChange(filter.value)}
            >
              <span>{filter.label}</span>
              <span className="min-w-4 text-center text-xs tabular-nums text-muted-foreground">
                {getCount(filter.value)}
              </span>
            </Button>
          )
        })}
      </div>

      <div className="space-y-2 sm:hidden">
        <Label htmlFor="technical-configuration-evaluation-status-filter">
          Trạng thái đánh giá
        </Label>
        <Select
          value={value}
          onValueChange={(nextValue) =>
            onValueChange(nextValue as TechnicalConfigurationEvaluationStatusFilter)
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="technical-configuration-evaluation-status-filter"
            aria-label="Lọc trạng thái đánh giá"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label} {getCount(filter.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
