"use client"

import * as React from "react"

import { useTransferSearch } from "@/hooks/useTransferSearch"
import type { TransferStatus, TransferType } from "@/types/transfers-data-grid"

export type TransferDateRange = {
  from: Date | null
  to: Date | null
} | null

export type FilterChipKey = "statuses" | "dateRange" | "searchText"

export interface UseTransfersFiltersOptions {
  activeTab: TransferType
}

export interface UseTransfersFiltersResult {
  searchTerm: string
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>
  debouncedSearch: string
  clearSearch: () => void
  statusFilter: TransferStatus[]
  setStatusFilter: React.Dispatch<React.SetStateAction<TransferStatus[]>>
  dateRange: TransferDateRange
  setDateRange: React.Dispatch<React.SetStateAction<TransferDateRange>>
  isFilterModalOpen: boolean
  setIsFilterModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  handleClearAllFilters: () => void
  handleRemoveFilter: (key: FilterChipKey, subkey?: string) => void
  activeFilterCount: number
}

export function useTransfersFilters({
  activeTab,
}: UseTransfersFiltersOptions): UseTransfersFiltersResult {
  const { searchTerm, setSearchTerm, debouncedSearch, clearSearch } = useTransferSearch()
  const [statusFilter, setStatusFilter] = React.useState<TransferStatus[]>([])
  const [dateRange, setDateRange] = React.useState<TransferDateRange>(null)
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false)

  React.useEffect(() => {
    setStatusFilter([])
  }, [activeTab])

  const handleClearAllFilters = React.useCallback(() => {
    setStatusFilter([])
    setDateRange(null)
    clearSearch()
  }, [clearSearch])

  const handleRemoveFilter = React.useCallback(
    (key: FilterChipKey, subkey?: string) => {
      if (key === "statuses" && subkey) {
        setStatusFilter((prev) => prev.filter((status) => status !== subkey))
        return
      }

      if (key === "dateRange") {
        setDateRange(null)
        return
      }

      if (key === "searchText") {
        clearSearch()
      }
    },
    [clearSearch],
  )

  const activeFilterCount = React.useMemo(() => {
    let count = 0

    if (statusFilter.length > 0) count++
    if (dateRange?.from || dateRange?.to) count++

    return count
  }, [dateRange, statusFilter.length])

  return React.useMemo(
    () => ({
      searchTerm,
      setSearchTerm,
      debouncedSearch,
      clearSearch,
      statusFilter,
      setStatusFilter,
      dateRange,
      setDateRange,
      isFilterModalOpen,
      setIsFilterModalOpen,
      handleClearAllFilters,
      handleRemoveFilter,
      activeFilterCount,
    }),
    [
      activeFilterCount,
      clearSearch,
      dateRange,
      debouncedSearch,
      handleClearAllFilters,
      handleRemoveFilter,
      isFilterModalOpen,
      searchTerm,
      setSearchTerm,
      setDateRange,
      setIsFilterModalOpen,
      setStatusFilter,
      statusFilter,
    ],
  )
}
