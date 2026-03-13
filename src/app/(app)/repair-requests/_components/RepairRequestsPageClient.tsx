"use client"

import * as React from "react"
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table"
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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
// callRpc moved to extracted hooks
import { Building2, Loader2, PlusCircle } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
// Legacy auth-context removed; NextAuth is used throughout
import { useSession } from "next-auth/react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { usePathname, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { RepairRequestAlert } from "@/components/repair-request-alert"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { TenantSelector } from "@/components/shared/TenantSelector"
import type { FacilityOption } from "@/types/tenant"
import { useMediaQuery } from "@/hooks/use-media-query"
import { ErrorBoundary } from "@/components/error-boundary"
import { Sheet, SheetContent, SheetHeader as SheetHeaderUI, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { SummaryBar, type SummaryItem } from "@/components/summary/summary-bar"
import { RepairRequestsFilterModal } from "./RepairRequestsFilterModal"
import { RepairRequestsDetailContent } from "./RepairRequestsDetailContent"
import { RepairRequestsEditDialog } from "./RepairRequestsEditDialog"
import { RepairRequestsDeleteDialog } from "./RepairRequestsDeleteDialog"
import { RepairRequestsApproveDialog } from "./RepairRequestsApproveDialog"
import { RepairRequestsCompleteDialog } from "./RepairRequestsCompleteDialog"
import { RepairRequestsCreateSheet } from "./RepairRequestsCreateSheet"
import { RepairRequestsProvider } from "./RepairRequestsContext"
import { RepairRequestsTable } from "./RepairRequestsTable"
import { RepairRequestsToolbar } from "./RepairRequestsToolbar"
import type { EquipmentSelectItem, RepairRequestWithEquipment } from "../types"
import { useRepairRequestsData } from "../_hooks/useRepairRequestsData"
import { useRepairRequestsDeepLink } from "../_hooks/useRepairRequestsDeepLink"
import { useRepairRequestsSummary } from "../_hooks/useRepairRequestsSummary"
import { useRepairRequestShortcuts } from "../_hooks/useRepairRequestShortcuts"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import { useRepairRequestUIHandlers } from "../_hooks/useRepairRequestUIHandlers"
import { useRepairRequestColumns, renderActions } from "./RepairRequestsColumns"
import { RepairRequestsMobileList } from "./RepairRequestsMobileList"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import {
  getUiFilters,
  setUiFilters,
  getColumnVisibility,
  setColumnVisibility,
  type UiFilters as UiFiltersPrefs,
  type ColumnVisibility as ColumnVisibilityPrefs,
} from "@/lib/rr-prefs"
// Auto department filter removed

const REPAIR_REQUEST_ENTITY = { singular: "yêu cầu" } as const

/**
 * Inner component that consumes the RepairRequestsContext.
 * Separated to allow useRepairRequestsContext to be called within the provider.
 */
function RepairRequestsPageClientInner() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const { data: branding } = useTenantBranding()
  const user = session?.user // Properly typed via NextAuth module augmentation
  const router = useRouter()
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const isSheetMobile = useMediaQuery("(max-width: 1279px)")
  const queryClient = useQueryClient()

  // Get context values
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

  // Temporarily disable useRealtimeSync to avoid conflict with RealtimeProvider
  // useRepairRealtimeSync()
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
    refetchRequests,
    statusCounts,
    statusCountsLoading,
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
  const { allEquipment } = useRepairRequestsDeepLink({
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

  // Table columns (extracted to separate file)
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

  // Use data from server (already filtered by facility if selected)
  const tableData = requests;

  // Create stable key for table to force remount when filter changes (prevents state corruption)
  const tableKey = React.useMemo(() => {
    return `${selectedFacilityId || 'all'}_${tableData.length}`;
  }, [selectedFacilityId, tableData.length]);

  // Calculate page count from server total
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
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? (updater as any)(columnFilters) : updater
      setColumnFilters(next)
      // Do not sync status via column filters; status is server-side now.
    },
    onGlobalFilterChange: (value: string) => setSearchTerm(value),
    onPaginationChange: repairPagination.setPagination,
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? (updater as any)(columnVisibility) : updater
      setColumnVisibilityState(next)
      setColumnVisibility(next)
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // getPaginationRowModel() removed - server handles pagination via manualPagination: true
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  const isFiltered = table.getState().columnFilters.length > 0 || debouncedSearch.length > 0 || (uiFilters.dateRange?.from || uiFilters.dateRange?.to);

  // Server-side status filtering; no column filter syncing needed.

  // Keyboard shortcuts: '/', 'n'
  useRepairRequestShortcuts({
    searchInputRef,
    onCreate: openCreateSheet,
    isRegionalLeader
  })

  // KPI summary items
  const { kpiTotal, summaryItems } = useRepairRequestsSummary({
    statusCounts,
    uiFilters,
    setUiFiltersState,
    setUiFilters,
  })

  // Get requestToView from context for detail dialogs
  const requestToView = dialogState.requestToView

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

  return (
    <ErrorBoundary>
      <>
        <RepairRequestsEditDialog />

        <RepairRequestsDeleteDialog />

        <RepairRequestsApproveDialog />

        <RepairRequestsCompleteDialog />

        {/* Request Detail - Mobile */}
        {requestToView && isMobile && (
          <Dialog open={!!requestToView} onOpenChange={(open) => !open && closeAllDialogs()}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="text-lg font-semibold">
                  Chi tiết yêu cầu sửa chữa
                </DialogTitle>
                <DialogDescription>
                  Thông tin chi tiết về yêu cầu sửa chữa thiết bị
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-hidden pr-4">
                <ScrollArea className="h-full">
                  <RepairRequestsDetailContent request={requestToView} />
                </ScrollArea>
              </div>

              <DialogFooter className="flex-shrink-0 mt-4 border-t pt-4">
                <Button variant="outline" onClick={() => closeAllDialogs()}>
                  Đóng
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Request Detail - Desktop */}
        {requestToView && !isMobile && (
          <Sheet open={!!requestToView} onOpenChange={(open) => !open && closeAllDialogs()}>
            <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0">
              <div className="h-full flex flex-col">
                <div className="p-4 border-b">
                  <SheetTitle>Chi tiết yêu cầu sửa chữa</SheetTitle>
                  <SheetDescription>Thông tin chi tiết về yêu cầu sửa chữa thiết bị</SheetDescription>
                </div>
                <div className="flex-1 overflow-hidden px-4">
                  <ScrollArea className="h-full">
                    <RepairRequestsDetailContent request={requestToView} />
                  </ScrollArea>
                </div>
                <div className="p-4 border-t flex justify-end">
                  <Button variant="outline" onClick={() => closeAllDialogs()}>Đóng</Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Repair Request Alert */}
        <RepairRequestAlert requests={requests} />

        <div className="space-y-6">
          {/* Header + Create Button */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">Yêu cầu sửa chữa</h1>
              {selectedFacilityName && (
                <p className="text-sm text-muted-foreground">{selectedFacilityName}</p>
              )}
            </div>
            {!isRegionalLeader && (
              <div className="hidden md:flex items-center gap-2">
                <Button onClick={() => openCreateSheet()} className="touch-target">
                  <PlusCircle className="mr-2 h-4 w-4" /> Tạo yêu cầu
                </Button>
              </div>
            )}
          </div>

          {/* Summary */}
          <SummaryBar items={summaryItems} loading={statusCountsLoading} />

          {/* Create Sheet */}
          {!isRegionalLeader && (
            <RepairRequestsCreateSheet />
          )}

          {/* Mobile FAB for quick create */}
          {!isRegionalLeader && isMobile && (
            <Button
              className="fixed right-6 fab-above-footer rounded-full h-14 w-14 shadow-lg"
              onClick={() => openCreateSheet()}
              aria-label="Tạo yêu cầu"
            >
              <PlusCircle className="h-6 w-6" />
            </Button>
          )}

          {/* Content area: Split on desktop, full on mobile or when aside collapsed/full mode */}
          <div className="grid grid-cols-1 gap-4">
            {/* Left: Requests List */}
            <div className="w-full">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="heading-responsive-h2">Tổng hợp các yêu cầu sửa chữa thiết bị</CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Tất cả các yêu cầu sửa chữa đã được ghi nhận.
                  </CardDescription>

                  {/* Tenant selector from shared context */}
                  {showFacilityFilter && (
                    <div className="mt-4">
                      <TenantSelector />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-3 md:p-6 gap-3 md:gap-4">
                  <RepairRequestsToolbar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    searchInputRef={searchInputRef}
                    isFiltered={isFiltered as boolean}
                    onClearFilters={handleClearFilters}
                    onOpenFilterModal={() => setIsFilterModalOpen(true)}

                    uiFilters={uiFilters}
                    selectedFacilityName={selectedFacilityName}
                    showFacilityFilter={showFacilityFilter}
                    onRemoveFilter={handleRemoveFilter}
                  />

                  {/* Filter Modal */}
                  <RepairRequestsFilterModal
                    open={isFilterModalOpen}
                    onOpenChange={setIsFilterModalOpen}
                    value={{
                      status: uiFilters.status,
                      facilityId: selectedFacilityId ?? null,
                      dateRange: uiFilters.dateRange ? {
                        from: uiFilters.dateRange.from ? new Date(uiFilters.dateRange.from) : null,
                        to: uiFilters.dateRange.to ? new Date(uiFilters.dateRange.to) : null,
                      } : { from: null, to: null },
                    }}
                    onChange={(v) => {
                      // sync facility
                      if (showFacilityFilter) setSelectedFacilityId(v.facilityId ?? null)
                      // persist date range and status
                      const updated: UiFiltersPrefs = {
                        status: v.status,
                        dateRange: v.dateRange ? {
                          from: v.dateRange.from ? format(v.dateRange.from, 'yyyy-MM-dd') : null,
                          to: v.dateRange.to ? format(v.dateRange.to, 'yyyy-MM-dd') : null,
                        } : null,
                      }
                      setUiFiltersState(updated); setUiFilters(updated)
                    }}
                    showFacility={showFacilityFilter}
                    facilities={facilityOptions.map(f => ({ id: f.id, name: f.name }))}
                    variant={isMobile ? 'sheet' : 'dialog'}
                  />

                  {shouldFetchData ? (
                    <>
                      {/* Mobile Card View */}
                      {isMobile ? (
                        <RepairRequestsMobileList
                          requests={table.getRowModel().rows.map(row => row.original)}
                          isLoading={isLoading}
                          setRequestToView={setRequestToViewAdapter}
                          renderActions={(req) => renderActions(req, columnOptions)}
                        />
                      ) : (
                        /* Desktop Table View */
                        <div key={tableKey} className="rounded-md border overflow-x-auto">
                          <div className="min-w-[1100px]">
                            <RepairRequestsTable
                              table={table}
                              isLoading={isLoading || isFetching}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="flex max-w-md flex-col items-center gap-4 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium">Chọn cơ sở y tế</h3>
                          <p className="text-sm text-muted-foreground">
                            Vui lòng chọn một cơ sở y tế từ bộ lọc phía trên để xem danh sách yêu cầu sửa chữa.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                {shouldFetchData && (
                  <CardFooter className="py-4">
                    <DataTablePagination
                      table={table}
                      totalCount={totalRequests}
                      entity={REPAIR_REQUEST_ENTITY}
                      paginationMode={{
                        mode: "controlled",
                        pagination: repairPagination.pagination,
                        onPaginationChange: repairPagination.setPagination,
                      }}
                      displayFormat="range-total"
                      responsive={{ stackLayoutAt: "md", showFirstLastAt: "lg" }}
                      isLoading={isLoading || isFetching}
                    />
                  </CardFooter>
                )}
              </Card>
            </div>

          </div>

          {/* Fall-back (mobile/tablet): keep FAB + Sheet for create */}

        </div>

      </>
    </ErrorBoundary>
  )
}

export default function RepairRequestsPageClient() {
  const { status } = useSession()
  const router = useRouter()

  // Handle unauthenticated redirect in useEffect (not during render)
  React.useEffect(() => {
    if (status === "unauthenticated") router.push("/")
  }, [status, router])

  // Show loading state for both loading and unauthenticated (while redirecting)
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
