import * as React from "react"

import { useSearchDebounce } from "@/hooks/use-debounce"

export interface MaintenancePlanListControls {
  planSearchTerm: string
  debouncedPlanSearch: string
  handlePlanSearchChange: (value: string) => void
  handleClearSearch: () => void
  selectedFacilityId: number | null
  handleFacilityChange: (facilityId: number | null) => void
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  pageSize: number
  handlePageSizeChange: (size: number) => void
  isMobileFilterSheetOpen: boolean
  handleMobileFilterSheetOpenChange: (open: boolean) => void
  pendingFacilityFilter: number | null
  setPendingFacilityFilter: React.Dispatch<React.SetStateAction<number | null>>
  handleMobileFilterApply: () => void
  handleMobileFilterClear: () => void
}

export function useMaintenancePlanListControls(): MaintenancePlanListControls {
  const [planSearchTerm, setPlanSearchTerm] = React.useState("")
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)
  const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = React.useState(false)
  const [pendingFacilityFilter, setPendingFacilityFilter] = React.useState<number | null>(null)
  const debouncedPlanSearch = useSearchDebounce(planSearchTerm)

  // Keep the query page reset in the same render where debounced search changes.
  // This prevents one stale fetch with the new search and the old page number.
  let effectiveCurrentPage = currentPage
  const previousDebouncedPlanSearch = React.useRef(debouncedPlanSearch)
  if (debouncedPlanSearch !== previousDebouncedPlanSearch.current) {
    previousDebouncedPlanSearch.current = debouncedPlanSearch
    effectiveCurrentPage = 1
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }

  const handlePlanSearchChange = React.useCallback((value: string) => {
    setPlanSearchTerm(value)
    setCurrentPage(1)
  }, [])

  const handleClearSearch = React.useCallback(() => {
    setPlanSearchTerm("")
    setCurrentPage(1)
  }, [])

  const handleFacilityChange = React.useCallback((facilityId: number | null) => {
    setSelectedFacilityId(facilityId)
    setCurrentPage(1)
  }, [])

  const handlePageSizeChange = React.useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const handleMobileFilterSheetOpenChange = React.useCallback(
    (open: boolean) => {
      setIsMobileFilterSheetOpen(open)
      if (open) {
        setPendingFacilityFilter(selectedFacilityId ?? null)
      }
    },
    [selectedFacilityId]
  )

  const handleMobileFilterApply = React.useCallback(() => {
    setSelectedFacilityId(pendingFacilityFilter ?? null)
    setCurrentPage(1)
    setIsMobileFilterSheetOpen(false)
  }, [pendingFacilityFilter])

  const handleMobileFilterClear = React.useCallback(() => {
    setPendingFacilityFilter(null)
    setSelectedFacilityId(null)
    setCurrentPage(1)
    setIsMobileFilterSheetOpen(false)
  }, [])

  return {
    planSearchTerm,
    debouncedPlanSearch,
    handlePlanSearchChange,
    handleClearSearch,
    selectedFacilityId,
    handleFacilityChange,
    currentPage: effectiveCurrentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
    isMobileFilterSheetOpen,
    handleMobileFilterSheetOpenChange,
    pendingFacilityFilter,
    setPendingFacilityFilter,
    handleMobileFilterApply,
    handleMobileFilterClear,
  }
}
