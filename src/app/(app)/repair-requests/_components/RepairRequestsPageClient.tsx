"use client"

import * as React from "react"
import type { ColumnFiltersState, SortingState, VisibilityState, Updater } from "@tanstack/react-table"
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
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { usePathname, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSearchParams } from "next/navigation"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { RepairRequestsDetailView } from "./RepairRequestsDetailView"
import { RepairRequestsEditDialog } from "./RepairRequestsEditDialog"
import { RepairRequestsDeleteDialog } from "./RepairRequestsDeleteDialog"
import { RepairRequestsApproveDialog } from "./RepairRequestsApproveDialog"
import { RepairRequestsCompleteDialog } from "./RepairRequestsCompleteDialog"
import { RepairRequestsProvider } from "./RepairRequestsContext"
import { RepairRequestsPageLayout } from "./RepairRequestsPageLayout"
import type { FilterModalValue } from "./RepairRequestsFilterModal"
import type { RepairRequestWithEquipment } from "../types"
import { useRepairRequestsData } from "../_hooks/useRepairRequestsData"
import { useRepairRequestsDeepLink } from "../_hooks/useRepairRequestsDeepLink"

import { useRepairRequestShortcuts } from "../_hooks/useRepairRequestShortcuts"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import { useRepairRequestUIHandlers } from "../_hooks/useRepairRequestUIHandlers"
import { useRepairRequestColumns } from "./RepairRequestsColumns"
import {
  getUiFilters,
  setUiFilters,
  getColumnVisibility,
  setColumnVisibility,
  type UiFilters as UiFiltersPrefs,
  type ColumnVisibility as ColumnVisibilityPrefs,
} from "@/lib/rr-prefs"

/**
 * Inner component that consumes the RepairRequestsContext.
 * Separated to allow useRepairRequestsContext to be called within the provider.
 */
function RepairRequestsPageClientInner() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const { data: branding } = useTenantBranding()
  const user = session?.user
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isSheetMobile = useMediaQuery("(max-width: 1279px)")
  const queryClient = useQueryClient()

  // Context values
  const {
    isRegionalLeader,
    dialogState,
    openEditDialog,
    openDeleteDialog,
    openApproveDialog,
    openCompleteDialog,
    openViewDialog,
    openCreateSheet,
    closeAllDialogs,
    applyAssistantDraft,
  } = useRepairRequestsContext()

  const searchParams = useSearchParams()

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "ngay_yeu_cau", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useSearchDebounce(searchTerm);

  // UI filters (status/date) persisted
  const [uiFilters, setUiFiltersState] = React.useState<UiFiltersPrefs>(() => getUiFilters());
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false);

  // Table presentation preferences
  const [columnVisibility, setColumnVisibilityState] = React.useState<ColumnVisibilityPrefs>(() => getColumnVisibility() || {});

  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  // UI handlers (sheet generation, etc.)
  const { handleGenerateRequestSheet } = useRepairRequestUIHandlers({
    branding,
    toast,
  })

  // Regional leader facility filtering via TenantSelectionContext
  const effectiveTenantKey = user?.don_vi ?? user?.current_don_vi ?? 'none';

  // Get facility selection from shared context
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities: facilityOptions,
    showSelector: showFacilityFilter,
    shouldFetchData,
  } = useTenantSelection()

  // Data fetching (list query, status counts, pagination)
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
    if (selectedFacilityId === null || selectedFacilityId === undefined) return null;
    const facility = facilityOptions.find(f => f.id === selectedFacilityId);
    return facility?.name ?? null;
  }, [selectedFacilityId, facilityOptions]);

  // Deep-link handling (equipment fetch, URL params, action=create)
  useRepairRequestsDeepLink({
    searchParams,
    router,
    pathname,
    toast,
    uiFilters,
    setUiFiltersState,
    setUiFilters,
    openCreateSheet,
    applyAssistantDraft,
    queryClient,
  })

  // Adapter functions to bridge context (non-null) with column options (nullable)
  const setEditingRequestAdapter = React.useCallback((req: RepairRequestWithEquipment | null) => {
    if (req) openEditDialog(req)
  }, [openEditDialog])

  const setRequestToDeleteAdapter = React.useCallback((req: RepairRequestWithEquipment | null) => {
    if (req) openDeleteDialog(req)
  }, [openDeleteDialog])

  const setRequestToViewAdapter = React.useCallback((req: RepairRequestWithEquipment | null) => {
    if (req) openViewDialog(req)
  }, [openViewDialog])

  // Table columns
  const columnOptions = React.useMemo(() => ({
    onGenerateSheet: handleGenerateRequestSheet,
    setEditingRequest: setEditingRequestAdapter,
    setRequestToDelete: setRequestToDeleteAdapter,
    handleApproveRequest: openApproveDialog,
    handleCompletion: openCompleteDialog,
    setRequestToView: setRequestToViewAdapter,
    user,
    isRegionalLeader
  }), [
    handleGenerateRequestSheet,
    setEditingRequestAdapter,
    setRequestToDeleteAdapter,
    openApproveDialog,
    openCompleteDialog,
    setRequestToViewAdapter,
    user,
    isRegionalLeader
  ])

  const columns = useRepairRequestColumns(columnOptions)
  const tableData = requests;

  // Keep the table subtree stable across pagination/filter result-size changes.
  const tableKey = React.useMemo(() => {
    return `${selectedFacilityId ?? 'all'}`;
  }, [selectedFacilityId]);

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
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater: Updater<ColumnFiltersState>) => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater
      setColumnFilters(next)
    },
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    onPaginationChange: repairPagination.setPagination,
    onColumnVisibilityChange: (updater: Updater<VisibilityState>) => {
      const next = typeof updater === 'function' ? updater(columnVisibility) : updater
      setColumnVisibilityState(next)
      setColumnVisibility(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const isFiltered = table.getState().columnFilters.length > 0 || debouncedSearch.length > 0 || (uiFilters.dateRange?.from || uiFilters.dateRange?.to);

  // Keyboard shortcuts: '/', 'n'
  useRepairRequestShortcuts({
    searchInputRef,
    onCreate: openCreateSheet,
    isRegionalLeader
  })



  // Toolbar handlers
  const handleClearFilters = React.useCallback(() => {
    table.resetColumnFilters();
    setUiFiltersState({ status: [], dateRange: null });
    setUiFilters({ status: [], dateRange: null });
    if (showFacilityFilter) setSelectedFacilityId(null);
    setSearchTerm("");
  }, [table, setUiFiltersState, showFacilityFilter, setSelectedFacilityId]);

  const handleRemoveFilter = React.useCallback((key: "status" | "facilityName" | "dateRange", sub?: string) => {
    if (key === 'status' && sub) {
      const next = uiFilters.status.filter(s => s !== sub);
      const updated = { ...uiFilters, status: next };
      setUiFiltersState(updated);
      setUiFilters(updated);
    } else if (key === 'facilityName') {
      setSelectedFacilityId(null);
    } else if (key === 'dateRange') {
      const updated = { ...uiFilters, dateRange: null };
      setUiFiltersState(updated);
      setUiFilters(updated);
    }
  }, [uiFilters, setUiFiltersState, setSelectedFacilityId]);

  // Filter modal change handler
  const handleFilterChange = React.useCallback((v: FilterModalValue) => {
    if (showFacilityFilter) setSelectedFacilityId(v.facilityId ?? null)
    const updated: UiFiltersPrefs = {
      status: v.status,
      dateRange: v.dateRange ? {
        from: v.dateRange.from ? format(v.dateRange.from, 'yyyy-MM-dd') : null,
        to: v.dateRange.to ? format(v.dateRange.to, 'yyyy-MM-dd') : null,
      } : null,
    }
    setUiFiltersState(updated); setUiFilters(updated)
  }, [showFacilityFilter, setSelectedFacilityId, setUiFiltersState])

  return (
    <ErrorBoundary>
      <>
        <RepairRequestsEditDialog />
        <RepairRequestsDeleteDialog />
        <RepairRequestsApproveDialog />
        <RepairRequestsCompleteDialog />

        <RepairRequestsDetailView
          requestToView={dialogState.requestToView}
          onClose={closeAllDialogs}
        />

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
          onFilterModalOpenChange={setIsFilterModalOpen}
          uiFilters={uiFilters}
          onFilterChange={handleFilterChange}
          selectedFacilityId={selectedFacilityId ?? null}
          facilityOptions={facilityOptions.map(f => ({ id: f.id, name: f.name }))}
          onRemoveFilter={handleRemoveFilter}
          filterState={{ isFiltered: isFiltered as boolean, isFilterModalOpen }}
          table={table}
          tableKey={tableKey}
          listState={{ isMobile, isLoading, isFetching }}
          totalRequests={totalRequests}
          repairPagination={repairPagination}
          columnOptions={columnOptions}
          setRequestToView={setRequestToViewAdapter}
          openCreateSheet={openCreateSheet}
        />
      </>
    </ErrorBoundary>
  )
}

export default function RepairRequestsPageClient() {
  const { status } = useSession()

  // The page wrapper owns unauthenticated access; keep the skeleton as a defensive fallback.
  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <RepairRequestsProvider>
      <RepairRequestsPageClientInner />
    </RepairRequestsProvider>
  )
}
