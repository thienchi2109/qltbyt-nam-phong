"use client"

import * as React from "react"
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type Table,
} from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useIsMobile } from "@/hooks/use-mobile"
import { useServerPagination } from "@/hooks/useServerPagination"
import { useToast } from "@/hooks/use-toast"
import { useTransferActions } from "@/hooks/useTransferActions"
import {
  transferDataGridKeys,
  useTransferPageData,
} from "@/hooks/useTransferDataGrid"
import { useTransferTypeTab } from "@/components/transfers/TransferTypeTabs"
import { useTransfersViewMode } from "@/components/transfers/TransfersViewToggle"
import { getColumnsForType } from "@/components/transfers/columnDefinitions"
import type { FilterModalValue } from "@/components/transfers/FilterModal"
import type { FilterChipsValue } from "@/components/transfers/FilterChips"
import { isGlobalRole } from "@/lib/rbac"
import type { TransferRequest } from "@/types/database"
import type {
  TransferListFilters,
  TransferListItem,
  TransferCountsResponse,
  TransferKanbanResponse,
} from "@/types/transfers-data-grid"

import type { TransferUserRole } from "./TransfersTypes"
import { useTransfersFilters } from "./useTransfersFilters"
import { useTransfersRowActions } from "./useTransfersRowActions"

export type TransfersPageUser = NonNullable<ReturnType<typeof useSession>["data"]>["user"]

export interface TransfersPageControllerResult {
  activeTab: ReturnType<typeof useTransferTypeTab>[0]
  setActiveTab: ReturnType<typeof useTransferTypeTab>[1]
  transferCounts: TransferCountsResponse | null | undefined
  kanbanData: TransferKanbanResponse | null | undefined
  isCountsLoading: boolean
  isCountsError: boolean
  filtersState: ReturnType<typeof useTransfersFilters>
  filterChipsValue: FilterChipsValue
  filterModalValue: FilterModalValue
  setFilterModalValue: (value: FilterModalValue) => void
  filterVariant: "dialog" | "sheet"
  isAddDialogOpen: boolean
  setIsAddDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  invalidateTransferQueries: () => void
  rowActions: ReturnType<typeof useTransfersRowActions>
  openTransferFromAlert: (transfer: TransferRequest) => void
  viewMode: "table" | "kanban"
  userRole: TransferUserRole | undefined
  isRegionalLeader: boolean
  isReturning: boolean
  showFacilityFilter: boolean
  shouldFetchData: boolean
  tableData: TransferListItem[]
  isListLoading: boolean
  isListFetching: boolean
  totalCount: number
  referenceDate: Date
  filters: TransferListFilters
  columns: ReturnType<typeof getColumnsForType>
  table: Table<TransferListItem>
  transferPagination: ReturnType<typeof useServerPagination>
}

export function toDateFilterValue(value: Date | null | undefined): string | undefined {
  if (!value) return undefined

  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function normalizeTransferUserRole(
  role: string | null | undefined,
): TransferUserRole | undefined {
  if (isGlobalRole(role)) return "global"

  switch (role) {
    case "regional_leader":
    case "to_qltb":
    case "technician":
    case "user":
      return role
    default:
      return undefined
  }
}

export function useTransfersPageController(
  user: TransfersPageUser,
): TransfersPageControllerResult {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const [rawViewMode] = useTransfersViewMode()
  const viewMode = isMobile ? "table" : rawViewMode

  const {
    selectedFacilityId,
    showSelector: showFacilityFilter,
    shouldFetchData,
  } = useTenantSelection()

  const userRole = normalizeTransferUserRole(user?.role)
  const effectiveTenantKey = selectedFacilityId ?? user?.don_vi ?? "none"

  const [activeTab, setActiveTab] = useTransferTypeTab("noi_bo")
  const filtersState = useTransfersFilters({ activeTab })
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [totalCount, setTotalCount] = React.useState(0)

  const invalidateTransferQueries = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: transferDataGridKeys.all })
  }, [queryClient])

  const paginationResetKey = React.useMemo(
    () =>
      [
        activeTab,
        selectedFacilityId ?? "",
        filtersState.debouncedSearch,
        filtersState.statusFilter.join(","),
        filtersState.dateRange?.from?.getTime() ?? "",
        filtersState.dateRange?.to?.getTime() ?? "",
      ].join("|"),
    [
      activeTab,
      filtersState.dateRange?.from,
      filtersState.dateRange?.to,
      filtersState.debouncedSearch,
      filtersState.statusFilter,
      selectedFacilityId,
    ],
  )

  const transferPagination = useServerPagination({
    totalCount,
    resetKey: paginationResetKey,
  })

  const filters = React.useMemo<TransferListFilters>(
    () => ({
      statuses: filtersState.statusFilter,
      types: [activeTab],
      page: transferPagination.page,
      pageSize: transferPagination.pageSize,
      q: filtersState.debouncedSearch || undefined,
      facilityId: selectedFacilityId ?? null,
      dateFrom: toDateFilterValue(filtersState.dateRange?.from),
      dateTo: toDateFilterValue(filtersState.dateRange?.to),
      _role: user?.role,
      _diaBan: typeof user?.dia_ban_id === "number" ? user.dia_ban_id : null,
      _tenantKey: effectiveTenantKey,
    }),
    [
      activeTab,
      effectiveTenantKey,
      filtersState.dateRange?.from,
      filtersState.dateRange?.to,
      filtersState.debouncedSearch,
      filtersState.statusFilter,
      selectedFacilityId,
      transferPagination.page,
      transferPagination.pageSize,
      user?.dia_ban_id,
      user?.role,
    ],
  )

  const countsFilterKey = React.useMemo(
    () =>
      JSON.stringify({
        q: filters.q ?? null,
        types: [...(filters.types ?? [])].sort(),
        facilityId: filters.facilityId ?? null,
        dateFrom: filters.dateFrom ?? null,
        dateTo: filters.dateTo ?? null,
        assigneeIds: [...(filters.assigneeIds ?? [])].sort((a, b) => a - b),
        role: filters._role ?? null,
        diaBan: filters._diaBan ?? null,
        tenantKey: filters._tenantKey ?? null,
      }),
    [
      filters._diaBan,
      filters._role,
      filters._tenantKey,
      filters.assigneeIds,
      filters.dateFrom,
      filters.dateTo,
      filters.facilityId,
      filters.q,
      filters.types,
    ],
  )
  const lastCountsFilterKeyRef = React.useRef<string | null>(null)
  const [cachedTransferCounts, setCachedTransferCounts] =
    React.useState<TransferCountsResponse | null>(null)
  const includeCounts = lastCountsFilterKeyRef.current !== countsFilterKey

  const {
    data: transferPageData,
    isLoading: isPageDataLoading,
    isFetching: isPageDataFetching,
    isError: isPageDataError,
  } = useTransferPageData(filters, {
    viewMode,
    excludeCompleted: viewMode === "kanban",
    includeCounts,
    perColumnLimit: 30,
    placeholderData: (previous) => previous,
    enabled: shouldFetchData,
  })

  const transferList = transferPageData?.list
  const latestTransferCounts = transferPageData?.counts
  const transferCounts = latestTransferCounts ?? cachedTransferCounts
  const kanbanData = transferPageData?.kanban

  React.useEffect(() => {
    if (!latestTransferCounts) return

    lastCountsFilterKeyRef.current = countsFilterKey
    setCachedTransferCounts(latestTransferCounts)
  }, [countsFilterKey, latestTransferCounts])

  React.useEffect(() => {
    setTotalCount(transferList?.total ?? kanbanData?.totalCount ?? transferCounts?.totalCount ?? 0)
  }, [kanbanData?.totalCount, transferCounts?.totalCount, transferList?.total])

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
    isReturning,
  } = useTransferActions()

  const rowActions = useTransfersRowActions({
    approveTransfer,
    startTransfer,
    handoverToExternal,
    returnFromExternal,
    completeTransfer,
    confirmDelete,
    canEditTransfer,
    canDeleteTransfer,
    isTransferCoreRole,
    userRole: user?.role,
    userKhoaPhong: user?.khoa_phong,
    mapToTransferRequest,
    toast,
  })

  const referenceDate = React.useMemo(() => new Date(), [])
  const tableData = transferList?.data ?? []

  const columns = React.useMemo(
    () =>
      getColumnsForType(activeTab, {
        renderActions: rowActions.renderRowActions,
        referenceDate,
      }),
    [activeTab, referenceDate, rowActions.renderRowActions],
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: { pagination: transferPagination.pagination },
    onPaginationChange: transferPagination.setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: transferPagination.pageCount,
  })

  const filterChipsValue = React.useMemo<FilterChipsValue>(
    () => ({
      statuses: filtersState.statusFilter,
      dateRange: filtersState.dateRange
        ? {
            from: filtersState.dateRange.from?.toLocaleDateString("vi-VN") ?? null,
            to: filtersState.dateRange.to?.toLocaleDateString("vi-VN") ?? null,
          }
        : null,
    }),
    [filtersState.dateRange, filtersState.statusFilter],
  )

  const filterModalValue = React.useMemo<FilterModalValue>(
    () => ({
      statuses: filtersState.statusFilter,
      dateRange: filtersState.dateRange,
    }),
    [filtersState.dateRange, filtersState.statusFilter],
  )

  const setFilterModalValue = React.useCallback(
    (value: FilterModalValue) => {
      filtersState.setStatusFilter(value.statuses)
      filtersState.setDateRange(value.dateRange ?? null)
    },
    [filtersState],
  )

  const openTransferFromAlert = React.useCallback(
    (transfer: TransferRequest) => {
      rowActions.openDetailTransfer(transfer)
    },
    [rowActions.openDetailTransfer],
  )

  return {
    activeTab,
    setActiveTab,
    transferCounts,
    kanbanData,
    isCountsLoading: isPageDataLoading,
    isCountsError: isPageDataError,
    filtersState,
    filterChipsValue,
    filterModalValue,
    setFilterModalValue,
    filterVariant: isMobile ? "sheet" : "dialog",
    isAddDialogOpen,
    setIsAddDialogOpen,
    invalidateTransferQueries,
    rowActions,
    openTransferFromAlert,
    viewMode,
    userRole,
    isRegionalLeader,
    isReturning,
    showFacilityFilter,
    shouldFetchData,
    tableData,
    isListLoading: isPageDataLoading,
    isListFetching: isPageDataFetching,
    totalCount,
    referenceDate,
    filters,
    columns,
    table,
    transferPagination,
  }
}
