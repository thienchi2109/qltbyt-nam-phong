"use client"

import * as React from "react"
import type { ColumnDef, Table } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Loader2, PlusCircle, Save, Undo2 } from "lucide-react"
import { PlanFiltersBar } from "./plan-filters-bar"
import { PlansTable } from "./plans-table"
import { TasksTable } from "./tasks-table"

interface MaintenancePageDesktopContentProps {
  activeTab: string
  setActiveTab: (value: string) => void
  selectedPlan: MaintenancePlan | null
  canManagePlans: boolean
  isRegionalLeader: boolean
  hasChanges: boolean
  isPlanApproved: boolean
  isSavingAll: boolean
  isLoadingTasks: boolean
  tasks: MaintenanceTask[]
  draftTasks: MaintenanceTask[]
  selectedTaskRowsCount: number
  editingTaskId: number | null

  onOpenAddPlanDialog: () => void
  onOpenCancelConfirm: () => void
  onSaveAllChanges: () => void
  onGeneratePlanForm: () => void
  onOpenAddTasksDialog: () => void
  onOpenBulkSchedule: () => void
  onBulkAssignUnit: (unit: string | null) => void
  onOpenBulkDeleteConfirm: () => void
  onSelectPlan: (plan: MaintenancePlan) => void

  showFacilityFilter: boolean
  facilities: Array<{ id: number; name: string }>
  selectedFacilityId: number | null
  onFacilityChange: (facilityId: number | null) => void
  isLoadingFacilities: boolean
  totalCount: number
  planSearchTerm: string
  onPlanSearchChange: (value: string) => void

  isMobile: boolean
  mobilePlanCards: React.ReactNode

  planTable: Table<MaintenancePlan>
  planColumns: ColumnDef<MaintenancePlan, unknown>[]
  currentPage: number
  totalPages: number
  pageSize: number
  plans: MaintenancePlan[]
  isLoadingPlans: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  isFiltered: boolean

  taskTable: Table<MaintenanceTask>
  taskColumns: ColumnDef<MaintenanceTask, unknown>[]
}

export function MaintenancePageDesktopContent({
  activeTab,
  setActiveTab,
  selectedPlan,
  canManagePlans,
  isRegionalLeader,
  hasChanges,
  isPlanApproved,
  isSavingAll,
  isLoadingTasks,
  tasks,
  draftTasks,
  selectedTaskRowsCount,
  editingTaskId,
  onOpenAddPlanDialog,
  onOpenCancelConfirm,
  onSaveAllChanges,
  onGeneratePlanForm,
  onOpenAddTasksDialog,
  onOpenBulkSchedule,
  onBulkAssignUnit,
  onOpenBulkDeleteConfirm,
  onSelectPlan,
  showFacilityFilter,
  facilities,
  selectedFacilityId,
  onFacilityChange,
  isLoadingFacilities,
  totalCount,
  planSearchTerm,
  onPlanSearchChange,
  isMobile,
  mobilePlanCards,
  planTable,
  planColumns,
  currentPage,
  totalPages,
  pageSize,
  plans,
  isLoadingPlans,
  onPageChange,
  onPageSizeChange,
  isFiltered,
  taskTable,
  taskColumns,
}: MaintenancePageDesktopContentProps) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="flex justify-between items-center">
        <TabsList>
          <TabsTrigger value="plans">Lập Kế hoạch</TabsTrigger>
          <TabsTrigger value="tasks" disabled={!selectedPlan}>Danh sách TB trong Kế hoạch</TabsTrigger>
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
            {canManagePlans && (
              <Button size="sm" className="h-8 gap-1 ml-auto" onClick={onOpenAddPlanDialog}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Tạo kế hoạch mới</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <PlanFiltersBar
              showFacilityFilter={showFacilityFilter}
              facilities={facilities}
              selectedFacilityId={selectedFacilityId}
              onFacilityChange={onFacilityChange}
              isLoadingFacilities={isLoadingFacilities}
              totalCount={totalCount}
              searchTerm={planSearchTerm}
              onSearchChange={onPlanSearchChange}
              isRegionalLeader={isRegionalLeader}
            />

            {isMobile ? (
              mobilePlanCards
            ) : (
              <PlansTable
                table={planTable}
                columns={planColumns}
                isLoading={isLoadingPlans}
                onRowClick={onSelectPlan}
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                displayCount={plans.length}
                isFiltered={isFiltered}
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
                <CardTitle>Danh sách Thiết bị trong Kế hoạch: {selectedPlan?.ten_ke_hoach || "..."}</CardTitle>
                <CardDescription className="mt-1">
                  {isPlanApproved
                    ? "Kế hoạch đã được duyệt. Nhấp vào các ô checkbox để ghi nhận hoàn thành công việc theo thực tế."
                    : 'Chế độ nháp: Mọi thay đổi được lưu tạm thời. Nhấn "Lưu thay đổi" để cập nhật vào cơ sở dữ liệu hoặc "Hủy bỏ" để loại bỏ các thay đổi chưa lưu.'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {hasChanges && !isPlanApproved && canManagePlans && (
                  <>
                    <Button variant="outline" onClick={onOpenCancelConfirm} disabled={isSavingAll}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      Hủy bỏ
                    </Button>
                    <Button onClick={onSaveAllChanges} disabled={isSavingAll || !canManagePlans}>
                      {isSavingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Lưu thay đổi
                    </Button>
                  </>
                )}
                {tasks.length > 0 && !isRegionalLeader && (
                  <Button variant="secondary" onClick={onGeneratePlanForm} disabled={editingTaskId !== null || isSavingAll}>
                    <FileText className="mr-2 h-4 w-4" />
                    Xuất phiếu KH
                  </Button>
                )}
                {!isPlanApproved && canManagePlans && (
                  <Button onClick={onOpenAddTasksDialog} disabled={editingTaskId !== null || isSavingAll}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Thêm thiết bị
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <TasksTable
                table={taskTable}
                columns={taskColumns}
                editingTaskId={editingTaskId}
                totalCount={draftTasks.length}
                selectedCount={selectedTaskRowsCount}
                showBulkActions={!isPlanApproved && canManagePlans}
                onBulkSchedule={onOpenBulkSchedule}
                onBulkAssignUnit={onBulkAssignUnit}
                onBulkDelete={onOpenBulkDeleteConfirm}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
