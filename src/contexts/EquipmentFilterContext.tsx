"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
import { useSearchDebounce } from "@/hooks/use-debounce"

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
// Constants
// =============================================================================

export const EQUIPMENT_FILTER_STORAGE_KEY = "eq_filters"

// =============================================================================
// Storage helpers (SSR-safe)
// =============================================================================

interface StoredFilterState {
  searchTerm: string
  sorting: SortingState
  columnFilters: ColumnFiltersState
}

function readStoredFilters(): StoredFilterState | null {
  if (typeof window === "undefined") return null
  try {
    const stored = sessionStorage.getItem(EQUIPMENT_FILTER_STORAGE_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as StoredFilterState
    // Basic shape validation
    if (
      typeof parsed.searchTerm !== "string" ||
      !Array.isArray(parsed.sorting) ||
      !Array.isArray(parsed.columnFilters)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredFilters(state: StoredFilterState): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      EQUIPMENT_FILTER_STORAGE_KEY,
      JSON.stringify(state)
    )
  } catch {
    // Ignore storage errors (quota, etc.)
  }
}

function clearStoredFilters(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(EQUIPMENT_FILTER_STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// Context
// =============================================================================

const EquipmentFilterContext =
  React.createContext<EquipmentFilterContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

export function EquipmentFilterProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { status } = useSession()

  // Hydrate from sessionStorage on mount
  const initial = React.useMemo(() => readStoredFilters(), [])

  // Search state
  const [searchTerm, setSearchTerm] = React.useState(
    initial?.searchTerm ?? ""
  )
  const debouncedSearch = useSearchDebounce(searchTerm)

  // Sorting state
  const [sorting, setSorting] = React.useState<SortingState>(
    initial?.sorting ?? []
  )

  // Column filters state
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    initial?.columnFilters ?? []
  )

  // Persist to sessionStorage on change
  React.useEffect(() => {
    writeStoredFilters({ searchTerm, sorting, columnFilters })
  }, [searchTerm, sorting, columnFilters])

  // Clear sessionStorage on logout
  React.useEffect(() => {
    if (status === "unauthenticated") {
      clearStoredFilters()
    }
  }, [status])

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
      return (entry?.value as string[] | undefined) || []
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
    setColumnFilters([])
    setSearchTerm("")
    setSorting([])
    clearStoredFilters()
  }, [])

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
      sorting,
      sortParam,
      columnFilters,
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
