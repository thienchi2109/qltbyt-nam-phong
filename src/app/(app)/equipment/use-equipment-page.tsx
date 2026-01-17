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
      userDiaBanId: auth.user?.dia_ban_id,
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
      // Pass context values from auth hook
      selectedFacilityId: auth.selectedFacilityId,
      showSelector: auth.showSelector,
      facilities: auth.facilities,
      isFacilitiesLoading: auth.isFacilitiesLoading,
    }),
    [
      auth.isGlobal,
      auth.isRegionalLeader,
      auth.user?.role,
      auth.user?.dia_ban_id,
      auth.shouldFetchEquipment,
      auth.effectiveTenantKey,
      auth.selectedDonVi,
      auth.currentTenantId,
      auth.selectedFacilityId,
      auth.showSelector,
      auth.facilities,
      auth.isFacilitiesLoading,
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
  // EquipmentActionsMenu now consumes dialog actions from context directly
  const renderActions = React.useCallback(
    (equipment: Equipment) => (
      <EquipmentActionsMenu
        equipment={equipment}
        activeUsageLogs={data.activeUsageLogs}
        isLoadingActiveUsage={data.isLoadingActiveUsage}
      />
    ),
    [data.activeUsageLogs, data.isLoadingActiveUsage]
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
    setSearchTerm: filters.setSearchTerm,
    pagination,
    setPagination,
    selectedDonVi: auth.selectedDonVi,
    selectedFacilityId: data.selectedFacilityId,
  })

  // Export hook
  const exports = useEquipmentExport({
    data: data.data,
    tenantBranding: tenantBranding ?? undefined,
    userRole: auth.user?.role,
  })

  // NOTE: Legacy dialog state removed - now managed by EquipmentDialogContext
  // Route sync pending actions are exposed for handling in page.tsx with context

  // Facility sheet state
  const [isFacilitySheetOpen, setIsFacilitySheetOpen] = React.useState(false)
  const [pendingFacilityId, setPendingFacilityId] = React.useState<number | null>(null)

  // Filter sheet state (not a dialog - stays here)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)

  // Tenant change effect: clear filters + show toast
  // Track by effectiveTenantKey which now uses context's selectedFacilityId
  const prevEffectiveTenantKeyRef = React.useRef(auth.effectiveTenantKey)
  React.useEffect(() => {
    if (!auth.showSelector) return
    if (prevEffectiveTenantKeyRef.current === auth.effectiveTenantKey) return

    prevEffectiveTenantKeyRef.current = auth.effectiveTenantKey
    filters.resetFilters()

    // Show toast for tenant change
    if (auth.selectedDonVi !== null) {
      const selectedTenant = data.tenantOptions.find((t) => t.id === auth.selectedDonVi)
      const tenantName = selectedTenant
        ? selectedTenant.name
        : `Đơn vị ${auth.selectedDonVi}`
      toast({
        variant: "default",
        title: "Da ap dung bo loc don vi",
        description: `Hien thi thiet bi thuoc ${tenantName}`,
      })
    }
  }, [auth.effectiveTenantKey, auth.showSelector, auth.selectedDonVi, filters.resetFilters, data.tenantOptions, toast])

  // Sync pending facility when sheet opens
  React.useEffect(() => {
    if (isFacilitySheetOpen) {
      // Handle undefined as null for pending facility
      setPendingFacilityId(data.selectedFacilityId ?? null)
    }
  }, [isFacilitySheetOpen, data.selectedFacilityId])

  // Facility handlers - now use context's setSelectedFacilityId via auth hook
  const handleFacilityApply = React.useCallback(() => {
    auth.setSelectedFacilityId(pendingFacilityId)
    setIsFacilitySheetOpen(false)
  }, [pendingFacilityId, auth.setSelectedFacilityId])

  const handleFacilityClear = React.useCallback(() => {
    setPendingFacilityId(null)
    auth.setSelectedFacilityId(null)
    setIsFacilitySheetOpen(false)
  }, [auth.setSelectedFacilityId])

  const handleFacilityCancel = React.useCallback(() => {
    // Handle undefined as null for pending facility
    setPendingFacilityId(data.selectedFacilityId ?? null)
    setIsFacilitySheetOpen(false)
  }, [data.selectedFacilityId])

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
  const hasFacilityFilter = data.showFacilityFilter && data.selectedFacilityId !== null && data.selectedFacilityId !== undefined

  // Memoized return value for performance
  return React.useMemo<UseEquipmentPageReturn>(
    () => ({
      // Session/Auth
      user: auth.user,
      status: auth.status,
      isGlobal: auth.isGlobal,
      isRegionalLeader: auth.isRegionalLeader,
      effectiveTenantKey: auth.effectiveTenantKey,

      // Router & Route sync
      router: routeSync.router,
      pendingAction: routeSync.pendingAction,
      clearPendingAction: routeSync.clearPendingAction,

      // Data
      data: data.data,
      total: data.total,
      isLoading: data.isLoading,
      isFetching: data.isFetching,
      shouldFetchEquipment: data.shouldFetchData,

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

      // Facility filter - now from context via auth/data hooks
      showFacilityFilter: data.showFacilityFilter,
      facilities: data.facilities,
      selectedFacilityId: data.selectedFacilityId ?? null,  // Convert undefined to null for return type
      setSelectedFacilityId: auth.setSelectedFacilityId,
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

      // Filter sheet
      isFilterSheetOpen,
      setIsFilterSheetOpen,

      // Handlers
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
      routeSync.pendingAction,
      routeSync.clearPendingAction,
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
      isFilterSheetOpen,
      exports,
      onDataMutationSuccess,
      onDataMutationSuccessWithStatePreservation,
      tenantBranding,
    ]
  )
}
