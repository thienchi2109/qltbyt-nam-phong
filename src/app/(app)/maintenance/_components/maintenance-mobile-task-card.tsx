"use client"

import * as React from "react"
import type { MaintenanceTask } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NotesInput } from "./notes-input"
import {
  CheckCircle2,
  ChevronDown,
  Edit,
  Loader2,
  Save,
  Trash2,
} from "lucide-react"

export interface MaintenanceMobileTaskCardProps {
  task: MaintenanceTask
  index: number
  months: number[]
  isExpanded: boolean
  onToggleExpansion: () => void
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

export const MaintenanceMobileTaskCard = React.memo(function MaintenanceMobileTaskCard({
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
}: MaintenanceMobileTaskCardProps) {
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
              {task.thiet_bi?.ten_thiet_bi || "Thiết bị chưa xác định"}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
              {task.thiet_bi?.ma_thiet_bi || "---"} • {task.thiet_bi?.khoa_phong_quan_ly || "---"}
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
            className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>

        {isExpanded && (
          <div className="border-t border-border/70 px-4 py-4 space-y-4">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Đơn vị thực hiện</span>
                {isEditing ? (
                  <Select
                    value={editingData?.don_vi_thuc_hien || ""}
                    onValueChange={(value) => taskEditing.handleTaskDataChange("don_vi_thuc_hien", value === "none" ? null : value)}
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
                  <span className="max-w-[60%] text-right font-medium">{task.don_vi_thuc_hien || "Chưa gán"}</span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">Ghi chú</span>
                {isEditing ? (
                  <div className="w-2/3">
                    <NotesInput
                      taskId={task.id}
                      value={editingData?.ghi_chu || ""}
                      onChange={(value) => taskEditing.handleTaskDataChange("ghi_chu", value)}
                    />
                  </div>
                ) : (
                  <span className="max-w-[60%] text-right text-sm">{task.ghi_chu || "—"}</span>
                )}
              </div>
            </div>

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
                        variant={isCompleted ? "secondary" : "outline"}
                        className={`h-11 rounded-xl text-sm ${isCompleted ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}
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
              isEditing && (
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
              )
            )}

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
