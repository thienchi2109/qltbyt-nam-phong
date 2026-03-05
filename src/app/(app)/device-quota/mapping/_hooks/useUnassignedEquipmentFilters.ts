"use client"

import * as React from "react"
import { useDebounce } from "@/hooks/use-debounce"

/**
 * Standalone filter + search + debounce hook for unassigned equipment.
 * Manages search term, debounced value, and four faceted filter arrays.
 * Not coupled to TanStack Table — uses plain React state.
 */

interface UseUnassignedEquipmentFiltersReturn {
  // Search
  searchTerm: string
  setSearchTerm: (v: string) => void
  debouncedSearch: string

  // Filter arrays
  selectedDepartments: string[]
  setSelectedDepartments: (v: string[]) => void
  selectedUsers: string[]
  setSelectedUsers: (v: string[]) => void
  selectedLocations: string[]
  setSelectedLocations: (v: string[]) => void
  selectedFundingSources: string[]
  setSelectedFundingSources: (v: string[]) => void

  // Computed
  activeFilterCount: number
  hasActiveFilters: boolean

  // Reset
  resetAllFilters: () => void
}

export function useUnassignedEquipmentFilters(): UseUnassignedEquipmentFiltersReturn {
  const [searchTerm, setSearchTerm] = React.useState("")
  const debouncedSearch = useDebounce(searchTerm, 300)

  const [selectedDepartments, setSelectedDepartments] = React.useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = React.useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = React.useState<string[]>([])
  const [selectedFundingSources, setSelectedFundingSources] = React.useState<string[]>([])

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (selectedDepartments.length > 0) count++
    if (selectedUsers.length > 0) count++
    if (selectedLocations.length > 0) count++
    if (selectedFundingSources.length > 0) count++
    return count
  }, [selectedDepartments, selectedUsers, selectedLocations, selectedFundingSources])

  const hasActiveFilters = activeFilterCount > 0

  const resetAllFilters = React.useCallback(() => {
    setSearchTerm("")
    setSelectedDepartments([])
    setSelectedUsers([])
    setSelectedLocations([])
    setSelectedFundingSources([])
  }, [])

  return {
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    selectedDepartments,
    setSelectedDepartments,
    selectedUsers,
    setSelectedUsers,
    selectedLocations,
    setSelectedLocations,
    selectedFundingSources,
    setSelectedFundingSources,
    activeFilterCount,
    hasActiveFilters,
    resetAllFilters,
  }
}
