"use client"

import * as React from "react"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Loader2,
  PlusCircle,
  Search,
  X,
} from "lucide-react"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"
import { MaintenanceMobilePlanCards } from "./maintenance-mobile-plan-cards"
import { MaintenanceMobileTasksPanel } from "./maintenance-mobile-tasks-panel"

export interface MobileMaintenanceLayoutProps {
  plans: MaintenancePlan[]
  isLoadingPlans: boolean
  planSearchTerm: string
  setPlanSearchTerm: (value: string) => void
  onClearSearch: () => void
  totalPages: number
  totalCount: number
  currentPage: number
  setCurrentPage: (page: number) => void
  showFacilityFilter: boolean
  facilities: Array<{ id: number; name: string }>
  selectedFacilityId: number | null
  isLoadingFacilities: boolean
  isMobileFilterSheetOpen: boolean
  setIsMobileFilterSheetOpen: (open: boolean) => void
  pendingFacilityFilter: number | null
  setPendingFacilityFilter: (value: number | null) => void
  handleMobileFilterApply: () => void
  handleMobileFilterClear: () => void
  activeMobileFilterCount: number
  expandedTaskIds: Record<number, boolean>
  toggleTaskExpansion: (taskId: number) => void
}

export function MobileMaintenanceLayout({
  plans,
  isLoadingPlans,
  planSearchTerm,
  setPlanSearchTerm,
  onClearSearch,
  totalPages,
  totalCount,
  currentPage,
  setCurrentPage,
  showFacilityFilter,
  facilities,
  selectedFacilityId,
  isLoadingFacilities,
  isMobileFilterSheetOpen,
  setIsMobileFilterSheetOpen,
  pendingFacilityFilter,
  setPendingFacilityFilter,
  handleMobileFilterApply,
  handleMobileFilterClear,
  activeMobileFilterCount,
  expandedTaskIds,
  toggleTaskExpansion,
}: MobileMaintenanceLayoutProps) {
  const ctx = useMaintenanceContext()

  const months = React.useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), [])
  const planTabActive = ctx.activeTab === "plans"
  const safeAreaFooterStyle = React.useMemo(
    () => ({ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }),
    []
  )
  const fabStyle = React.useMemo(
    () => ({ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }),
    []
  )

  const facilityOptions = React.useMemo(() => {
    if (!showFacilityFilter) {
      return [] as Array<{ id: number; name: string }>
    }
    return facilities
  }, [showFacilityFilter, facilities])

  const activeFacilityLabel = React.useMemo(() => {
    if (selectedFacilityId == null) {
      return null
    }
    const match = facilities.find((facility) => facility.id === selectedFacilityId)
    return match?.name || "Cơ sở đã chọn"
  }, [facilities, selectedFacilityId])

  const handleFacilityOptionSelect = React.useCallback(
    (value: number | null) => {
      setPendingFacilityFilter(value)
    },
    [setPendingFacilityFilter]
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={planSearchTerm}
                onChange={(event) => setPlanSearchTerm(event.target.value)}
                placeholder="Tìm kế hoạch, khoa/phòng, người lập..."
                className="h-11 rounded-xl border-border/60 bg-white pl-10 pr-10 text-sm"
              />
              {planSearchTerm && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-muted p-1"
                  onClick={onClearSearch}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl border border-border/70"
                onClick={() => setIsMobileFilterSheetOpen(true)}
                disabled={isLoadingFacilities}
              >
                {isLoadingFacilities ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Filter className="mr-2 h-4 w-4" />
                )}
                {isLoadingFacilities ? "Đang tải" : "Bộ lọc"}
                {activeMobileFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-auto rounded-full bg-primary text-primary-foreground">
                    {activeMobileFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {activeFacilityLabel && (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="flex items-center gap-2 rounded-full border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary"
                >
                  {activeFacilityLabel}
                  <button
                    type="button"
                    onClick={handleMobileFilterClear}
                    className="rounded-full bg-primary/10 p-0.5 text-primary hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
          </div>

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
              isLoadingPlans={isLoadingPlans}
              showFacilityFilter={showFacilityFilter}
              canManagePlans={ctx.canManagePlans}
              onOpenAddPlanDialog={() => ctx.setIsAddPlanDialogOpen(true)}
              onSelectPlan={ctx.handleSelectPlan}
              onSetTasksTab={() => ctx.setActiveTab("tasks")}
              onEditPlan={ctx.setEditingPlan}
              onOpenApproveDialog={ctx.operations.openApproveDialog}
              onOpenRejectDialog={ctx.operations.openRejectDialog}
              onOpenDeleteDialog={ctx.operations.openDeleteDialog}
            />
          ) : (
            <MaintenanceMobileTasksPanel
              selectedPlan={ctx.selectedPlan}
              canManagePlans={ctx.canManagePlans}
              tasks={ctx.tasks}
              draftTasks={ctx.draftTasks}
              hasChanges={ctx.hasChanges}
              isSavingAll={ctx.isSavingAll}
              isLoadingTasks={ctx.isLoadingTasks}
              isPlanApproved={ctx.isPlanApproved}
              canCompleteTask={ctx.canCompleteTask}
              isCompletingTask={ctx.isCompletingTask}
              taskEditing={ctx.taskEditing}
              months={months}
              expandedTaskIds={expandedTaskIds}
              toggleTaskExpansion={toggleTaskExpansion}
              setIsAddTasksDialogOpen={ctx.setIsAddTasksDialogOpen}
              generatePlanForm={ctx.generatePlanForm}
              setIsConfirmingCancel={ctx.setIsConfirmingCancel}
              handleSaveAllChanges={ctx.handleSaveAllChanges}
              handleMarkAsCompleted={ctx.handleMarkAsCompleted}
            />
          )}
        </div>
      </main>

      {ctx.canManagePlans && !ctx.isRegionalLeader && (
        <Button
          onClick={() => ctx.setIsAddPlanDialogOpen(true)}
          className="fixed right-4 z-50 h-14 w-14 rounded-full shadow-xl transition-transform active:scale-95"
          style={fabStyle}
          aria-label="Tạo kế hoạch mới"
        >
          <PlusCircle className="h-6 w-6" />
        </Button>
      )}

      {planTabActive && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-border/60 bg-background/95 shadow-lg backdrop-blur" style={safeAreaFooterStyle}>
          <div className="px-4">
            <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
              <span>Trang {currentPage}/{Math.max(totalPages, 1)}</span>
              <span>{totalCount} kế hoạch</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pb-2">
              <Button variant="outline" className="h-10 rounded-xl" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(Math.min(totalPages || 1, currentPage + 1))}
                disabled={currentPage === (totalPages || 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl"
                onClick={() => setCurrentPage(totalPages || 1)}
                disabled={currentPage === (totalPages || 1)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={isMobileFilterSheetOpen} onOpenChange={setIsMobileFilterSheetOpen}>
        <SheetContent side="bottom" className="flex h-[65vh] flex-col rounded-t-3xl border-border/60 bg-background px-6 pb-6 pt-4">
          <SheetHeader>
            <SheetTitle>Bộ lọc kế hoạch</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Chọn cơ sở hoặc điều kiện phù hợp để thu hẹp danh sách kế hoạch hiển thị.
            </p>
          </SheetHeader>
          <div className="mt-4 flex-1 overflow-y-auto">
            {showFacilityFilter ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Cơ sở</h3>
                {isLoadingFacilities ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-11 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleFacilityOptionSelect(null)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${pendingFacilityFilter === null ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background"}`}
                    >
                      Tất cả cơ sở
                    </button>
                    {facilityOptions.map((facility) => (
                      <button
                        key={facility.id}
                        type="button"
                        onClick={() => handleFacilityOptionSelect(facility.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${pendingFacilityFilter === facility.id ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-background"}`}
                      >
                        {facility.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                Không có bộ lọc bổ sung cho vai trò của bạn.
              </div>
            )}
          </div>
          <SheetFooter className="mt-4 grid grid-cols-2 gap-3 shrink-0">
            <Button variant="outline" onClick={() => setIsMobileFilterSheetOpen(false)}>
              Hủy
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                className="border border-border/60"
                onClick={handleMobileFilterClear}
                disabled={selectedFacilityId === null && pendingFacilityFilter === null}
              >
                Xóa
              </Button>
              <SheetClose asChild>
                <Button onClick={handleMobileFilterApply}>Áp dụng</Button>
              </SheetClose>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
