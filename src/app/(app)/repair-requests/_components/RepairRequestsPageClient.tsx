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
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
// Supabase client is not used directly; use RPC proxy instead
import { callRpc } from "@/lib/rpc-client"
import { Loader2, PlusCircle, Layers, Clock, CheckCircle, CheckCheck, XCircle } from "lucide-react"
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
import { calculateDaysRemaining } from "../utils"
import { useRepairRequestShortcuts } from "../_hooks/useRepairRequestShortcuts"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import { useRepairRequestUIHandlers } from "../_hooks/useRepairRequestUIHandlers"
import { useRepairRequestColumns, renderActions } from "./RepairRequestsColumns"
import { RepairRequestsMobileList } from "./RepairRequestsMobileList"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
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

const repairRequestsDisplayFormat = (ctx: DisplayContext) => {
  const entityLabel = ctx.entity.plural ?? ctx.entity.singular
  return `Hiển thị ${ctx.startItem}-${ctx.endItem} trên tổng ${ctx.totalCount} ${entityLabel}`
}

/**
 * Inner component that consumes the RepairRequestsContext.
 * Separated to allow useRepairRequestsContext to be called within the provider.
 */
function RepairRequestsPageClientInner() {
  const { toast } = useToast()
  const { data: session, status } = useSession()
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
  } = useRepairRequestsContext()

  // Redirect if not authenticated
  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  // Temporarily disable useRealtimeSync to avoid conflict with RealtimeProvider
  // useRepairRealtimeSync()
  const searchParams = useSearchParams()
  const [allEquipment, setAllEquipment] = React.useState<EquipmentSelectItem[]>([])
  const [hasLoadedEquipment, setHasLoadedEquipment] = React.useState(false)
  // Track when equipment_get fetch for deep link is in progress
  const [isEquipmentFetchPending, setIsEquipmentFetchPending] = React.useState(false)

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "ngay_yeu_cau", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const debouncedSearch = useSearchDebounce(searchTerm);
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 });

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

  // TanStack Query for repair requests (server-side pagination + facility filtering + date range)
  const {
    data: repairRequestsRes,
    isLoading,
    isFetching,
    refetch: refetchRequests
  } = useQuery<{ data: RepairRequestWithEquipment[], total: number, page: number, pageSize: number }>({
    queryKey: ['repair_request_list', {
      tenant: effectiveTenantKey,
      role: user?.role,           // Cache isolation by role
      diaBan: user?.dia_ban_id,   // Cache isolation by region
      donVi: selectedFacilityId,
      statuses: uiFilters.status || [],
      q: debouncedSearch || null,
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      dateFrom: uiFilters.dateRange?.from || null,
      dateTo: uiFilters.dateRange?.to || null,
    }],
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const result = await callRpc<{ data: RepairRequestWithEquipment[], total: number, page: number, pageSize: number }>({
        fn: 'repair_request_list',
        args: {
          p_q: debouncedSearch || null,
          p_status: null,
          p_page: pagination.pageIndex + 1,
          p_page_size: pagination.pageSize,
          p_don_vi: selectedFacilityId,
          p_date_from: uiFilters.dateRange?.from || null,
          p_date_to: uiFilters.dateRange?.to || null,
          p_statuses: uiFilters.status && uiFilters.status.length ? uiFilters.status : null,
        },
        signal, // Pass signal in options object
      });
      return result;
    },
    enabled: !!user && shouldFetchData,
    placeholderData: (previousData) => previousData, // Keep previous data during refetch (prevents flash)
    staleTime: 30_000, // 30 seconds (repair requests change frequently)
    gcTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Extract data from query response
  const requests = repairRequestsRes?.data ?? [];

  const selectedFacilityName = React.useMemo(() => {
    // Explicit check for null/undefined to handle facility ID 0 correctly
    if (selectedFacilityId === null || selectedFacilityId === undefined) return null;
    const facility = facilityOptions.find(f => f.id === selectedFacilityId);
    return facility?.name ?? null;
  }, [selectedFacilityId, facilityOptions]);

  const totalRequests = repairRequestsRes?.total ?? 0;

  // Status counts for summary (server-side via RPC per status)
  const STATUSES = ['Chờ xử lý', 'Đã duyệt', 'Hoàn thành', 'Không HT'] as const
  type Status = typeof STATUSES[number]
  const { data: statusCounts, isLoading: statusCountsLoading } = useQuery<Record<Status, number>>({
    queryKey: ['repair_request_status_counts', {
      tenant: effectiveTenantKey,
      role: user?.role,           // Cache isolation by role
      diaBan: user?.dia_ban_id,   // Cache isolation by region
      facilityId: selectedFacilityId,
      search: debouncedSearch,
      dateFrom: uiFilters.dateRange?.from || null,
      dateTo: uiFilters.dateRange?.to || null,
    }],
    queryFn: async () => {
      const res = await callRpc<Record<Status, number>>({
        fn: 'repair_request_status_counts',
        args: {
          p_q: debouncedSearch || null,
          p_don_vi: selectedFacilityId,
          p_date_from: uiFilters.dateRange?.from || null,
          p_date_to: uiFilters.dateRange?.to || null,
        },
      })
      return res as Record<Status, number>
    },
    staleTime: 30_000,
    enabled: !!user && shouldFetchData,
  })

  // Note: showFacilityFilter comes from TenantSelectionContext
  // It returns true for global, admin, and regional_leader roles

  // Initial load: fetch a small equipment list via RPC
  React.useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const eq = await callRpc<any[]>({
          fn: 'equipment_list',
          args: { p_q: null, p_sort: 'ten_thiet_bi.asc', p_page: 1, p_page_size: 50 },
        })
        setAllEquipment((eq || []).map((row: any) => ({
          id: row.id,
          ma_thiet_bi: row.ma_thiet_bi,
          ten_thiet_bi: row.ten_thiet_bi,
          khoa_phong_quan_ly: row.khoa_phong_quan_ly,
        })))
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Lỗi',
          description: 'Không thể tải danh sách thiết bị. ' + (error?.message || ''),
        })
      } finally {
        setHasLoadedEquipment(true)
      }
    }
    fetchInitialData()
  }, [toast])

  // Note: Removed manual fetchRequests useEffect - TanStack Query handles fetching automatically
  // Query will refetch when selectedFacilityId or debouncedSearch changes (via queryKey)

  // Support preselect by equipmentId query param using equipment_get RPC if needed
  React.useEffect(() => {
    const equipmentId = searchParams.get('equipmentId');
    const statusParam = searchParams.get('status');
    if (statusParam) {
      const decoded = decodeURIComponent(statusParam)
      const updated = { ...uiFilters, status: [decoded] }
      setUiFiltersState(updated); setUiFilters(updated)
    }
    const run = async () => {
      if (!equipmentId) return;
      const idNum = Number(equipmentId);
      const existing = allEquipment.find(eq => eq.id === idNum);
      if (existing) {
        return;
      }
      // Mark fetch as pending so action=create effect waits for it
      setIsEquipmentFetchPending(true)
      try {
        const row: any = await callRpc({ fn: 'equipment_get', args: { p_id: idNum } })
        if (row) {
          const item: EquipmentSelectItem = {
            id: row.id,
            ma_thiet_bi: row.ma_thiet_bi,
            ten_thiet_bi: row.ten_thiet_bi,
            khoa_phong_quan_ly: row.khoa_phong_quan_ly,
          }
          setAllEquipment(prev => [item, ...prev.filter(x => x.id !== item.id)])
        }
      } catch (e) {
        // ignore; toast not necessary for deep link preselect
      } finally {
        setIsEquipmentFetchPending(false)
      }
    }
    run();
  }, [searchParams, allEquipment, uiFilters]);

  // Handle action=create param with equipment pre-selection
  React.useEffect(() => {
    if (searchParams.get('action') !== 'create') return

    const equipmentId = searchParams.get('equipmentId')

    if (equipmentId) {
      // Wait for initial equipment list to load AND for equipment_get fetch to complete
      if (!hasLoadedEquipment || isEquipmentFetchPending) return

      const idNum = Number(equipmentId)
      const equipment = allEquipment.find(eq => eq.id === idNum)

      // Open sheet with or without pre-selection based on whether equipment was found
      if (equipment) {
        openCreateSheet(equipment)
      } else {
        // Equipment not found in loaded data - open sheet without pre-selection
        openCreateSheet()
      }
    } else {
      // No equipment to pre-select, just open the sheet
      openCreateSheet()
    }

    // Clean up URL only after we've processed the action
    const params = new URLSearchParams(searchParams.toString())
    params.delete('action')
    params.delete('equipmentId')
    const nextPath = params.size ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextPath, { scroll: false })
  }, [searchParams, router, pathname, openCreateSheet, allEquipment, hasLoadedEquipment, isEquipmentFetchPending])

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
  const pageCount = React.useMemo(() => {
    const total = repairRequestsRes?.total ?? 0;
    return Math.max(0, Math.ceil(total / Math.max(pagination.pageSize, 1)));
  }, [repairRequestsRes?.total, pagination.pageSize]);

  // Reset pagination to first page when search, facility filter, or date range changes
  React.useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [debouncedSearch, selectedFacilityId, uiFilters.dateRange, uiFilters.status]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: debouncedSearch,
      pagination,
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
    onPaginationChange: setPagination,
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

  const summaryItems: SummaryItem[] = React.useMemo(() => {
    const toneMap: Record<Status, SummaryItem["tone"]> = {
      'Chờ xử lý': 'warning',
      'Đã duyệt': 'muted',
      'Hoàn thành': 'success',
      'Không HT': 'danger',
    }
    const iconMap: Record<string, React.ReactNode> = {
      'total': <Layers className="h-5 w-5" />,
      'Chờ xử lý': <Clock className="h-5 w-5" />,
      'Đã duyệt': <CheckCheck className="h-5 w-5" />,
      'Hoàn thành': <CheckCircle className="h-5 w-5" />,
      'Không HT': <XCircle className="h-5 w-5" />,
    }

    // Determine active state: true if no filter (shows all) or if this status is the active filter
    const isTotalActive = uiFilters.status.length === 0

    // Handler to clear status filter (show all requests)
    const handleShowAll = () => {
      const updated = { ...uiFilters, status: [] }
      setUiFiltersState(updated)
      setUiFilters(updated)
    }

    // Handler to filter by specific status
    const handleFilterByStatus = (status: Status) => {
      const updated = { ...uiFilters, status: [status] }
      setUiFiltersState(updated)
      setUiFilters(updated)
    }

    const base: SummaryItem[] = [
      { key: 'total', label: 'Tổng', value: totalRequests, tone: 'default', icon: iconMap['total'], onClick: handleShowAll, active: isTotalActive },
    ]
    const statusItems: SummaryItem[] = STATUSES.map((s) => ({
      key: s,
      label: s,
      value: statusCounts?.[s] ?? 0,
      tone: toneMap[s],
      icon: iconMap[s],
      onClick: () => handleFilterByStatus(s),
      active: uiFilters.status.length === 1 && uiFilters.status[0] === s,
    }))
    return [...base, ...statusItems]
  }, [totalRequests, statusCounts, uiFilters, setUiFiltersState, setUiFilters])

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
                </CardContent>
                <CardFooter className="py-4">
                  <DataTablePagination
                    table={table}
                    totalCount={totalRequests}
                    entity={REPAIR_REQUEST_ENTITY}
                    paginationMode={{
                      mode: "controlled",
                      pagination,
                      onPaginationChange: setPagination,
                    }}
                    displayFormat={repairRequestsDisplayFormat}
                    responsive={{ stackLayoutAt: "md", showFirstLastAt: "lg" }}
                    isLoading={isLoading || isFetching}
                  />
                </CardFooter>
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
  return (
    <RepairRequestsProvider>
      <RepairRequestsPageClientInner />
    </RepairRequestsProvider>
  )
}
