"use client"

import * as React from "react"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
import { useSearchDebounce } from "@/hooks/use-debounce"

export interface UseEquipmentFiltersReturn {
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

  // Selected filter arrays (memoized)
  selectedDepartments: string[]
  selectedUsers: string[]
  selectedLocations: string[]
  selectedStatuses: string[]
  selectedClassifications: string[]
}

export function useEquipmentFilters(): UseEquipmentFiltersReturn {
  // Search state
  const [searchTerm, setSearchTerm] = React.useState("")
  const debouncedSearch = useSearchDebounce(searchTerm)

  // Sorting state
  const [sorting, setSorting] = React.useState<SortingState>([])

  // Column filters state
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

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

  return React.useMemo(
    () => ({
      searchTerm,
      setSearchTerm,
      debouncedSearch,
      sorting,
      setSorting,
      sortParam,
      columnFilters,
      setColumnFilters,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
    }),
    [
      searchTerm,
      debouncedSearch,
      sorting,
      sortParam,
      columnFilters,
      selectedDepartments,
      selectedUsers,
      selectedLocations,
      selectedStatuses,
      selectedClassifications,
    ]
  )
}
