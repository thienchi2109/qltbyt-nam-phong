"use client"

import * as React from "react"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import {
  buildEquipmentFilterStorageKey,
  EMPTY_STORED_FILTERS,
  getStoredFilters,
  persistStoredFilters,
  resolveStateAction,
  type ProviderFilterState,
  type StoredFilterState,
} from "@/contexts/EquipmentFilterStorage"

export {
  clearAllEquipmentFilters,
  EQUIPMENT_FILTER_STORAGE_KEY_PREFIX,
} from "@/contexts/EquipmentFilterStorage"

// =============================================================================
// Types
// =============================================================================

export interface EquipmentFilterContextValue {
  // Search
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  debouncedSearch: string

  // Sorting
  sorting: SortingState
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>
  sortParam: string

  // Column filters
  columnFilters: ColumnFiltersState
  setColumnFilters: React.Dispatch<React.SetStateAction<ColumnFiltersState>>

  // Reset all filters (for tenant change)
  resetFilters: () => void

  // Selected filter arrays (memoized)
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
  selectedFundingSources: string[]
}

// =============================================================================
// Context
// =============================================================================

const EquipmentFilterContext =
  React.createContext<EquipmentFilterContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

/** Provides tenant-scoped equipment filter state and sessionStorage persistence. */
export function EquipmentFilterProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { selectedFacilityId } = useTenantSelection()

  // Build tenant-scoped storage key
  const storageKey = React.useMemo(
    () => buildEquipmentFilterStorageKey(selectedFacilityId),
    [selectedFacilityId]
  )

  const [filterState, setFilterState] = React.useState<ProviderFilterState>(() => ({
    storageKey,
    ...getStoredFilters(storageKey),
  }))

  if (filterState.storageKey !== storageKey) {
    setFilterState({
      storageKey,
      ...getStoredFilters(storageKey),
    })
  }

  const updateStoredFilterState = React.useCallback(
    (updater: (current: StoredFilterState) => StoredFilterState) => {
      setFilterState((current) => {
        const base =
          current.storageKey === storageKey
            ? current
            : { storageKey, ...getStoredFilters(storageKey) }
        const next = updater({
          searchTerm: base.searchTerm,
          sorting: base.sorting,
          columnFilters: base.columnFilters,
        })
        persistStoredFilters(base.storageKey, next)
        return { storageKey: base.storageKey, ...next }
      })
    },
    [storageKey]
  )

  const setSearchTerm = React.useCallback<React.Dispatch<React.SetStateAction<string>>>(
    (action) => {
      updateStoredFilterState((current) => ({
        ...current,
        searchTerm: resolveStateAction(action, current.searchTerm),
      }))
    },
    [updateStoredFilterState]
  )

  const setSorting = React.useCallback<React.Dispatch<React.SetStateAction<SortingState>>>(
    (action) => {
      updateStoredFilterState((current) => ({
        ...current,
        sorting: resolveStateAction(action, current.sorting),
      }))
    },
    [updateStoredFilterState]
  )

  const setColumnFilters = React.useCallback<React.Dispatch<React.SetStateAction<ColumnFiltersState>>>(
    (action) => {
      updateStoredFilterState((current) => ({
        ...current,
        columnFilters: resolveStateAction(action, current.columnFilters),
      }))
    },
    [updateStoredFilterState]
  )

  const { searchTerm, sorting, columnFilters } = filterState
  const debouncedSearch = useSearchDebounce(searchTerm)

  // Memoized sort parameter for queries
  const sortParam = React.useMemo(() => {
    if (!sorting || sorting.length === 0) return "id.asc"
    const s = sorting[0]
    return `${s.id}.${s.desc ? "desc" : "asc"}`
  }, [sorting])

  // Memoized filter array extractor
  const getArrayFilter = React.useCallback(
    (id: string): string[] => {
      const entry = (columnFilters || []).find((f) => f.id === id)
      if (!Array.isArray(entry?.value)) return []
      return entry.value.filter((value): value is string => typeof value === "string")
    },
    [columnFilters]
  )

  // Memoized selected filter arrays (prevents query key instability)
  const selectedDepartments = React.useMemo(
    () => getArrayFilter("khoa_phong_quan_ly"),
    [getArrayFilter]
  )
  const selectedUsers = React.useMemo(
    () => getArrayFilter("nguoi_dang_truc_tiep_quan_ly"),
    [getArrayFilter]
  )
  const selectedLocations = React.useMemo(
    () => getArrayFilter("vi_tri_lap_dat"),
    [getArrayFilter]
  )
  const selectedStatuses = React.useMemo(
    () => getArrayFilter("tinh_trang_hien_tai"),
    [getArrayFilter]
  )
  const selectedClassifications = React.useMemo(
    () => getArrayFilter("phan_loai_theo_nd98"),
    [getArrayFilter]
  )
  const selectedFundingSources = React.useMemo(
    () => getArrayFilter("nguon_kinh_phi"),
    [getArrayFilter]
  )

  // Reset all filters + clear storage
  const resetFilters = React.useCallback(() => {
    persistStoredFilters(storageKey, EMPTY_STORED_FILTERS)
    setFilterState({ storageKey, ...EMPTY_STORED_FILTERS })
  }, [storageKey])

  // Memoized context value (rerender-memo best practice)
  const value = React.useMemo<EquipmentFilterContextValue>(
    () => ({
      searchTerm,
      setSearchTerm,
      debouncedSearch,
      sorting,
      setSorting,
      sortParam,
      columnFilters,
      setColumnFilters,
      resetFilters,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
      selectedFundingSources,
    }),
    [
      searchTerm,
      debouncedSearch,
      setSearchTerm,
      sorting,
      setSorting,
      sortParam,
      columnFilters,
      setColumnFilters,
      resetFilters,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
      selectedFundingSources,
    ]
  )

  return (
    <EquipmentFilterContext.Provider value={value}>
      {children}
    </EquipmentFilterContext.Provider>
  )
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access the equipment filter context.
 * Must be used within an EquipmentFilterProvider.
 */
export function useEquipmentFilterContext(): EquipmentFilterContextValue {
  const context = React.useContext(EquipmentFilterContext)
  if (!context) {
    throw new Error(
      "useEquipmentFilterContext must be used within EquipmentFilterProvider"
    )
  }
  return context
}
