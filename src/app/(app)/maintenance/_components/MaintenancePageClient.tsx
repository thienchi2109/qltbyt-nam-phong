"use client"

import * as React from "react"
import type { PaginationState, SortingState } from "@tanstack/react-table"
import { useQuery } from "@tanstack/react-query"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { useIsMobile } from "@/hooks/use-mobile"
import { callRpc } from "@/lib/rpc-client"
import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import { useMaintenancePlans } from "@/hooks/use-cached-maintenance"
import { useMaintenancePlanCounts } from "@/hooks/useMaintenancePlanCounts"
import type { FacilityOption } from "@/types/tenant"
import { useFeatureFlag } from "@/lib/feature-flags"
import { useSearchDebounce } from "@/hooks/use-debounce"

import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"
import { useMaintenanceDeepLink } from "../_hooks/use-maintenance-deep-link"
import { useSelectedPlanSync } from "../_hooks/use-selected-plan-sync"
import { MobileMaintenanceLayout } from "./mobile-maintenance-layout"
import { usePlanColumns, useTaskColumns } from "./maintenance-columns"
import { MaintenanceDialogs } from "./maintenance-dialogs"
import { MaintenancePageDesktopContent } from "./maintenance-page-desktop-content"
import { MaintenancePageLegacyMobileCards } from "./maintenance-page-legacy-mobile-cards"
import { toMaintenanceTaskRowId } from "./maintenance-task-row-id"

export function MaintenancePageClient() {
  const ctx = useMaintenanceContext()
  const isMobile = useIsMobile()
  const mobileMaintenanceEnabled = useFeatureFlag("mobile-maintenance-redesign")
  const shouldUseMobileMaintenance = isMobile && mobileMaintenanceEnabled

  const [planSearchTerm, setPlanSearchTerm] = React.useState("")
  const debouncedPlanSearch = useSearchDebounce(planSearchTerm)
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)
  const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = React.useState(false)
  const [pendingFacilityFilter, setPendingFacilityFilter] = React.useState<number | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Record<number, boolean>>({})

  const [planSorting, setPlanSorting] = React.useState<SortingState>([])
  const [taskPagination, setTaskPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { taskRowSelection, setTaskRowSelection } = ctx
  const { setIsAddPlanDialogOpen, setSelectedPlan, setActiveTab } = ctx

  const { data: paginatedResponse, isLoading: isLoadingPlans } = useMaintenancePlans({
    search: debouncedPlanSearch || undefined,
    facilityId: selectedFacilityId,
    page: currentPage,
    pageSize,
  })
  const { counts: statusCounts, isLoading: isCountsLoading, isError: isCountsError } =
    useMaintenancePlanCounts({
      facilityId: selectedFacilityId,
      search: debouncedPlanSearch || undefined,
    })

  const plans = React.useMemo(() => paginatedResponse?.data ?? [], [paginatedResponse?.data])
  const totalCount = paginatedResponse?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)
  const showFacilityFilter = isGlobalRole(ctx.user?.role) || isRegionalLeaderRole(ctx.user?.role)

  const {
    data: facilities = [],
    isLoading: isLoadingFacilities,
    error: facilitiesError,
  } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["maintenance", "facilities", ctx.user?.role ?? null],
    queryFn: async () => {
      const result = await callRpc<FacilityOption[]>({
        fn: "get_facilities_with_equipment_count",
        args: {},
      })

      return (result || []).map((facility) => ({
        id: Number(facility.id),
        name: String(facility.name || `Cơ sở ${facility.id}`),
      }))
    },
    enabled: showFacilityFilter,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  React.useEffect(() => {
    if (facilitiesError) {
      console.error("[Maintenance] Failed to fetch facilities:", facilitiesError)
    }
  }, [facilitiesError])

  const activeMobileFilterCount = React.useMemo(() => {
    let count = 0
    if (selectedFacilityId) {
      count += 1
    }
    return count
  }, [selectedFacilityId])

  const clearTaskRowSelection = React.useCallback(() => {
    setTaskRowSelection((previousSelection) =>
      Object.keys(previousSelection).length === 0 ? previousSelection : {}
    )
  }, [setTaskRowSelection])

  // Deep-link resolution (URL → select plan / open dialog)
  useMaintenanceDeepLink({
    plans,
    isLoadingPlans,
    setIsAddPlanDialogOpen,
    setSelectedPlan,
    setActiveTab,
  })

  // Sync side-effects when selected plan changes (fetch tasks, clear selection)
  useSelectedPlanSync({
    selectedPlan: ctx.selectedPlan,
    fetchPlanDetails: ctx.fetchPlanDetails,
    clearTaskRowSelection,
  })

  React.useEffect(() => {
    setCurrentPage(1)
  }, [selectedFacilityId, debouncedPlanSearch])

  React.useEffect(() => {
    if (isMobileFilterSheetOpen) {
      setPendingFacilityFilter(selectedFacilityId ?? null)
    }
  }, [isMobileFilterSheetOpen, selectedFacilityId])

  React.useEffect(() => {
    if (ctx.selectedPlan?.id) {
      setExpandedTaskIds({})
    }
  }, [ctx.selectedPlan?.id])

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

  const handlePageSizeChange = React.useCallback((size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }, [])

  const toggleTaskExpansion = React.useCallback((taskId: number) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }, [])

  const planColumns = usePlanColumns({
    sorting: planSorting,
    setSorting: setPlanSorting,
    onRowClick: ctx.handleSelectPlan,
    openApproveDialog: ctx.operations.openApproveDialog,
    openRejectDialog: ctx.operations.openRejectDialog,
    openDeleteDialog: ctx.operations.openDeleteDialog,
    setEditingPlan: ctx.setEditingPlan,
    canManagePlans: ctx.canManagePlans,
    isRegionalLeader: ctx.isRegionalLeader,
  })

  const planTable = useReactTable({
    data: plans,
    columns: planColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setPlanSorting,
    state: {
      sorting: planSorting,
    },
    manualPagination: true,
    pageCount: totalPages,
  })

  const tableMeta = React.useMemo(
    () => ({
      editingTaskId: ctx.taskEditing.editingTaskId,
      editingTaskData: ctx.taskEditing.editingTaskData,
      isPlanApproved: ctx.isPlanApproved,
      setTaskToDelete: ctx.taskEditing.setTaskToDelete,
      handleTaskDataChange: ctx.taskEditing.handleTaskDataChange,
      handleSaveTask: ctx.taskEditing.handleSaveTask,
      handleCancelEdit: ctx.taskEditing.handleCancelEdit,
      handleStartEdit: ctx.taskEditing.handleStartEdit,
      completionStatus: ctx.completionStatus,
      isLoadingCompletion: ctx.isLoadingCompletion,
      handleMarkAsCompleted: ctx.handleMarkAsCompleted,
      isCompletingTask: ctx.isCompletingTask,
      canCompleteTask: ctx.canCompleteTask,
    }),
    [
      ctx.taskEditing.editingTaskId,
      ctx.taskEditing.editingTaskData,
      ctx.isPlanApproved,
      ctx.taskEditing.setTaskToDelete,
      ctx.taskEditing.handleTaskDataChange,
      ctx.taskEditing.handleSaveTask,
      ctx.taskEditing.handleCancelEdit,
      ctx.taskEditing.handleStartEdit,
      ctx.completionStatus,
      ctx.isLoadingCompletion,
      ctx.handleMarkAsCompleted,
      ctx.isCompletingTask,
      ctx.canCompleteTask,
    ]
  )

  const taskColumns = useTaskColumns({
    editingTaskId: ctx.taskEditing.editingTaskId,
    handleStartEdit: ctx.taskEditing.handleStartEdit,
    handleCancelEdit: ctx.taskEditing.handleCancelEdit,
    handleTaskDataChange: ctx.taskEditing.handleTaskDataChange,
    handleSaveTask: ctx.taskEditing.handleSaveTask,
    setTaskToDelete: ctx.taskEditing.setTaskToDelete,
    canManagePlans: ctx.canManagePlans,
    isPlanApproved: ctx.isPlanApproved,
    canCompleteTask: ctx.canCompleteTask,
    handleMarkAsCompleted: ctx.handleMarkAsCompleted,
    isCompletingTask: ctx.isCompletingTask,
    completionStatus: ctx.completionStatus,
    isLoadingCompletion: ctx.isLoadingCompletion,
    selectedPlan: ctx.selectedPlan,
  })

  const taskTable = useReactTable({
    data: ctx.draftTasks,
    columns: taskColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => toMaintenanceTaskRowId(row.id),
    onPaginationChange: setTaskPagination,
    onRowSelectionChange: setTaskRowSelection,
    state: {
      pagination: taskPagination,
      rowSelection: taskRowSelection,
    },
    meta: tableMeta,
  })

  const legacyMobileCards = (
    <MaintenancePageLegacyMobileCards
      isLoading={isLoadingPlans}
      plans={planTable.getRowModel().rows.map((row) => row.original)}
      canManagePlans={ctx.canManagePlans}
      onSelectPlan={ctx.handleSelectPlan}
      onOpenApproveDialog={ctx.operations.openApproveDialog}
      onOpenRejectDialog={ctx.operations.openRejectDialog}
      onOpenDeleteDialog={ctx.operations.openDeleteDialog}
      onEditPlan={ctx.setEditingPlan}
    />
  )

  if (shouldUseMobileMaintenance) {
    return (
      <>
        <MaintenanceDialogs />
        <MobileMaintenanceLayout
          statusCounts={statusCounts}
          isCountsLoading={isCountsLoading}
          isCountsError={isCountsError}
          plans={plans}
          isLoadingPlans={isLoadingPlans}
          planSearchTerm={planSearchTerm}
          setPlanSearchTerm={setPlanSearchTerm}
          onClearSearch={() => setPlanSearchTerm("")}
          totalPages={totalPages}
          totalCount={totalCount}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          showFacilityFilter={showFacilityFilter}
          facilities={facilities}
          selectedFacilityId={selectedFacilityId}
          isLoadingFacilities={isLoadingFacilities}
          isMobileFilterSheetOpen={isMobileFilterSheetOpen}
          setIsMobileFilterSheetOpen={setIsMobileFilterSheetOpen}
          pendingFacilityFilter={pendingFacilityFilter}
          setPendingFacilityFilter={setPendingFacilityFilter}
          handleMobileFilterApply={handleMobileFilterApply}
          handleMobileFilterClear={handleMobileFilterClear}
          activeMobileFilterCount={activeMobileFilterCount}
          expandedTaskIds={expandedTaskIds}
          toggleTaskExpansion={toggleTaskExpansion}
        />
      </>
    )
  }

  return (
    <>
      <MaintenanceDialogs />
      <MaintenancePageDesktopContent
        statusCounts={statusCounts}
        isCountsLoading={isCountsLoading}
        isCountsError={isCountsError}
        showFacilityFilter={showFacilityFilter}
        facilities={facilities}
        selectedFacilityId={selectedFacilityId}
        onFacilityChange={setSelectedFacilityId}
        isLoadingFacilities={isLoadingFacilities}
        totalCount={totalCount}
        planSearchTerm={planSearchTerm}
        onPlanSearchChange={setPlanSearchTerm}
        isMobile={isMobile}
        mobilePlanCards={legacyMobileCards}
        planTable={planTable}
        planColumns={planColumns}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        plans={plans}
        isLoadingPlans={isLoadingPlans}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
        isFiltered={Boolean(debouncedPlanSearch || selectedFacilityId)}
        taskTable={taskTable}
        taskColumns={taskColumns}
      />
    </>
  )
}
