"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import type { SortingState, PaginationState } from "@tanstack/react-table"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Check,
  Edit,
  FileText,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Save,
  Trash2,
  Undo2,
  X,
} from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
import { callRpc } from "@/lib/rpc-client"
import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useMaintenancePlans } from "@/hooks/use-cached-maintenance"
import { useFeatureFlag } from "@/lib/feature-flags"
import { useSearchDebounce } from "@/hooks/use-debounce"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"
import { MobileMaintenanceLayout } from "./mobile-maintenance-layout"
import { PlanFiltersBar } from "./plan-filters-bar"
import { PlansTable } from "./plans-table"
import { TasksTable } from "./tasks-table"
import { usePlanColumns, useTaskColumns } from "./maintenance-columns"
import { MaintenanceDialogs } from "./maintenance-dialogs"

// ============================================
// Helper Functions
// ============================================

const getStatusVariant = (status: MaintenancePlan["trang_thai"]) => {
  switch (status) {
    case "Bản nháp":
      return "secondary"
    case "Đã duyệt":
      return "default"
    case "Không duyệt":
      return "destructive"
    default:
      return "outline"
  }
}

// ============================================
// Main Component
// ============================================

export function MaintenancePageClient() {
  const ctx = useMaintenanceContext()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const mobileMaintenanceEnabled = useFeatureFlag("mobile-maintenance-redesign")
  const shouldUseMobileMaintenance = isMobile && mobileMaintenanceEnabled

  // ============================================
  // LOCAL State: Server-side pagination & filtering
  // ============================================
  const [planSearchTerm, setPlanSearchTerm] = React.useState("")
  const debouncedPlanSearch = useSearchDebounce(planSearchTerm)
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<number | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(50)
  const [isMobileFilterSheetOpen, setIsMobileFilterSheetOpen] = React.useState(false)
  const [pendingFacilityFilter, setPendingFacilityFilter] = React.useState<number | null>(null)
  const [expandedTaskIds, setExpandedTaskIds] = React.useState<Record<number, boolean>>({})

  // Facilities for dropdown
  const [facilities, setFacilities] = React.useState<Array<{ id: number; name: string }>>([])
  const [isLoadingFacilities, setIsLoadingFacilities] = React.useState(false)

  // Table state
  const [planSorting, setPlanSorting] = React.useState<SortingState>([])
  const [taskPagination, setTaskPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  // Use taskRowSelection from context instead of local state
  const { taskRowSelection, setTaskRowSelection } = ctx

  // ============================================
  // Server-side paginated data hook
  // ============================================
  const { data: paginatedResponse, isLoading: isLoadingPlans, refetch: refetchPlans } = useMaintenancePlans({
    search: debouncedPlanSearch || undefined,
    facilityId: selectedFacilityId,
    page: currentPage,
    pageSize,
  })

  const plans = paginatedResponse?.data ?? []
  const totalCount = paginatedResponse?.total ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // ============================================
  // Fetch facilities for dropdown (role-aware)
  // ============================================
  React.useEffect(() => {
    const canSeeFacilityFilter = isGlobalRole(ctx.user?.role) || isRegionalLeaderRole(ctx.user?.role)
    if (!canSeeFacilityFilter) return

    setIsLoadingFacilities(true)
    callRpc<any[]>({ fn: 'get_facilities_with_equipment_count', args: {} })
      .then((result) => {
        const mapped = (result || []).map((f: any) => ({
          id: Number(f.id),
          name: String(f.name || `Cơ sở ${f.id}`),
        }))
        setFacilities(mapped)
      })
      .catch((err) => {
        console.error('[Maintenance] Failed to fetch facilities:', err)
        setFacilities([])
      })
      .finally(() => setIsLoadingFacilities(false))
  }, [ctx.user?.role])

  const showFacilityFilter = isGlobalRole(ctx.user?.role) || isRegionalLeaderRole(ctx.user?.role)

  const activeMobileFilterCount = React.useMemo(() => {
    let count = 0
    if (selectedFacilityId) count += 1
    return count
  }, [selectedFacilityId])

  // ============================================
  // Effects
  // ============================================

  // Fetch plan details when selected plan changes
  const fetchPlanDetails = ctx.fetchPlanDetails
  React.useEffect(() => {
    if (ctx.selectedPlan) {
      fetchPlanDetails(ctx.selectedPlan)
      setTaskRowSelection({})
    }
  }, [ctx.selectedPlan, fetchPlanDetails, setTaskRowSelection])

  // Handle URL parameters for navigation from Dashboard
  const setIsAddPlanDialogOpen = ctx.setIsAddPlanDialogOpen
  const setSelectedPlan = ctx.setSelectedPlan
  const setActiveTab = ctx.setActiveTab
  React.useEffect(() => {
    const planIdParam = searchParams.get('planId')
    const tabParam = searchParams.get('tab')
    const actionParam = searchParams.get('action')

    if (actionParam === 'create') {
      setIsAddPlanDialogOpen(true)
      window.history.replaceState({}, '', '/maintenance')
      return
    }

    if (planIdParam && plans.length > 0) {
      const planId = parseInt(planIdParam, 10)
      const targetPlan = plans.find(p => p.id === planId)

      if (targetPlan) {
        setSelectedPlan(targetPlan)
        if (tabParam === 'tasks') {
          setActiveTab('tasks')
        }
        window.history.replaceState({}, '', '/maintenance')
      }
    }
  }, [searchParams, plans, setIsAddPlanDialogOpen, setSelectedPlan, setActiveTab])

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [selectedFacilityId, debouncedPlanSearch])

  // Sync pending filter with selected filter when sheet opens
  React.useEffect(() => {
    if (isMobileFilterSheetOpen) {
      setPendingFacilityFilter(selectedFacilityId ?? null)
    }
  }, [isMobileFilterSheetOpen, selectedFacilityId])

  // Reset expanded task IDs when plan changes
  React.useEffect(() => {
    if (ctx.selectedPlan?.id) {
      setExpandedTaskIds({})
    }
  }, [ctx.selectedPlan?.id])

  // ============================================
  // Handlers
  // ============================================

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

  const toggleTaskExpansion = React.useCallback((taskId: number) => {
    setExpandedTaskIds(prev => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }, [])

  // ============================================
  // TanStack Table: Plan Columns
  // ============================================
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

  // TanStack Table: Plans (server-side pagination)
  const planTable = useReactTable({
    data: plans as MaintenancePlan[],
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

  // ============================================
  // TanStack Table: Task Columns
  // ============================================
  const tableMeta = React.useMemo(() => ({
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
  }), [
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
  ])

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

  // TanStack Table: Tasks (client-side pagination)
  const taskTable = useReactTable({
    data: ctx.draftTasks,
    columns: taskColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setTaskPagination,
    onRowSelectionChange: setTaskRowSelection,
    state: {
      pagination: taskPagination,
      rowSelection: taskRowSelection,
    },
    meta: tableMeta,
  })

  // selectedTaskRowsCount is now from context (ctx.selectedTaskRowsCount)

  // ============================================
  // Mobile Cards Rendering
  // ============================================
  const renderMobileCards = () => {
    if (isLoadingPlans) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="mobile-card-spacing">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (!planTable.getRowModel().rows?.length) {
      return (
        <Card className="mobile-card-spacing">
          <CardContent className="flex items-center justify-center h-24">
            <p className="text-muted-foreground text-center">Chưa có kế hoạch nào.</p>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-4">
        {planTable.getRowModel().rows.map((row) => {
          const plan = row.original
          return (
            <Card
              key={plan.id}
              className="mobile-card-spacing cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => ctx.handleSelectPlan(plan)}
            >
              <CardHeader className="flex flex-row items-start justify-between pb-4 mobile-interactive">
                <div className="max-w-[calc(100%-40px)]">
                  <CardTitle className="heading-responsive-h4 font-bold leading-tight truncate">
                    {plan.ten_ke_hoach}
                  </CardTitle>
                  <CardDescription className="body-responsive-sm">
                    Năm {plan.nam} - {plan.khoa_phong || "Tổng thể"}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" className="h-8 w-8 p-0 touch-target-sm">
                      <span className="sr-only">Mở menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => ctx.handleSelectPlan(plan)}>
                      Xem chi tiết công việc
                    </DropdownMenuItem>
                    {plan.trang_thai === 'Bản nháp' && ctx.canManagePlans && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => ctx.operations.openApproveDialog(plan)}>
                          <Check className="mr-2 h-4 w-4" />
                          Duyệt
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => ctx.operations.openRejectDialog(plan)}>
                          <X className="mr-2 h-4 w-4" />
                          Không duyệt
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => ctx.setEditingPlan(plan)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onSelect={() => ctx.operations.openDeleteDialog(plan)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Xóa
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="body-responsive-sm space-y-3 mobile-interactive">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Loại công việc:</span>
                  <Badge variant="outline">{plan.loai_cong_viec}</Badge>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Trạng thái:</span>
                  <Badge variant={getStatusVariant(plan.trang_thai)}>{plan.trang_thai}</Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // ============================================
  // Dialogs Content
  // ============================================
  const modalContent = <MaintenanceDialogs />

  // ============================================
  // Mobile Layout
  // ============================================
  if (shouldUseMobileMaintenance) {
    return (
      <>
        {modalContent}
        <MobileMaintenanceLayout
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

  // ============================================
  // Desktop Layout
  // ============================================
  return (
    <>
      {modalContent}

      <Tabs value={ctx.activeTab} onValueChange={ctx.setActiveTab}>
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="plans">Lập Kế hoạch</TabsTrigger>
            <TabsTrigger value="tasks" disabled={!ctx.selectedPlan}>Danh sách TB trong Kế hoạch</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="plans" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center">
              <div className="grid gap-2">
                <CardTitle>Danh sách Kế hoạch</CardTitle>
                <CardDescription>
                  Quản lý các kế hoạch bảo trì, hiệu chuẩn, kiểm định. Nhấp vào một hàng để xem chi tiết.
                </CardDescription>
              </div>
              {ctx.canManagePlans && (
                <Button size="sm" className="h-8 gap-1 ml-auto" onClick={() => ctx.setIsAddPlanDialogOpen(true)}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Tạo kế hoạch mới
                  </span>
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <PlanFiltersBar
                showFacilityFilter={showFacilityFilter}
                facilities={facilities}
                selectedFacilityId={selectedFacilityId}
                onFacilityChange={setSelectedFacilityId}
                isLoadingFacilities={isLoadingFacilities}
                totalCount={totalCount}
                searchTerm={planSearchTerm}
                onSearchChange={setPlanSearchTerm}
                isRegionalLeader={ctx.isRegionalLeader}
              />

              {isMobile ? (
                renderMobileCards()
              ) : (
                <PlansTable
                  table={planTable}
                  columns={planColumns}
                  isLoading={isLoadingPlans}
                  onRowClick={ctx.handleSelectPlan}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  displayCount={plans.length}
                  isFiltered={!!(debouncedPlanSearch || selectedFacilityId)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <CardTitle>Danh sách Thiết bị trong Kế hoạch: {ctx.selectedPlan?.ten_ke_hoach || '...'}</CardTitle>
                  <CardDescription className="mt-1">
                    {ctx.isPlanApproved
                      ? 'Kế hoạch đã được duyệt. Nhấp vào các ô checkbox để ghi nhận hoàn thành công việc theo thực tế.'
                      : 'Chế độ nháp: Mọi thay đổi được lưu tạm thời. Nhấn "Lưu thay đổi" để cập nhật vào cơ sở dữ liệu hoặc "Hủy bỏ" để loại bỏ các thay đổi chưa lưu.'
                    }
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {ctx.hasChanges && !ctx.isPlanApproved && ctx.canManagePlans && (
                    <>
                      <Button variant="outline" onClick={() => ctx.setIsConfirmingCancel(true)} disabled={ctx.isSavingAll}>
                        <Undo2 className="mr-2 h-4 w-4" />
                        Hủy bỏ
                      </Button>
                      <Button onClick={ctx.handleSaveAllChanges} disabled={ctx.isSavingAll || !ctx.canManagePlans}>
                        {ctx.isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Lưu thay đổi
                      </Button>
                    </>
                  )}
                  {ctx.tasks.length > 0 && !ctx.isRegionalLeader && (
                    <Button
                      variant="secondary"
                      onClick={ctx.generatePlanForm}
                      disabled={!!ctx.taskEditing.editingTaskId || ctx.isSavingAll}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Xuất phiếu KH
                    </Button>
                  )}
                  {!ctx.isPlanApproved && ctx.canManagePlans && (
                    <Button
                      onClick={() => ctx.setIsAddTasksDialogOpen(true)}
                      disabled={!!ctx.taskEditing.editingTaskId || ctx.isSavingAll}
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Thêm thiết bị
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {ctx.isLoadingTasks ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <TasksTable
                  table={taskTable}
                  columns={taskColumns}
                  editingTaskId={ctx.taskEditing.editingTaskId}
                  totalCount={ctx.draftTasks.length}
                  selectedCount={ctx.selectedTaskRowsCount}
                  showBulkActions={!ctx.isPlanApproved && ctx.canManagePlans}
                  onBulkSchedule={() => ctx.setIsBulkScheduleOpen(true)}
                  onBulkAssignUnit={ctx.handleBulkAssignUnit}
                  onBulkDelete={() => ctx.setIsConfirmingBulkDelete(true)}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
