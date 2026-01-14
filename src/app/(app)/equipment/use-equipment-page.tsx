"use client"

import * as React from "react"
import { useTenantBranding } from "@/hooks/use-tenant-branding"
import { useToast } from "@/hooks/use-toast"
import { createEquipmentColumns } from "@/components/equipment/equipment-table-columns"
import { EquipmentActionsMenu } from "@/components/equipment/equipment-actions-menu"

// Import extracted hooks
import { useEquipmentAuth } from "./_hooks/useEquipmentAuth"
import { useEquipmentFilters } from "./_hooks/useEquipmentFilters"
import { useEquipmentData } from "./_hooks/useEquipmentData"
import { useEquipmentTable } from "./_hooks/useEquipmentTable"
import { useEquipmentExport } from "./_hooks/useEquipmentExport"
import { useEquipmentRouteSync } from "./_hooks/useEquipmentRouteSync"

// Re-export types from centralized types file
export type {
  Equipment,
  SessionUser,
  FilterBottomSheetData,
  FacilityOption,
} from "./types"

// Re-export hook return type
export type { UseEquipmentPageReturn } from "./types"

import type { Equipment, UsageLog } from "./types"
import type { UseEquipmentPageReturn } from "./types"

export function useEquipmentPage(): UseEquipmentPageReturn {
  const { toast } = useToast()
  const { data: tenantBranding } = useTenantBranding()

  // Compose extracted hooks
  const auth = useEquipmentAuth()
  const filters = useEquipmentFilters()

  // Create pagination state for data hook coordination
  // Note: This is the source of truth for pagination. The table hook syncs to this.
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

  // Data hook needs params from auth and filters
  // Use explicit property dependencies instead of entire objects for better memoization
  const dataParams = React.useMemo(
    () => ({
      isGlobal: auth.isGlobal,
      isRegionalLeader: auth.isRegionalLeader,
      userRole: auth.user?.role || "user",
      shouldFetchEquipment: auth.shouldFetchEquipment,
      effectiveTenantKey: auth.effectiveTenantKey,
      selectedDonVi: auth.selectedDonVi,
      currentTenantId: auth.currentTenantId,
      debouncedSearch: filters.debouncedSearch,
      sortParam: filters.sortParam,
      pagination,
      selectedDepartments: filters.selectedDepartments,
      selectedUsers: filters.selectedUsers,
      selectedLocations: filters.selectedLocations,
      selectedStatuses: filters.selectedStatuses,
      selectedClassifications: filters.selectedClassifications,
    }),
    [
      auth.isGlobal,
      auth.isRegionalLeader,
      auth.user?.role,
      auth.shouldFetchEquipment,
      auth.effectiveTenantKey,
      auth.selectedDonVi,
      auth.currentTenantId,
      filters.debouncedSearch,
      filters.sortParam,
      pagination,
      filters.selectedDepartments,
      filters.selectedUsers,
      filters.selectedLocations,
      filters.selectedStatuses,
      filters.selectedClassifications,
    ]
  )

  // Data hook with pagination state
  const data = useEquipmentData({
    ...dataParams,
    pagination,
  })

  // Route sync hook - defined before renderActions which uses routeSync.router
  const routeSync = useEquipmentRouteSync({ data: data.data })

  // Render actions helper (needed for columns)
  const renderActions = React.useCallback(
    (equipment: Equipment) => (
      <EquipmentActionsMenu
        equipment={equipment}
        user={auth.user}
        isRegionalLeader={auth.isRegionalLeader}
        activeUsageLogs={data.activeUsageLogs}
        isLoadingActiveUsage={data.isLoadingActiveUsage}
        onShowDetails={(eq) => {
          setSelectedEquipment(eq)
          setIsDetailModalOpen(true)
        }}
        onStartUsage={(eq) => {
          setStartUsageEquipment(eq)
          setIsStartUsageDialogOpen(true)
        }}
        onEndUsage={(usage) => {
          setEndUsageLog(usage)
          setIsEndUsageDialogOpen(true)
        }}
        onCreateRepairRequest={(eq) =>
          routeSync.router.push(`/repair-requests?equipmentId=${eq.id}`)
        }
      />
    ),
    [auth.user, auth.isRegionalLeader, data.activeUsageLogs, data.isLoadingActiveUsage, routeSync.router]
  )

  // Columns definition
  const columns = React.useMemo(
    () => createEquipmentColumns({ renderActions }),
    [renderActions]
  )

  // Table hook
  const table = useEquipmentTable({
    data: data.data,
    total: data.total,
    columns,
    sorting: filters.sorting,
    setSorting: filters.setSorting,
    columnFilters: filters.columnFilters,
    setColumnFilters: filters.setColumnFilters,
    debouncedSearch: filters.debouncedSearch,
    searchTerm: filters.searchTerm,
    setSearchTerm: filters.setSearchTerm,
    selectedDonVi: auth.selectedDonVi,
    selectedFacilityId: data.selectedFacilityId,
  })

  // Sync pagination state with table
  React.useEffect(() => {
    setPagination(table.pagination)
  }, [table.pagination])

  // Export hook
  const exports = useEquipmentExport({
    data: data.data,
    tenantBranding: tenantBranding ?? undefined,
    userRole: auth.user?.role,
  })

  // Dialog state (temporary - will move to context in Phase 5)
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = React.useState(false)
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | null>(null)
  const [selectedEquipment, setSelectedEquipment] = React.useState<Equipment | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false)
  const [isStartUsageDialogOpen, setIsStartUsageDialogOpen] = React.useState(false)
  const [startUsageEquipment, setStartUsageEquipment] = React.useState<Equipment | null>(null)
  const [isEndUsageDialogOpen, setIsEndUsageDialogOpen] = React.useState(false)
  const [endUsageLog, setEndUsageLog] = React.useState<UsageLog | null>(null)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)
  const [isColumnsDialogOpen, setIsColumnsDialogOpen] = React.useState(false)

  // Facility sheet state
  const [isFacilitySheetOpen, setIsFacilitySheetOpen] = React.useState(false)
  const [pendingFacilityId, setPendingFacilityId] = React.useState<number | null>(null)

  // Handle route sync pending actions
  React.useEffect(() => {
    if (!routeSync.pendingAction) return

    if (routeSync.pendingAction.type === "openAdd") {
      setIsAddDialogOpen(true)
      routeSync.clearPendingAction()
    } else if (routeSync.pendingAction.type === "openDetail" && routeSync.pendingAction.equipment) {
      setSelectedEquipment(routeSync.pendingAction.equipment)
      setIsDetailModalOpen(true)
      routeSync.clearPendingAction()
    }
  }, [routeSync.pendingAction, routeSync.clearPendingAction])

  // Tenant change effect: clear filters + show toast
  const prevTenantFilterRef = React.useRef(auth.tenantFilter)
  React.useEffect(() => {
    if (!auth.isGlobal) return
    if (prevTenantFilterRef.current === auth.tenantFilter) return

    prevTenantFilterRef.current = auth.tenantFilter
    filters.resetFilters()

    // Show toast for tenant change
    if (auth.selectedDonVi !== null) {
      const selectedTenant = data.tenantOptions.find((t) => t.id === auth.selectedDonVi)
      const tenantName = selectedTenant
        ? selectedTenant.name
        : `Đơn vị ${auth.selectedDonVi}`
      toast({
        variant: "default",
        title: "✅ Đã áp dụng bộ lọc đơn vị",
        description: `Hiển thị thiết bị thuộc ${tenantName}`,
      })
    }
  }, [auth.tenantFilter, auth.isGlobal, auth.selectedDonVi, filters.resetFilters, data.tenantOptions, toast])

  // Sync pending facility when sheet opens
  React.useEffect(() => {
    if (isFacilitySheetOpen) {
      setPendingFacilityId(data.selectedFacilityId ?? null)
    }
  }, [isFacilitySheetOpen, data.selectedFacilityId])

  // Facility handlers
  const handleFacilityApply = React.useCallback(() => {
    data.setSelectedFacilityId(pendingFacilityId ?? null)
    if (auth.isGlobal && pendingFacilityId) {
      auth.setTenantFilter(String(pendingFacilityId))
    } else if (auth.isGlobal) {
      auth.setTenantFilter("all")
    }
    setIsFacilitySheetOpen(false)
  }, [pendingFacilityId, data.setSelectedFacilityId, auth.isGlobal, auth.setTenantFilter])

  const handleFacilityClear = React.useCallback(() => {
    setPendingFacilityId(null)
    data.setSelectedFacilityId(null)
    if (auth.isGlobal) {
      auth.setTenantFilter("all")
    }
    setIsFacilitySheetOpen(false)
  }, [data.setSelectedFacilityId, auth.isGlobal, auth.setTenantFilter])

  const handleFacilityCancel = React.useCallback(() => {
    setPendingFacilityId(data.selectedFacilityId ?? null)
    setIsFacilitySheetOpen(false)
  }, [data.selectedFacilityId])

  // Dialog handlers
  const handleShowDetails = React.useCallback((equipment: Equipment) => {
    setSelectedEquipment(equipment)
    setIsDetailModalOpen(true)
  }, [])

  const handleStartUsage = React.useCallback((equipment: Equipment) => {
    setStartUsageEquipment(equipment)
    setIsStartUsageDialogOpen(true)
  }, [])

  const handleEndUsage = React.useCallback((usage: UsageLog) => {
    setEndUsageLog(usage)
    setIsEndUsageDialogOpen(true)
  }, [])

  // Mutation success handlers
  const onDataMutationSuccess = React.useCallback(() => {
    data.invalidateEquipmentForCurrentTenant()
  }, [data.invalidateEquipmentForCurrentTenant])

  const onDataMutationSuccessWithStatePreservation = React.useCallback(() => {
    const currentState = table.table.getState()
    table.setPreservePageState({
      pageIndex: currentState.pagination.pageIndex,
      pageSize: currentState.pagination.pageSize,
    })
    onDataMutationSuccess()
  }, [table.table, table.setPreservePageState, onDataMutationSuccess])

  // Computed values
  const hasFacilityFilter = data.showFacilityFilter && data.selectedFacilityId !== null

  // Memoized return value for performance
  return React.useMemo<UseEquipmentPageReturn>(
    () => ({
      // Session/Auth
      user: auth.user,
      status: auth.status,
      isGlobal: auth.isGlobal,
      isRegionalLeader: auth.isRegionalLeader,

      // Router
      router: routeSync.router,

      // Data
      data: data.data,
      total: data.total,
      isLoading: data.isLoading,
      isFetching: data.isFetching,
      shouldFetchEquipment: auth.shouldFetchEquipment,

      // Table
      table: table.table,
      columns,
      pagination: table.pagination,
      setPagination: table.setPagination,
      pageCount: table.pageCount,
      columnVisibility: table.columnVisibility,
      setColumnVisibility: table.setColumnVisibility,

      // Filters
      searchTerm: filters.searchTerm,
      setSearchTerm: filters.setSearchTerm,
      columnFilters: filters.columnFilters,
      setColumnFilters: filters.setColumnFilters,
      isFiltered: table.isFiltered,

      // Filter options
      departments: data.departments,
      users: data.users,
      statuses: data.statuses,
      classifications: data.classifications,
      filterData: data.filterData,

      // Facility filter
      showFacilityFilter: data.showFacilityFilter,
      facilities: data.facilities,
      selectedFacilityId: data.selectedFacilityId,
      setSelectedFacilityId: data.setSelectedFacilityId,
      activeFacility: data.activeFacility,
      hasFacilityFilter,
      isFacilitiesLoading: data.isFacilitiesLoading,

      // Facility sheet
      isFacilitySheetOpen,
      setIsFacilitySheetOpen,
      pendingFacilityId,
      setPendingFacilityId,
      handleFacilityApply,
      handleFacilityClear,
      handleFacilityCancel,

      // Dialogs
      isAddDialogOpen,
      setIsAddDialogOpen,
      isImportDialogOpen,
      setIsImportDialogOpen,
      editingEquipment,
      setEditingEquipment,
      selectedEquipment,
      setSelectedEquipment,
      isDetailModalOpen,
      setIsDetailModalOpen,
      isStartUsageDialogOpen,
      setIsStartUsageDialogOpen,
      startUsageEquipment,
      setStartUsageEquipment,
      isEndUsageDialogOpen,
      setIsEndUsageDialogOpen,
      endUsageLog,
      setEndUsageLog,

      // Filter sheet
      isFilterSheetOpen,
      setIsFilterSheetOpen,

      // Columns dialog
      isColumnsDialogOpen,
      setIsColumnsDialogOpen,

      // Handlers
      handleShowDetails,
      handleStartUsage,
      handleEndUsage,
      handleDownloadTemplate: exports.handleDownloadTemplate,
      handleExportData: exports.handleExportData,
      handleGenerateProfileSheet: exports.handleGenerateProfileSheet,
      handleGenerateDeviceLabel: exports.handleGenerateDeviceLabel,
      onDataMutationSuccess,
      onDataMutationSuccessWithStatePreservation,

      // UI state
      isMobile: table.isMobile,
      isCardView: table.isCardView,
      useTabletFilters: table.useTabletFilters,

      // Branding
      tenantBranding: tenantBranding ?? undefined,
    }),
    [
      auth,
      routeSync.router,
      data,
      table,
      columns,
      filters,
      hasFacilityFilter,
      isFacilitySheetOpen,
      pendingFacilityId,
      handleFacilityApply,
      handleFacilityClear,
      handleFacilityCancel,
      isAddDialogOpen,
      isImportDialogOpen,
      editingEquipment,
      selectedEquipment,
      isDetailModalOpen,
      isStartUsageDialogOpen,
      startUsageEquipment,
      isEndUsageDialogOpen,
      endUsageLog,
      isFilterSheetOpen,
      isColumnsDialogOpen,
      handleShowDetails,
      handleStartUsage,
      handleEndUsage,
      exports,
      onDataMutationSuccess,
      onDataMutationSuccessWithStatePreservation,
      tenantBranding,
    ]
  )
}
