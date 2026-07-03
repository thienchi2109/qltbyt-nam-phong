/**
 * EquipmentOverflowFiltersUtils.ts
 *
 * Shared constants and value helpers for equipment overflow filters.
 */

import type { ColumnFiltersState } from "@tanstack/react-table"
import type { LucideIcon } from "lucide-react"
import { UserRound, WalletCards } from "lucide-react"

/** Secondary equipment filters grouped behind the desktop overflow trigger. */
export const EQUIPMENT_OVERFLOW_FILTERS = [
  {
    id: "nguoi_dang_truc_tiep_quan_ly",
    title: "Người sử dụng",
    Icon: UserRound,
  },
  {
    id: "nguon_kinh_phi",
    title: "Nguồn kinh phí",
    Icon: WalletCards,
  },
] as const satisfies readonly {
  id: string
  title: string
  Icon: LucideIcon
}[]

/** Column ids owned by the equipment overflow filter group. */
export const EQUIPMENT_OVERFLOW_FILTER_IDS = new Set<string>(
  EQUIPMENT_OVERFLOW_FILTERS.map((filter) => filter.id)
)

export type EquipmentOverflowFilterId = (typeof EQUIPMENT_OVERFLOW_FILTERS)[number]["id"]

/** Converts unknown TanStack filter values into a stable string array. */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

/** Toggles one option in a multi-select filter value array. */
export function toggleSelection(currentValues: string[], optionValue: string): string[] {
  if (currentValues.includes(optionValue)) {
    return currentValues.filter((value) => value !== optionValue)
  }
  return [...currentValues, optionValue]
}

/** Counts selected values owned by the equipment overflow filter group. */
export function getEquipmentOverflowFilterCount(columnFilters: ColumnFiltersState): number {
  return columnFilters.reduce((count, filter) => {
    if (!EQUIPMENT_OVERFLOW_FILTER_IDS.has(filter.id)) return count
    return count + toStringArray(filter.value).length
  }, 0)
}
