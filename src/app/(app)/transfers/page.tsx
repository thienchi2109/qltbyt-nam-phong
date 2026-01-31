"use client"

import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Loader2,
  PlusCircle,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { AddTransferDialog } from "@/components/add-transfer-dialog"
import { EditTransferDialog } from "@/components/edit-transfer-dialog"
import { HandoverPreviewDialog } from "@/components/handover-preview-dialog"
import { OverdueTransfersAlert } from "@/components/overdue-transfers-alert"
import { ResponsivePaginationInfo } from "@/components/responsive-pagination-info"
import { TransferDetailDialog } from "@/components/transfer-detail-dialog"
import { TransferCard } from "@/components/transfers/TransferCard"
import { TransferTypeTabs, useTransferTypeTab } from "@/components/transfers/TransferTypeTabs"
import { getColumnsForType } from "@/components/transfers/columnDefinitions"
import { FilterModal } from "@/components/transfers/FilterModal"
import { FilterChips } from "@/components/transfers/FilterChips"
import { TransferRowActions } from "@/components/transfers/TransferRowActions"
import { SearchInput } from "@/components/shared/SearchInput"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { TransfersTableView } from '@/components/transfers/TransfersTableView'
import { TransfersKanbanView } from '@/components/transfers/TransfersKanbanView'
import { TransfersViewToggle, useTransfersViewMode } from '@/components/transfers/TransfersViewToggle'
import { TransfersTenantSelectionPlaceholder } from '@/components/transfers/TransfersTenantSelectionPlaceholder'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useIsMobile } from "@/hooks/use-mobile"
import { useToast } from "@/hooks/use-toast"
import { useTransferActions } from "@/hooks/useTransferActions"
import { useTransferList, useTransferCounts, transferDataGridKeys } from "@/hooks/useTransferDataGrid"
import { useTransferSearch } from "@/hooks/useTransferSearch"
import type {
  TransferListFilters,
  TransferListItem,
  TransferStatus,
} from "@/types/transfers-data-grid"
import { type TransferRequest } from "@/types/database"

export default function TransfersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Handle unauthenticated state
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated" || !session?.user) {
    return null
  }

  return <TransfersPageContent user={session.user} />
}

interface TransfersPageContentProps {
  user: NonNullable<ReturnType<typeof useSession>["data"]>["user"]
}

function TransfersPageContent({ user }: TransfersPageContentProps) {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  const invalidateTransferQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: transferDataGridKeys.all })
  }, [queryClient])

  // Get facility selection from shared context
  const {
    selectedFacilityId,
    setSelectedFacilityId,
    facilities: facilityOptions,
    showSelector: showFacilityFilter,
    shouldFetchData,
  } = useTenantSelection()

  const [rawViewMode] = useTransfersViewMode()
  const viewMode = isMobile ? 'table' : rawViewMode

  // Get user role from session context
  const userRole = user?.role as 'global' | 'regional_leader' | 'to_qltb' | 'technician' | 'user' | undefined

  // Tenant key for query cache isolation - use selected facility for multi-tenant users
  const effectiveTenantKey = selectedFacilityId ?? user?.don_vi ?? 'none'

  const [activeTab, setActiveTab] = useTransferTypeTab("noi_bo")
  const { searchTerm, setSearchTerm, debouncedSearch, clearSearch } = useTransferSearch()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "created_at", desc: true },
  ])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })
  const [statusFilter, setStatusFilter] = React.useState<TransferStatus[]>([])
  const [dateRange, setDateRange] = React.useState<{ from: Date | null; to: Date | null } | null>(
    null,
  )
  const [isFilterModalOpen, setIsFilterModalOpen] = React.useState(false)

  const filters = React.useMemo<TransferListFilters>(() => {
    return {
      statuses: statusFilter,
      types: [activeTab],
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      q: debouncedSearch || undefined,
      facilityId: selectedFacilityId ?? null,
      dateFrom: dateRange?.from?.toISOString().split("T")[0] || undefined,
      dateTo: dateRange?.to?.toISOString().split("T")[0] || undefined,
      // Cache isolation fields - for query key scoping only
      _role: user?.role,
      _diaBan: typeof user?.dia_ban_id === 'number' ? user.dia_ban_id : null,
      _tenantKey: effectiveTenantKey,
    }
  }, [activeTab, pagination, debouncedSearch, selectedFacilityId, statusFilter, dateRange, user?.role, user?.dia_ban_id, effectiveTenantKey])

  const countsFilters = React.useMemo<TransferListFilters>(() => {
    const { statuses: _statuses, page: _page, pageSize: _pageSize, ...rest } = filters
    return { ...rest }
  }, [filters])

  const {
    data: transferList,
    isLoading: isListLoading,
    isFetching: isListFetching,
  } = useTransferList(filters, {
    placeholderData: (previous) => previous,
    enabled: shouldFetchData,
  })

  const {
    data: statusCounts,
  } = useTransferCounts(countsFilters, {
    enabled: shouldFetchData,
  })

  const {
    approveTransfer,
    startTransfer,
    handoverToExternal,
    returnFromExternal,
    completeTransfer,
    confirmDelete,
    canEditTransfer,
    canDeleteTransfer,
    mapToTransferRequest,
    isRegionalLeader,
    isTransferCoreRole,
  } = useTransferActions()

  const tableData = transferList?.data ?? []
  const totalCount = transferList?.total ?? 0
  const pageSize = transferList?.pageSize ?? pagination.pageSize
  const pageCount = transferList ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1

  const referenceDate = React.useMemo(() => new Date(), [])

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [editingTransfer, setEditingTransfer] = React.useState<TransferRequest | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false)
  const [detailTransfer, setDetailTransfer] = React.useState<TransferRequest | null>(null)
  const [handoverDialogOpen, setHandoverDialogOpen] = React.useState(false)
  const [handoverTransfer, setHandoverTransfer] = React.useState<TransferRequest | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingTransfer, setDeletingTransfer] = React.useState<TransferListItem | null>(null)

  React.useEffect(() => {
    setStatusFilter([])
  }, [activeTab])

  React.useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [activeTab, selectedFacilityId, debouncedSearch, statusFilter, dateRange])

  const handleClearAllFilters = React.useCallback(() => {
    setStatusFilter([])
    setDateRange(null)
    clearSearch()
  }, [clearSearch])

  const handleRemoveFilter = React.useCallback(
    (key: "statuses" | "dateRange" | "searchText", subkey?: string) => {
      if (key === "statuses" && subkey) {
        setStatusFilter((prev) => prev.filter((s) => s !== subkey))
      } else if (key === "dateRange") {
        setDateRange(null)
      }
    },
    [],
  )

  const activeFilterCount = React.useMemo(() => {
    let count = 0
    if (statusFilter.length > 0) count++
    if (dateRange?.from || dateRange?.to) count++
    return count
  }, [statusFilter.length, dateRange])

  const handleEditTransfer = React.useCallback(
    (item: TransferListItem) => {
      setEditingTransfer(mapToTransferRequest(item))
      setIsEditDialogOpen(true)
    },
    [mapToTransferRequest],
  )

  const handleOpenDeleteDialog = React.useCallback(
    (item: TransferListItem) => {
      setDeletingTransfer(item)
      setDeleteDialogOpen(true)
    },
    [],
  )

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deletingTransfer) return
    await confirmDelete(deletingTransfer)
    setDeleteDialogOpen(false)
    setDeletingTransfer(null)
  }, [confirmDelete, deletingTransfer])

  const handleGenerateHandoverSheet = React.useCallback(
    (item: TransferListItem) => {
      const mapped = mapToTransferRequest(item)
      if (!mapped.thiet_bi) {
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: "Không tìm thấy thông tin thiết bị.",
        })
        return
      }
      setHandoverTransfer(mapped)
      setHandoverDialogOpen(true)
    },
    [mapToTransferRequest, toast],
  )

  const handleViewDetail = React.useCallback(
    (item: TransferListItem) => {
      setDetailTransfer(mapToTransferRequest(item))
      setDetailDialogOpen(true)
    },
    [mapToTransferRequest],
  )

  const renderRowActions = React.useCallback(
    (item: TransferListItem) => (
      <TransferRowActions
        item={item}
        canEdit={canEditTransfer(item)}
        canDelete={canDeleteTransfer(item)}
        isTransferCoreRole={isTransferCoreRole}
        userRole={user?.role || ""}
        userKhoaPhong={user?.khoa_phong}
        onEdit={handleEditTransfer}
        onDelete={handleOpenDeleteDialog}
        onApprove={approveTransfer}
        onStart={startTransfer}
        onHandover={handoverToExternal}
        onReturn={returnFromExternal}
        onComplete={completeTransfer}
        onGenerateHandoverSheet={handleGenerateHandoverSheet}
      />
    ),
    [
      approveTransfer,
      canDeleteTransfer,
      canEditTransfer,
      completeTransfer,
      handleEditTransfer,
      handleGenerateHandoverSheet,
      handleOpenDeleteDialog,
      handoverToExternal,
      isTransferCoreRole,
      returnFromExternal,
      startTransfer,
      user?.khoa_phong,
      user?.role,
    ],
  )

  const columns = React.useMemo(
    () => getColumnsForType(activeTab, { renderActions: renderRowActions, referenceDate }),
    [activeTab, referenceDate, renderRowActions],
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount,
  })

  return (
    <>
      {/* Lazy mount dialogs - only render when open to prevent unnecessary initialization */}
      {isAddDialogOpen && (
        <AddTransferDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          onSuccess={invalidateTransferQueries}
        />
      )}

      {isEditDialogOpen && (
        <EditTransferDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={invalidateTransferQueries}
          transfer={editingTransfer}
        />
      )}

      {detailDialogOpen && (
        <TransferDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          transfer={detailTransfer}
        />
      )}

      {handoverDialogOpen && (
        <HandoverPreviewDialog
          open={handoverDialogOpen}
          onOpenChange={setHandoverDialogOpen}
          transfer={handoverTransfer}
        />
      )}

      <OverdueTransfersAlert
        onViewTransfer={(transfer) => {
          setDetailTransfer(transfer)
          setDetailDialogOpen(true)
        }}
      />

      {isFilterModalOpen && (
        <FilterModal
          open={isFilterModalOpen}
          onOpenChange={setIsFilterModalOpen}
          value={{
            statuses: statusFilter,
            dateRange,
          }}
          onChange={(newValue) => {
            setStatusFilter(newValue.statuses)
            setDateRange(newValue.dateRange ?? null)
          }}
          variant={isMobile ? "sheet" : "dialog"}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa yêu cầu luân chuyển này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Luân chuyển thiết bị</CardTitle>
            <CardDescription>
              Theo dõi và xử lý yêu cầu luân chuyển theo từng loại hình
            </CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2">
            <div className="hidden sm:block">
              <TransfersViewToggle />
            </div>

            {/* Tenant selector from shared context */}
            {showFacilityFilter && (
              <TenantSelector />
            )}

            {/* Filter button - mobile optimized */}
            <Button
              variant="outline"
              onClick={() => setIsFilterModalOpen(true)}
              className="h-11 gap-2 font-medium sm:h-9"
            >
              <Filter className="h-5 w-5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Bộ lọc</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs sm:ml-1">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>

            {/* Create button - spans full width on mobile */}
            {!isRegionalLeader && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="col-span-2 h-11 gap-2 font-medium sm:col-span-1 sm:h-9"
              >
                <PlusCircle className="h-5 w-5 sm:h-4 sm:w-4" />
                Tạo yêu cầu mới
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <TransferTypeTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={{
              noi_bo:
                activeTab === "noi_bo"
                  ? statusCounts?.totalCount ?? totalCount
                  : undefined,
              ben_ngoai:
                activeTab === "ben_ngoai"
                  ? statusCounts?.totalCount ?? totalCount
                  : undefined,
              thanh_ly:
                activeTab === "thanh_ly"
                  ? statusCounts?.totalCount ?? totalCount
                  : undefined,
            }}
          >
            <div className="flex flex-col gap-3">
              <FilterChips
                value={{
                  statuses: statusFilter,
                  dateRange: dateRange
                    ? {
                      from: dateRange.from?.toLocaleDateString("vi-VN") ?? null,
                      to: dateRange.to?.toLocaleDateString("vi-VN") ?? null,
                    }
                    : null,
                }}
                onRemove={handleRemoveFilter}
                onClearAll={handleClearAllFilters}
              />

              <SearchInput
                placeholder="Tìm kiếm mã yêu cầu, thiết bị, lý do..."
                value={searchTerm}
                onChange={setSearchTerm}
                onClear={clearSearch}
                showSearchIcon={true}
                className="w-full max-w-sm"
              />

              {viewMode === 'kanban' ? (
                shouldFetchData ? (
                  <TransfersKanbanView
                    filters={filters}
                    onViewTransfer={handleViewDetail}
                    renderRowActions={renderRowActions}
                    statusCounts={statusCounts?.columnCounts}
                    userRole={userRole}
                  />
                ) : (
                  <TransfersTenantSelectionPlaceholder />
                )
              ) : shouldFetchData ? (
                <>
                  <div className="space-y-3 lg:hidden">
                    {isListLoading ? (
                      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed">
                        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          Đang tải dữ liệu...
                        </div>
                      </div>
                    ) : tableData.length > 0 ? (
                      tableData.map((item) => (
                        <TransferCard
                          key={item.id}
                          transfer={item}
                          referenceDate={referenceDate}
                          onClick={() => handleViewDetail(item)}
                          actions={renderRowActions(item)}
                        />
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                        Không có dữ liệu phù hợp.
                      </div>
                    )}
                  </div>

                  <div className="hidden lg:block">
                    <TransfersTableView
                      data={tableData}
                      columns={columns}
                      sorting={sorting}
                      onSortingChange={setSorting}
                      pagination={pagination}
                      onPaginationChange={setPagination}
                      pageCount={pageCount}
                      isLoading={isListLoading}
                      onRowClick={handleViewDetail}
                    />
                  </div>
                </>
              ) : (
                <TransfersTenantSelectionPlaceholder />
              )}

              {isListFetching && !isListLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Đang đồng bộ dữ liệu...
                </div>
              )}
            </div>
          </TransferTypeTabs>
        </CardContent>

        {/* Pagination controls - only show for table view */}
        {viewMode === 'table' && (
          <CardFooter className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <ResponsivePaginationInfo
              currentCount={table.getPaginationRowModel().rows.length}
              totalCount={totalCount}
              currentPage={pagination.pageIndex + 1}
              totalPages={pageCount}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-center gap-2">
                <span className="text-sm">Số dòng</span>
                <Select
                  value={String(pagination.pageSize)}
                  onValueChange={(value) =>
                    setPagination({ pageIndex: 0, pageSize: Number(value) })
                  }
                >
                  <SelectTrigger className="h-8 w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {[10, 20, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 sm:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl p-0 sm:h-8 sm:w-8"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
                <span className="text-sm font-medium">
                  Trang {pagination.pageIndex + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-xl p-0 sm:h-8 sm:w-8"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 sm:flex"
                  onClick={() => table.setPageIndex(pageCount - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardFooter>
        )}
      </Card>
    </>
  )
}
