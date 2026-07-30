"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { TechnicalConfigurationEvaluationStatusFilter } from "../../assessment-types"

const FILTER_LABELS = {
  all: "Tất cả",
  not_evaluated: "Chưa đánh giá",
  fails: "Không đạt",
  insufficient_evidence: "Chưa đủ bằng chứng",
} as const satisfies Record<TechnicalConfigurationEvaluationStatusFilter, string>

type TechnicalConfigurationEvaluationFiltersProps = {
  value: TechnicalConfigurationEvaluationStatusFilter
  onValueChange: (value: TechnicalConfigurationEvaluationStatusFilter) => void
  disabled?: boolean
}

/** Renders the single selected P12B2 derived-status filter. */
export function TechnicalConfigurationEvaluationFilters({
  value,
  onValueChange,
  disabled = false,
}: Readonly<TechnicalConfigurationEvaluationFiltersProps>) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Label htmlFor="technical-configuration-evaluation-status-filter">Trạng thái đánh giá</Label>
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
          className="w-full sm:w-56"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FILTER_LABELS).map(([filter, label]) => (
            <SelectItem key={filter} value={filter}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
