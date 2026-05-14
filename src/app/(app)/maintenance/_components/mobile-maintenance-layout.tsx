"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PlusCircle,
  Search,
  X,
} from "lucide-react"
import { KpiStatusBar } from "@/components/kpi"
import { MAINTENANCE_STATUS_CONFIGS } from "@/components/kpi/configs/maintenance"
import { FloatingActionButton } from "@/components/shared/FloatingActionButton"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenancePlanStatusCounts } from "@/hooks/useMaintenancePlanCounts"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"
import { MaintenanceMobilePlanCards } from "./maintenance-mobile-plan-cards"
import { MaintenanceMobileTasksPanel } from "./maintenance-mobile-tasks-panel"

interface MobileMaintenanceCountsState {
  statusCounts?: MaintenancePlanStatusCounts
  isCountsLoading?: boolean
  isCountsError?: boolean
}

interface MobileMaintenancePlansState {
  plans: MaintenancePlan[]
  isLoadingPlans: boolean
  planSearchTerm: string
  setPlanSearchTerm: (value: string) => void
  onClearSearch: () => void
}

interface MobileMaintenancePaginationState {
  totalPages: number
  totalCount: number
  currentPage: number
  setCurrentPage: (page: number) => void
}

interface MobileMaintenanceFilterState {
  showFacilityFilter: boolean
}

export interface MobileMaintenanceLayoutProps {
  countsState: MobileMaintenanceCountsState
  plansState: MobileMaintenancePlansState
  paginationState: MobileMaintenancePaginationState
  filterState: MobileMaintenanceFilterState
  expandedTaskIds: Record<number, boolean>
  toggleTaskExpansion: (taskId: number) => void
}

export function MobileMaintenanceLayout({
  countsState,
  plansState,
  paginationState,
  filterState,
  expandedTaskIds,
  toggleTaskExpansion,
}: MobileMaintenanceLayoutProps) {
  const ctx = useMaintenanceContext()
  const { statusCounts, isCountsLoading, isCountsError } = countsState
  const { plans, isLoadingPlans, planSearchTerm, setPlanSearchTerm, onClearSearch } = plansState
  const { totalPages, totalCount, currentPage, setCurrentPage } = paginationState
  const { showFacilityFilter } = filterState

  const months = React.useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), [])
  const planTabActive = ctx.activeTab === "plans"
  const safeAreaFooterStyle = React.useMemo(
    () => ({ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }),
    []
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-muted/20">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="space-y-3 px-4 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold">Kế hoạch bảo trì</h1>
              <p className="text-xs text-muted-foreground">
                Quản lý và theo dõi kế hoạch bảo trì ngay trên thiết bị di động.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {showFacilityFilter ? (
              <TenantSelector className="h-11 w-full rounded-xl border border-border/70" />
            ) : null}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={planSearchTerm}
                onChange={(event) => setPlanSearchTerm(event.target.value)}
                placeholder="Tìm kế hoạch, khoa/phòng, người lập…"
                className="h-11 rounded-xl border-border/60 bg-white pl-10 pr-10 text-sm"
              />
              {planSearchTerm && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-muted p-1"
                  onClick={onClearSearch}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <KpiStatusBar
            configs={MAINTENANCE_STATUS_CONFIGS}
            counts={statusCounts}
            loading={isCountsLoading}
            error={isCountsError}
            showTotal={false}
            className="gap-2"
          />

          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted/80 p-1">
            <Button
              type="button"
              variant={planTabActive ? "default" : "ghost"}
              size="sm"
              className={`h-9 rounded-full text-sm ${planTabActive ? "" : "bg-transparent text-muted-foreground hover:bg-transparent"}`}
              onClick={() => ctx.setActiveTab("plans")}
            >
              Kế hoạch
            </Button>
            <Button
              type="button"
              variant={!planTabActive ? "default" : "ghost"}
              size="sm"
              className={`h-9 rounded-full text-sm ${!planTabActive ? "" : "bg-transparent text-muted-foreground hover:bg-transparent"}`}
              onClick={() => ctx.setActiveTab("tasks")}
              disabled={!ctx.selectedPlan}
            >
              Công việc
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 pb-6 pt-4 space-y-4">
          {planTabActive ? (
            <MaintenanceMobilePlanCards
              plans={plans}
              planState={{ isLoadingPlans, showFacilityFilter }}
              access={{
                canManagePlans: ctx.canManagePlans,
                canCreatePlans: ctx.canCreatePlans,
              }}
              actions={{
                onOpenAddPlanDialog: () => ctx.setIsAddPlanDialogOpen(true),
                onSelectPlan: ctx.handleSelectPlan,
                onSetTasksTab: () => ctx.setActiveTab("tasks"),
                onEditPlan: ctx.setEditingPlan,
                onOpenApproveDialog: ctx.operations.openApproveDialog,
                onOpenRejectDialog: ctx.operations.openRejectDialog,
                onOpenDeleteDialog: ctx.operations.openDeleteDialog,
              }}
            />
          ) : (
            <MaintenanceMobileTasksPanel
              selectedPlan={ctx.selectedPlan}
              tasks={ctx.tasks}
              draftTasks={ctx.draftTasks}
              panelState={{
                hasChanges: ctx.hasChanges,
                isSavingAll: ctx.isSavingAll,
                isLoadingTasks: ctx.isLoadingTasks,
                isPlanApproved: ctx.isPlanApproved,
                isCompletingTask: ctx.isCompletingTask,
              }}
              access={{
                canManagePlans: ctx.canManagePlans,
                canCompleteTask: ctx.canCompleteTask,
              }}
              taskEditing={ctx.taskEditing}
              months={months}
              expansion={{ expandedTaskIds, toggleTaskExpansion }}
              actions={{
                setIsAddTasksDialogOpen: ctx.setIsAddTasksDialogOpen,
                generatePlanForm: ctx.generatePlanForm,
                setIsConfirmingCancel: ctx.setIsConfirmingCancel,
                handleSaveAllChanges: ctx.handleSaveAllChanges,
                handleMarkAsCompleted: ctx.handleMarkAsCompleted,
              }}
            />
          )}
        </div>
      </main>

      {ctx.canCreatePlans && (
        <FloatingActionButton
          onClick={() => ctx.setIsAddPlanDialogOpen(true)}
          aria-label="Tạo kế hoạch mới"
        >
          <PlusCircle />
        </FloatingActionButton>
      )}

      {planTabActive && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-background/95 shadow-lg backdrop-blur" style={safeAreaFooterStyle}>
          <div className="px-4">
            <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
              <span>Trang {currentPage}/{Math.max(totalPages, 1)}</span>
              <span>{totalCount} kế hoạch</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pb-2">
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="Trang đầu"
              >
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Trang trước"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(Math.min(totalPages || 1, currentPage + 1))}
                disabled={currentPage === (totalPages || 1)}
                aria-label="Trang sau"
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(totalPages || 1)}
                disabled={currentPage === (totalPages || 1)}
                aria-label="Trang cuối"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
