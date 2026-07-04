"use client"

import * as React from "react"
import type {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  Updater,
} from "@tanstack/react-table"
import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { RepairRequestsProvider } from "./RepairRequestsContext"
import { RepairRequestsDeepLinkBoundary } from "./RepairRequestsDeepLinkBoundary"
import { RepairRequestsPageLayout } from "./RepairRequestsPageLayout"
import { RepairRequestsPageDialogs } from "./RepairRequestsPageDialogs"
import { RepairRequestsPageLoadingFallback } from "./RepairRequestsPageLoadingFallback"
import type { FilterModalValue } from "./RepairRequestsFilterModal"
import type { RepairRequestWithEquipment } from "../types"
import { useRepairRequestsData } from "../_hooks/useRepairRequestsData"

import { useRepairRequestShortcuts } from "../_hooks/useRepairRequestShortcuts"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import { useRepairRequestColumns } from "./RepairRequestsColumns"
import {
  createRepairRequestsPageState,
  repairRequestsPageStateReducer,
  resolveRepairRequestsPageUpdater,
} from "./RepairRequestsPageState"
import {
  getUiFilters,
  setUiFilters,
  getColumnVisibility,
  setColumnVisibility,
  type UiFilters as UiFiltersPrefs,
} from "@/lib/rr-prefs"

/**
 * Inner component that consumes the RepairRequestsContext.
 * Separated to allow useRepairRequestsContext to be called within the provider.
 */
function RepairRequestsPageClientInner() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user
  const isMobile = useIsMobile()
  const isSheetMobile = useMediaQuery("(max-width: 1279px)")
  const queryClient = useQueryClient()

  const {
    isRegionalLeader,
    openEditDialog,
    openDeleteDialog,
    openApproveDialog,
    openCompleteDialog,
    openViewDialog,
    openPrintOptionsDialog,
    openCreateSheet,
    applyAssistantDraft,
  } = useRepairRequestsContext()

  const [pageState, dispatchPageState] = React.useReducer(
    repairRequestsPageStateReducer,
    undefined,
    () =>
      createRepairRequestsPageState({
        uiFilters: getUiFilters(),
        columnVisibility: getColumnVisibility(),
      })
  )

  const { sorting, columnFilters, searchTerm, uiFilters, isFilterModalOpen, columnVisibility } =
    pageState

  const debouncedSearch = useSearchDebounce(searchTerm)

  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  const setSearchTerm = React.useCallback((value: string) => {
    dispatchPageState({ type: "set-search-term", value })
  }, [])

  const setUiFiltersState = React.useCallback((value: UiFiltersPrefs) => {
    dispatchPageState({ type: "set-ui-filters", value })
  }, [])

  const persistUiFiltersState = React.useCallback(
    (value: UiFiltersPrefs) => {
      setUiFiltersState(value)
      setUiFilters(value)
    },
    [setUiFiltersState]
  )

  const setFilterModalOpen = React.useCallback((value: boolean) => {
    dispatchPageState({ type: "set-filter-modal-open", value })
  }, [])

  const effectiveTenantKey = user?.don_vi ?? user?.current_don_vi ?? "none"

  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities: facilityOptions,
    showSelector: showFacilityFilter,
    shouldFetchData,
  } = useTenantSelection()

  const {
    requests,
    isLoading,
    isFetching,
    statusCounts,
    statusCountsLoading,
    overdueSummary,
    overdueLoading,
    totalRequests,
    repairPagination,
  } = useRepairRequestsData({
    debouncedSearch,
    uiFilters,
    selectedFacilityId: selectedFacilityId ?? null,
    effectiveTenantKey,
    userRole: user?.role,
    userDiaBanId: user?.dia_ban_id,
    shouldFetchData,
    hasUser: !!user,
  })

  const selectedFacilityName = React.useMemo(() => {
    if (selectedFacilityId === null || selectedFacilityId === undefined) return null
    const facility = facilityOptions.find((f) => f.id === selectedFacilityId)
    return facility?.name ?? null
  }, [selectedFacilityId, facilityOptions])

  const setEditingRequestAdapter = React.useCallback(
    (req: RepairRequestWithEquipment | null) => {
      if (req) openEditDialog(req)
    },
    [openEditDialog]
  )

  const setRequestToDeleteAdapter = React.useCallback(
    (req: RepairRequestWithEquipment | null) => {
      if (req) openDeleteDialog(req)
    },
    [openDeleteDialog]
  )

  const setRequestToViewAdapter = React.useCallback(
    (req: RepairRequestWithEquipment | null) => {
      if (req) openViewDialog(req)
    },
    [openViewDialog]
  )

  const columnOptions = React.useMemo(
    () => ({
      onGenerateSheet: openPrintOptionsDialog,
      setEditingRequest: setEditingRequestAdapter,
      setRequestToDelete: setRequestToDeleteAdapter,
      handleApproveRequest: openApproveDialog,
      handleCompletion: openCompleteDialog,
      setRequestToView: setRequestToViewAdapter,
      user,
      isRegionalLeader,
    }),
    [
      openPrintOptionsDialog,
      setEditingRequestAdapter,
      setRequestToDeleteAdapter,
      openApproveDialog,
      openCompleteDialog,
      setRequestToViewAdapter,
      user,
      isRegionalLeader,
    ]
  )

  const columns = useRepairRequestColumns(columnOptions)
  const tableData = requests

  const tableKey = `${selectedFacilityId ?? "all"}`

  const pageCount = repairPagination.pageCount

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedSearch,
      pagination: repairPagination.pagination,
      columnVisibility,
    },
    pageCount,
    manualPagination: true,
    onSortingChange: (updater: Updater<SortingState>) => {
      dispatchPageState({ type: "set-sorting", updater })
    },
    onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
      dispatchPageState({ type: "set-column-filters", updater })
    },
    onGlobalFilterChange: setSearchTerm,
    onPaginationChange: repairPagination.setPagination,
    onColumnVisibilityChange: (updater: Updater<VisibilityState>) => {
      const next = resolveRepairRequestsPageUpdater(updater, columnVisibility)
      dispatchPageState({ type: "set-column-visibility", updater })
      setColumnVisibility(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const isFiltered =
    table.getState().columnFilters.length > 0 ||
    debouncedSearch.length > 0 ||
    uiFilters.status.length > 0 ||
    Boolean(uiFilters.dateRange?.from || uiFilters.dateRange?.to)

  useRepairRequestShortcuts({
    searchInputRef,
    onCreate: openCreateSheet,
    isRegionalLeader,
  })

  const handleClearFilters = React.useCallback(() => {
    table.resetColumnFilters()
    persistUiFiltersState({ status: [], dateRange: null })
    setSearchTerm("")
  }, [persistUiFiltersState, table, setSearchTerm])

  const handleRemoveFilter = React.useCallback(
    (key: "status" | "facilityName" | "dateRange", sub?: string) => {
      if (key === "status" && sub) {
        const next = uiFilters.status.filter((s) => s !== sub)
        const updated = { ...uiFilters, status: next }
        persistUiFiltersState(updated)
      } else if (key === "facilityName") {
        setSelectedFacilityId(null)
      } else if (key === "dateRange") {
        const updated = { ...uiFilters, dateRange: null }
        persistUiFiltersState(updated)
      }
    },
    [persistUiFiltersState, uiFilters, setSelectedFacilityId]
  )

  const handleFilterChange = React.useCallback(
    (v: FilterModalValue) => {
      if (showFacilityFilter) setSelectedFacilityId(v.facilityId ?? null)
      const updated: UiFiltersPrefs = {
        status: v.status,
        dateRange: v.dateRange
          ? {
              from: v.dateRange.from ? format(v.dateRange.from, "yyyy-MM-dd") : null,
              to: v.dateRange.to ? format(v.dateRange.to, "yyyy-MM-dd") : null,
            }
          : null,
      }
      persistUiFiltersState(updated)
    },
    [persistUiFiltersState, showFacilityFilter, setSelectedFacilityId]
  )

  return (
    <ErrorBoundary>
      <RepairRequestsDeepLinkBoundary
        toast={toast}
        uiFilters={uiFilters}
        setUiFiltersState={setUiFiltersState}
        setUiFilters={setUiFilters}
        openCreateSheet={openCreateSheet}
        applyAssistantDraft={applyAssistantDraft}
        queryClient={queryClient}
      >
        <RepairRequestsPageDialogs />

        <RepairRequestsPageLayout
          selectedFacilityName={selectedFacilityName}
          accessState={{ isRegionalLeader, showFacilityFilter, shouldFetchData }}
          statusCounts={statusCounts}
          overdueSummary={overdueSummary}
          summaryState={{ statusCountsLoading, overdueLoading }}
          requests={requests}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchInputRef={searchInputRef}
          onClearFilters={handleClearFilters}
          onFilterModalOpenChange={setFilterModalOpen}
          uiFilters={uiFilters}
          onFilterChange={handleFilterChange}
          selectedFacilityId={selectedFacilityId ?? null}
          facilityOptions={facilityOptions.map((f) => ({ id: f.id, name: f.name }))}
          onRemoveFilter={handleRemoveFilter}
          filterState={{ isFiltered, isFilterModalOpen }}
          table={table}
          tableKey={tableKey}
          listState={{ isMobile, isCompactLayout: isSheetMobile, isLoading, isFetching }}
          totalRequests={totalRequests}
          repairPagination={repairPagination}
          columnOptions={columnOptions}
          setRequestToView={setRequestToViewAdapter}
          openCreateSheet={openCreateSheet}
        />
      </RepairRequestsDeepLinkBoundary>
    </ErrorBoundary>
  )
}

/** Renders the authenticated repair-requests feature client. */
export default function RepairRequestsPageClient() {
  const { status } = useSession()

  // The page wrapper owns unauthenticated access; keep the skeleton as a defensive fallback.
  if (status === "loading" || status === "unauthenticated") {
    return <RepairRequestsPageLoadingFallback />
  }

  return (
    <RepairRequestsProvider>
      <RepairRequestsPageClientInner />
    </RepairRequestsProvider>
  )
}
