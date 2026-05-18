import * as React from "react"

import { useSearchDebounce } from "@/hooks/use-debounce"
import { normalizePageSize, readPageSizeFromStorage, writePageSizeToStorage } from "@/lib/page-size-storage"

const MAINTENANCE_PLAN_PAGE_SIZE_STORAGE_KEY = "datatable:maintenance-plans:page-size"

export interface MaintenancePlanListControls {
  planSearchTerm: string
  debouncedPlanSearch: string
  handlePlanSearchChange: (value: string) => void
  handleClearSearch: () => void
  currentPage: number
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>
  pageSize: number
  handlePageSizeChange: (size: number) => void
}

export function useMaintenancePlanListControls(
  paginationResetKey?: number | null,
): MaintenancePlanListControls {
  const [planSearchTerm, setPlanSearchTerm] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(() =>
    readPageSizeFromStorage(MAINTENANCE_PLAN_PAGE_SIZE_STORAGE_KEY, 50)
  )
  const debouncedPlanSearch = useSearchDebounce(planSearchTerm)

  const previousDebouncedPlanSearch = React.useRef(debouncedPlanSearch)
  const previousPaginationResetKey = React.useRef(paginationResetKey)
  const shouldResetPage =
    debouncedPlanSearch !== previousDebouncedPlanSearch.current
    || paginationResetKey !== previousPaginationResetKey.current

  // Keep query page resets in the same render where debounced search or tenant changes.
  // This prevents one stale fetch with the new filter and the old page number.
  const effectiveCurrentPage = shouldResetPage ? 1 : currentPage

  React.useEffect(() => {
    if (!shouldResetPage) {
      return
    }

    previousDebouncedPlanSearch.current = debouncedPlanSearch
    previousPaginationResetKey.current = paginationResetKey
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [currentPage, debouncedPlanSearch, paginationResetKey, shouldResetPage])

  const handlePlanSearchChange = React.useCallback((value: string) => {
    setPlanSearchTerm(value)
    setCurrentPage(1)
  }, [])

  const handleClearSearch = React.useCallback(() => {
    setPlanSearchTerm("")
    setCurrentPage(1)
  }, [])

  const handlePageSizeChange = React.useCallback((size: number) => {
    const safeSize = normalizePageSize(size)
    setPageSize(safeSize)
    writePageSizeToStorage(MAINTENANCE_PLAN_PAGE_SIZE_STORAGE_KEY, safeSize)
    setCurrentPage(1)
  }, [])

  return {
    planSearchTerm,
    debouncedPlanSearch,
    handlePlanSearchChange,
    handleClearSearch,
    currentPage: effectiveCurrentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
  }
}
