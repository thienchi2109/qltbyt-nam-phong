"use client"

import * as React from "react"
import type { PaginationState, SortingState } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { useIsMobile } from "@/hooks/use-mobile"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { useMaintenancePlans } from "@/hooks/use-cached-maintenance"
import { useMaintenancePlanCounts } from "@/hooks/useMaintenancePlanCounts"
import { useFeatureFlag } from "@/lib/feature-flags"

import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"
import { useMaintenanceDeepLink } from "../_hooks/use-maintenance-deep-link"
import { useMaintenancePlanListControls } from "../_hooks/use-maintenance-plan-list-controls"
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
  const {
    selectedFacilityId: tenantSelectedFacilityId,
    showSelector: showFacilityFilter,
    shouldFetchData,
  } = useTenantSelection()
  const selectedFacilityId = tenantSelectedFacilityId ?? null

  const {
    planSearchTerm,
    debouncedPlanSearch,
    handlePlanSearchChange,
    handleClearSearch,
    currentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
  } = useMaintenancePlanListControls(tenantSelectedFacilityId)
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
  }, {
    enabled: shouldFetchData,
  })
  const { counts: statusCounts, isLoading: isCountsLoading, isError: isCountsError } =
    useMaintenancePlanCounts({
      facilityId: selectedFacilityId,
      search: debouncedPlanSearch || undefined,
      enabled: shouldFetchData,
    })

  const plans = React.useMemo(() => paginatedResponse?.data ?? [], [paginatedResponse?.data])
  const visiblePlans = React.useMemo(() => shouldFetchData ? plans : [], [plans, shouldFetchData])
  const totalCount = shouldFetchData ? paginatedResponse?.total ?? 0 : 0
  const totalPages = Math.ceil(totalCount / pageSize)
  const visibleStatusCounts = shouldFetchData ? statusCounts : undefined

  const clearTaskRowSelection = React.useCallback(() => {
    setTaskRowSelection((previousSelection) =>
      Object.keys(previousSelection).length === 0 ? previousSelection : {}
    )
  }, [setTaskRowSelection])

  const previousTenantSelection = React.useRef(tenantSelectedFacilityId)
  React.useEffect(() => {
    if (previousTenantSelection.current === tenantSelectedFacilityId) {
      return
    }

    previousTenantSelection.current = tenantSelectedFacilityId
    setSelectedPlan(null)
    setActiveTab("plans")
    ctx.setDraftTasks([])
    clearTaskRowSelection()
  }, [
    tenantSelectedFacilityId,
    setSelectedPlan,
    setActiveTab,
    ctx.setDraftTasks,
    clearTaskRowSelection,
  ])

  // Deep-link resolution (URL → select plan / open dialog)
  useMaintenanceDeepLink({
    plans: visiblePlans,
    isLoadingPlans,
    setIsAddPlanDialogOpen,
    canCreatePlans: ctx.canCreatePlans,
    isCreatePermissionLoading: ctx.isAuthLoading,
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
    if (ctx.selectedPlan?.id) {
      setExpandedTaskIds({})
    }
  }, [ctx.selectedPlan?.id])

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
    data: visiblePlans,
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
          countsState={{ statusCounts: visibleStatusCounts, isCountsLoading, isCountsError }}
          plansState={{
            plans: visiblePlans,
            isLoadingPlans,
            planSearchTerm,
            setPlanSearchTerm: handlePlanSearchChange,
            onClearSearch: handleClearSearch,
          }}
          paginationState={{
            totalPages,
            totalCount,
            currentPage,
            setCurrentPage,
          }}
          filterState={{ showFacilityFilter }}
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
        countsState={{ statusCounts: visibleStatusCounts, isCountsLoading, isCountsError }}
        filterState={{
          showFacilityFilter,
          totalCount,
          planSearchTerm,
          onPlanSearchChange: handlePlanSearchChange,
        }}
        viewportState={{
          isMobile,
          mobilePlanCards: legacyMobileCards,
        }}
        planListState={{
          planTable,
          planColumns,
          currentPage,
          totalPages,
          pageSize,
          plans: visiblePlans,
          isLoadingPlans,
          onPageChange: setCurrentPage,
          onPageSizeChange: handlePageSizeChange,
          isFiltered: Boolean(debouncedPlanSearch || selectedFacilityId),
        }}
        taskListState={{ taskTable, taskColumns }}
      />
    </>
  )
}
