"use client"

import * as React from "react"
import type { ColumnFiltersState } from "@tanstack/react-table"

import type { FilterBottomSheetData } from "../types"
import { getEquipmentSelectedFilters, useEquipmentFilterBuckets } from "./useEquipmentFilterBuckets"

interface UseEquipmentFilterSheetCascadeParams {
  shouldFetchData: boolean
  committedColumnFilters: ColumnFiltersState
  committedFilterData: FilterBottomSheetData
  effectiveTenantKey: string
  userRole: string
  userDiaBanId?: number | null
  effectiveSelectedDonVi: number | null
  debouncedSearch: string
  onApply: (next: ColumnFiltersState) => void
  onClearAll: () => void
}

export interface UseEquipmentFilterSheetCascadeReturn {
  filterData: FilterBottomSheetData
  isFilterSheetOpen: boolean
  setIsFilterSheetOpen: React.Dispatch<React.SetStateAction<boolean>>
  onDraftFiltersChange: (next: ColumnFiltersState) => void
  onApply: (next: ColumnFiltersState) => void
  onClearAll: () => void
}

/** Coordinates mobile filter-sheet draft state with the shared cascaded bucket query. */
export function useEquipmentFilterSheetCascade({
  shouldFetchData,
  committedColumnFilters,
  committedFilterData,
  effectiveTenantKey,
  userRole,
  userDiaBanId,
  effectiveSelectedDonVi,
  debouncedSearch,
  onApply,
  onClearAll,
}: UseEquipmentFilterSheetCascadeParams): UseEquipmentFilterSheetCascadeReturn {
  const [isFilterSheetOpen, setFilterSheetOpen] = React.useState(false)
  const [draftColumnFilters, setDraftColumnFilters] = React.useState<ColumnFiltersState | null>(
    null
  )

  const sheetColumnFilters = draftColumnFilters ?? committedColumnFilters
  const sheetSelectedFilters = React.useMemo(
    () => getEquipmentSelectedFilters(sheetColumnFilters),
    [sheetColumnFilters]
  )

  const sheetBuckets = useEquipmentFilterBuckets({
    shouldFetchData: shouldFetchData && isFilterSheetOpen,
    effectiveTenantKey,
    userRole,
    userDiaBanId,
    effectiveSelectedDonVi,
    debouncedSearch,
    ...sheetSelectedFilters,
  })

  const setIsFilterSheetOpen = React.useCallback<React.Dispatch<React.SetStateAction<boolean>>>(
    (value) => {
      setFilterSheetOpen((current) => {
        const nextOpen = typeof value === "function" ? value(current) : value
        setDraftColumnFilters(nextOpen ? committedColumnFilters : null)
        return nextOpen
      })
    },
    [committedColumnFilters]
  )

  const handleDraftFiltersChange = React.useCallback((next: ColumnFiltersState) => {
    setDraftColumnFilters(next)
  }, [])

  const handleApply = React.useCallback(
    (next: ColumnFiltersState) => {
      setDraftColumnFilters(null)
      onApply(next)
    },
    [onApply]
  )

  const handleClearAll = React.useCallback(() => {
    setDraftColumnFilters(null)
    onClearAll()
  }, [onClearAll])

  return React.useMemo(
    () => ({
      filterData: isFilterSheetOpen ? sheetBuckets.filterData : committedFilterData,
      isFilterSheetOpen,
      setIsFilterSheetOpen,
      onDraftFiltersChange: handleDraftFiltersChange,
      onApply: handleApply,
      onClearAll: handleClearAll,
    }),
    [
      isFilterSheetOpen,
      sheetBuckets.filterData,
      committedFilterData,
      setIsFilterSheetOpen,
      handleDraftFiltersChange,
      handleApply,
      handleClearAll,
    ]
  )
}
