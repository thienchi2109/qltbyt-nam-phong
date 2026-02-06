"use client"

import * as React from "react"
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Edit,
  FileText,
  Filter,
  Loader2,
  MoreHorizontal,
  PlusCircle,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { NotesInput } from "./notes-input"
import { useMaintenanceContext } from "../_hooks/useMaintenanceContext"

// ============================================
// Types - only props NOT available from context
// ============================================

export interface MobileMaintenanceLayoutProps {
  // Plan list data (from query, not in context)
  plans: MaintenancePlan[]
  isLoadingPlans: boolean

  // Search state
  planSearchTerm: string
  setPlanSearchTerm: (value: string) => void
  onClearSearch: () => void

  // Pagination
  totalPages: number
  totalCount: number
  currentPage: number
  setCurrentPage: (page: number) => void

  // Facility filter (global/regional only)
  showFacilityFilter: boolean
  facilities: Array<{ id: number; name: string }>
  selectedFacilityId: number | null
  isLoadingFacilities: boolean

  // Mobile filter sheet
  isMobileFilterSheetOpen: boolean
  setIsMobileFilterSheetOpen: (open: boolean) => void
  pendingFacilityFilter: number | null
  setPendingFacilityFilter: (value: number | null) => void
  handleMobileFilterApply: () => void
  handleMobileFilterClear: () => void
  activeMobileFilterCount: number

  // Mobile-specific expansion state
  expandedTaskIds: Record<number, boolean>
  toggleTaskExpansion: (taskId: number) => void
}

// ============================================
// Helpers
// ============================================

function getPlanStatusTone(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return { header: "bg-amber-50 border-b border-amber-100" }
    case "Đã duyệt":
      return { header: "bg-emerald-50 border-b border-emerald-100" }
    case "Không duyệt":
      return { header: "bg-red-50 border-b border-red-100" }
    default:
      return { header: "bg-muted border-b border-border/60" }
  }
}

function resolveStatusBadgeVariant(status: MaintenancePlan["trang_thai"]) {
  switch (status) {
    case "Bản nháp":
      return "secondary" as const
    case "Đã duyệt":
      return "default" as const
    case "Không duyệt":
      return "destructive" as const
    default:
      return "outline" as const
  }
}

// ============================================
// Component
// ============================================

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
  // Get shared state from context
  const ctx = useMaintenanceContext()

  const months = React.useMemo(() => Array.from({ length: 12 }, (_, idx) => idx + 1), [])
  const planTabActive = ctx.activeTab === "plans"
  const safeAreaFooterStyle = React.useMemo(() => ({ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }), [])
  const fabStyle = React.useMemo(() => ({ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }), [])

  const facilityOptions = React.useMemo(() => {
    if (!showFacilityFilter) return [] as Array<{ id: number; name: string }>
    return facilities
  }, [showFacilityFilter, facilities])

  const activeFacilityLabel = React.useMemo(() => {
    if (selectedFacilityId == null) return null
    const match = facilities.find((facility) => facility.id === selectedFacilityId)
    return match?.name || "Cơ sở đã chọn"
  }, [facilities, selectedFacilityId])

  const handleFacilityOptionSelect = React.useCallback((value: number | null) => {
    setPendingFacilityFilter(value)
  }, [setPendingFacilityFilter])

  // ============================================
  // Plan Cards Renderer
  // ============================================

  const renderPlanCards = () => {
    if (isLoadingPlans) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Card key={idx} className="border-muted shadow-none">
              <CardHeader className="space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )
    }

    if (!plans.length) {
      return (
        <Card className="border-dashed bg-muted/40">
          <CardContent className="flex flex-col items-center justify-center space-y-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Chưa có kế hoạch</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hãy tạo kế hoạch mới hoặc điều chỉnh bộ lọc để xem dữ liệu phù hợp.
              </p>
            </div>
            {ctx.canManagePlans && (
              <Button onClick={() => ctx.setIsAddPlanDialogOpen(true)} className="h-11 px-6">
                <PlusCircle className="mr-2 h-4 w-4" />
                Tạo kế hoạch mới
              </Button>
            )}
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-3">
        {plans.map((plan) => {
          const statusTone = getPlanStatusTone(plan.trang_thai)
          return (
            <Card
              key={plan.id}
              className="cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-background shadow-sm transition-transform active:scale-[0.985]"
              onClick={() => ctx.handleSelectPlan(plan)}
            >
              <div className={`px-4 py-3 ${statusTone.header}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold leading-tight line-clamp-2">
                      {plan.ten_ke_hoach}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      Năm {plan.nam} • {plan.khoa_phong || "Tổng thể"}
                    </p>
                  </div>
                  <Badge variant={resolveStatusBadgeVariant(plan.trang_thai)} className="shrink-0">
                    {plan.trang_thai}
                  </Badge>
                </div>
              </div>
              <CardContent className="space-y-3 px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Loại công việc</span>
                  <Badge variant="outline" className="shrink-0">
                    {plan.loai_cong_viec}
                  </Badge>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Người lập</span>
                  <span className="max-w-[55%] text-right font-medium">
                    {plan.nguoi_lap_ke_hoach || "Chưa cập nhật"}
                  </span>
                </div>
                {showFacilityFilter && (
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground">Cơ sở</span>
                    <span className="max-w-[55%] text-right font-medium">
                      {plan.facility_name || "Tất cả"}
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Ngày phê duyệt</span>
                  <span className="max-w-[55%] text-right font-medium text-sm">
                    {plan.ngay_phe_duyet
                      ? format(parseISO(plan.ngay_phe_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })
                      : "Chưa duyệt"}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="px-4 py-3">
                <div className="flex w-full items-center justify-between">
                  <Button variant="ghost" size="sm" className="px-0 text-sm" onClick={(e) => {
                    e.stopPropagation()
                    ctx.handleSelectPlan(plan)
                    ctx.setActiveTab('tasks')
                  }}>
                    Xem công việc
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                      <DropdownMenuItem onSelect={() => ctx.handleSelectPlan(plan)}>
                        Xem chi tiết công việc
                      </DropdownMenuItem>
                      {plan.trang_thai === 'Bản nháp' && ctx.canManagePlans && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => ctx.setEditingPlan(plan)}>
                            Sửa kế hoạch
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => ctx.operations.openApproveDialog(plan)}>
                            Duyệt kế hoạch
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => ctx.operations.openRejectDialog(plan)}>
                            Không duyệt
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => ctx.operations.openDeleteDialog(plan)} className="text-destructive">
                            Xóa kế hoạch
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    )
  }

  // ============================================
  // Tasks Renderer
  // ============================================

  const renderTasks = () => {
    if (!ctx.selectedPlan) {
      return (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center space-y-3 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Chọn kế hoạch để xem công việc</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Nhấn vào một kế hoạch trong danh sách để xem hoặc chỉnh sửa các thiết bị trong kế hoạch đó.
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    const isDraft = ctx.selectedPlan.trang_thai === 'Bản nháp'

    return (
      <div className="space-y-4">
        {/* Plan header card */}
        <Card className="rounded-2xl border border-border/80 bg-background">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold leading-tight">
                  {ctx.selectedPlan.ten_ke_hoach}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Năm {ctx.selectedPlan.nam} • {ctx.selectedPlan.khoa_phong || "Tổng thể"}
                </p>
              </div>
              <Badge variant={resolveStatusBadgeVariant(ctx.selectedPlan.trang_thai)}>
                {ctx.selectedPlan.trang_thai}
              </Badge>
            </div>
            {ctx.selectedPlan.ly_do_khong_duyet && ctx.selectedPlan.trang_thai === 'Không duyệt' && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Lý do: {ctx.selectedPlan.ly_do_khong_duyet}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {ctx.canManagePlans && isDraft && (
                <Button size="sm" onClick={() => ctx.setIsAddTasksDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Thêm thiết bị
                </Button>
              )}
              {ctx.tasks.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => ctx.generatePlanForm()}
                  disabled={ctx.isSavingAll}
                  className="flex items-center"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Xuất phiếu kế hoạch
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Unsaved changes warning */}
        {ctx.hasChanges && isDraft && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 text-amber-600" />
              <div className="flex-1">
                <div className="text-sm font-medium text-amber-900">Có thay đổi chưa lưu</div>
                <p className="mt-1 text-xs text-amber-700">
                  Lưu lại để cập nhật vào cơ sở dữ liệu hoặc hủy bỏ để khôi phục dữ liệu ban đầu.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-900 hover:bg-amber-100"
                    onClick={() => ctx.setIsConfirmingCancel(true)}
                    disabled={ctx.isSavingAll}
                  >
                    Hủy bỏ
                  </Button>
                  <Button onClick={() => void ctx.handleSaveAllChanges()} disabled={ctx.isSavingAll}>
                    {ctx.isSavingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Lưu thay đổi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task list */}
        {ctx.isLoadingTasks ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Card key={idx} className="rounded-2xl border border-border/70 bg-background">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ctx.draftTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                months={months}
                isExpanded={expandedTaskIds[task.id]}
                onToggleExpansion={() => toggleTaskExpansion(task.id)}
                isPlanApproved={ctx.isPlanApproved}
                canCompleteTask={ctx.canCompleteTask}
                isCompletingTask={ctx.isCompletingTask}
                taskEditing={ctx.taskEditing}
                handleMarkAsCompleted={ctx.handleMarkAsCompleted}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="relative flex min-h-screen flex-col bg-muted/20">
      {/* Sticky Header */}
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

          {/* Search */}
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
                  onClick={() => onClearSearch()}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter button */}
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
                {isLoadingFacilities ? 'Đang tải' : 'Bộ lọc'}
                {activeMobileFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-auto rounded-full bg-primary text-primary-foreground">
                    {activeMobileFilterCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Active filter chip */}
            {activeFacilityLabel && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-2 rounded-full border-primary/40 bg-primary/5 px-3 py-1 text-xs text-primary">
                  {activeFacilityLabel}
                  <button
                    type="button"
                    onClick={() => handleMobileFilterClear()}
                    className="rounded-full bg-primary/10 p-0.5 text-primary hover:bg-primary/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}
          </div>

          {/* Tab switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-full bg-muted/80 p-1">
            <Button
              type="button"
              variant={planTabActive ? 'default' : 'ghost'}
              size="sm"
              className={`h-9 rounded-full text-sm ${planTabActive ? '' : 'bg-transparent text-muted-foreground hover:bg-transparent'}`}
              onClick={() => ctx.setActiveTab('plans')}
            >
              Kế hoạch
            </Button>
            <Button
              type="button"
              variant={!planTabActive ? 'default' : 'ghost'}
              size="sm"
              className={`h-9 rounded-full text-sm ${!planTabActive ? '' : 'bg-transparent text-muted-foreground hover:bg-transparent'}`}
              onClick={() => ctx.setActiveTab('tasks')}
              disabled={!ctx.selectedPlan}
            >
              Công việc
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 pb-6 pt-4 space-y-4">
          {planTabActive ? renderPlanCards() : renderTasks()}
        </div>
      </main>

      {/* FAB for adding plan */}
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

      {/* Bottom pagination bar */}
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
              >
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

      {/* Filter Sheet */}
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
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <Skeleton key={idx} className="h-11 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => handleFacilityOptionSelect(null)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${pendingFacilityFilter === null ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-background'}`}
                    >
                      Tất cả cơ sở
                    </button>
                    {facilityOptions.map((facility) => (
                      <button
                        key={facility.id}
                        type="button"
                        onClick={() => handleFacilityOptionSelect(facility.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${pendingFacilityFilter === facility.id ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-background'}`}
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
            <Button
              variant="outline"
              onClick={() => setIsMobileFilterSheetOpen(false)}
            >
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
                <Button onClick={handleMobileFilterApply}>
                  Áp dụng
                </Button>
              </SheetClose>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ============================================
// Task Card Sub-component
// ============================================

interface TaskCardProps {
  task: MaintenanceTask
  index: number
  months: number[]
  isExpanded: boolean
  onToggleExpansion: () => void
  // Specific props instead of entire context
  isPlanApproved: boolean
  canCompleteTask: boolean
  isCompletingTask: string | null
  taskEditing: {
    editingTaskId: number | null
    editingTaskData: Partial<MaintenanceTask> | null
    handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
    handleSaveTask: () => void
    handleCancelEdit: () => void
    handleStartEdit: (task: MaintenanceTask) => void
    setTaskToDelete: (task: MaintenanceTask | null) => void
  }
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => Promise<void>
}

const TaskCard = React.memo(function TaskCard({
  task,
  index,
  months,
  isExpanded,
  onToggleExpansion,
  isPlanApproved,
  canCompleteTask,
  isCompletingTask,
  taskEditing,
  handleMarkAsCompleted,
}: TaskCardProps) {
  const isEditing = taskEditing.editingTaskId === task.id
  const editingData = taskEditing.editingTaskData

  const monthsScheduled = React.useMemo(() => {
    return months.filter((month) => {
      const fieldKey = `thang_${month}` as keyof MaintenanceTask
      return Boolean(isEditing ? editingData?.[fieldKey] : task[fieldKey])
    })
  }, [months, isEditing, editingData, task])

  const completionKeyPrefix = `${task.id}-`

  return (
    <Card className="rounded-2xl border border-border/70 bg-background shadow-sm">
      <CardContent className="p-0">
        {/* Collapsed header */}
        <button
          type="button"
          onClick={onToggleExpansion}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold leading-tight line-clamp-2">
              {task.thiet_bi?.ten_thiet_bi || 'Thiết bị chưa xác định'}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              {task.thiet_bi?.ma_thiet_bi || '---'} • {task.thiet_bi?.khoa_phong_quan_ly || '---'}
            </p>
            {!isPlanApproved && !isEditing && monthsScheduled.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {monthsScheduled.map((month) => (
                  <Badge key={month} variant="outline" className="text-xs">
                    T{month}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <ChevronDown
            className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-border/70 px-4 py-4 space-y-4">
            {/* Task details */}
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Đơn vị thực hiện</span>
                {isEditing ? (
                  <Select
                    value={editingData?.don_vi_thuc_hien || ''}
                    onValueChange={(value) => taskEditing.handleTaskDataChange('don_vi_thuc_hien', value === 'none' ? null : value)}
                  >
                    <SelectTrigger className="h-9 w-[160px]">
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nội bộ">Nội bộ</SelectItem>
                      <SelectItem value="Thuê ngoài">Thuê ngoài</SelectItem>
                      <SelectItem value="none">Xóa</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="max-w-[60%] text-right font-medium">
                    {task.don_vi_thuc_hien || 'Chưa gán'}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Ghi chú</span>
                {isEditing ? (
                  <div className="w-2/3">
                    <NotesInput
                      taskId={task.id}
                      value={editingData?.ghi_chu || ''}
                      onChange={(value) => taskEditing.handleTaskDataChange('ghi_chu', value)}
                    />
                  </div>
                ) : (
                  <span className="max-w-[60%] text-right text-sm">
                    {task.ghi_chu || '—'}
                  </span>
                )}
              </div>
            </div>

            {/* Completion tracking (for approved plans) */}
            {isPlanApproved ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Theo dõi hoàn thành</div>
                <div className="grid grid-cols-3 gap-2">
                  {months.map((month) => {
                    const scheduled = Boolean(task[`thang_${month}` as keyof MaintenanceTask])
                    if (!scheduled) {
                      return (
                        <div
                          key={month}
                          className="flex h-11 items-center justify-center rounded-xl border border-dashed border-muted-foreground/30 text-xs text-muted-foreground"
                        >
                          T{month}
                        </div>
                      )
                    }

                    const completionKey = `${completionKeyPrefix}${month}`
                    const isCompleted = Boolean((task as Record<string, unknown>)[`thang_${month}_hoan_thanh`])
                    const isUpdating = isCompletingTask === completionKey

                    return (
                      <Button
                        key={month}
                        variant={isCompleted ? 'secondary' : 'outline'}
                        className={`h-11 rounded-xl text-sm ${isCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}`}
                        disabled={!canCompleteTask || isUpdating}
                        onClick={() => {
                          if (!isCompleted && canCompleteTask) {
                            void handleMarkAsCompleted(task, month)
                          }
                        }}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isCompleted ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>T{month}</span>
                          </div>
                        ) : (
                          <span>Hoàn thành T{month}</span>
                        )}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Schedule editing (for draft plans) */}
                {isEditing && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Lịch thực hiện</div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {months.map((month) => {
                        const field = `thang_${month}` as keyof MaintenanceTask
                        const checked = Boolean(editingData?.[field])
                        return (
                          <label
                            key={month}
                            className="flex items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => taskEditing.handleTaskDataChange(field, Boolean(value))}
                            />
                            <span className="text-sm">Tháng {month}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {isPlanApproved ? null : isEditing ? (
                <>
                  <Button size="sm" onClick={taskEditing.handleSaveTask}>
                    <Save className="mr-2 h-4 w-4" />
                    Lưu
                  </Button>
                  <Button size="sm" variant="outline" onClick={taskEditing.handleCancelEdit}>
                    Hủy
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => taskEditing.handleStartEdit(task)} disabled={isPlanApproved}>
                    <Edit className="mr-2 h-4 w-4" />
                    Sửa
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => taskEditing.setTaskToDelete(task)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Xóa
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
