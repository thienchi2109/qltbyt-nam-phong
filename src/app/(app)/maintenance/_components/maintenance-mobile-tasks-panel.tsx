"use client"

import * as React from "react"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangle,
  ClipboardList,
  FileText,
  Loader2,
  PlusCircle,
} from "lucide-react"
import { resolveStatusBadgeVariant } from "./maintenance-mobile-status"
import { MaintenanceMobileTaskCard } from "./maintenance-mobile-task-card"

interface MaintenanceMobileTasksPanelProps {
  selectedPlan: MaintenancePlan | null
  canManagePlans: boolean
  tasks: MaintenanceTask[]
  draftTasks: MaintenanceTask[]
  hasChanges: boolean
  isSavingAll: boolean
  isLoadingTasks: boolean
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
  months: number[]
  expandedTaskIds: Record<number, boolean>
  toggleTaskExpansion: (taskId: number) => void
  setIsAddTasksDialogOpen: (open: boolean) => void
  generatePlanForm: () => void
  setIsConfirmingCancel: (open: boolean) => void
  handleSaveAllChanges: () => Promise<void>
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => Promise<void>
}

export function MaintenanceMobileTasksPanel({
  selectedPlan,
  canManagePlans,
  tasks,
  draftTasks,
  hasChanges,
  isSavingAll,
  isLoadingTasks,
  isPlanApproved,
  canCompleteTask,
  isCompletingTask,
  taskEditing,
  months,
  expandedTaskIds,
  toggleTaskExpansion,
  setIsAddTasksDialogOpen,
  generatePlanForm,
  setIsConfirmingCancel,
  handleSaveAllChanges,
  handleMarkAsCompleted,
}: MaintenanceMobileTasksPanelProps) {
  if (!selectedPlan) {
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

  const isDraft = selectedPlan.trang_thai === "Bản nháp"

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-border/80 bg-background">
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold leading-tight">{selectedPlan.ten_ke_hoach}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Năm {selectedPlan.nam} • {selectedPlan.khoa_phong || "Tổng thể"}
              </p>
            </div>
            <Badge variant={resolveStatusBadgeVariant(selectedPlan.trang_thai)}>{selectedPlan.trang_thai}</Badge>
          </div>
          {selectedPlan.ly_do_khong_duyet && selectedPlan.trang_thai === "Không duyệt" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Lý do: {selectedPlan.ly_do_khong_duyet}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {canManagePlans && isDraft && (
              <Button size="sm" onClick={() => setIsAddTasksDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Thêm thiết bị
              </Button>
            )}
            {tasks.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={generatePlanForm}
                disabled={isSavingAll}
                className="flex items-center"
              >
                <FileText className="mr-2 h-4 w-4" />
                Xuất phiếu kế hoạch
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {hasChanges && isDraft && (
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
                  onClick={() => setIsConfirmingCancel(true)}
                  disabled={isSavingAll}
                >
                  Hủy bỏ
                </Button>
                <Button onClick={() => void handleSaveAllChanges()} disabled={isSavingAll}>
                  {isSavingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoadingTasks ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="rounded-2xl border border-border/70 bg-background">
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
          {draftTasks.map((task, index) => (
            <MaintenanceMobileTaskCard
              key={task.id}
              task={task}
              index={index}
              months={months}
              isExpanded={Boolean(expandedTaskIds[task.id])}
              onToggleExpansion={() => toggleTaskExpansion(task.id)}
              isPlanApproved={isPlanApproved}
              canCompleteTask={canCompleteTask}
              isCompletingTask={isCompletingTask}
              taskEditing={taskEditing}
              handleMarkAsCompleted={handleMarkAsCompleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
