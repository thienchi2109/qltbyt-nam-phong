import * as React from "react"

export function useMaintenancePlanListControls() {
  const [planSearchTerm, setPlanSearchTerm] = React.useState("")
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)
  const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = React.useState(false)
  const [pendingFacilityFilter, setPendingFacilityFilter] = React.useState<number | null>(null)

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
    handlePlanSearchChange,
    handleClearSearch,
    selectedFacilityId,
    handleFacilityChange,
    currentPage,
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
