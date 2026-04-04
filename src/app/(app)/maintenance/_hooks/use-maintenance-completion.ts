"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import type { AuthUser, CompletionStatusEntry } from "../_components/maintenance-context.types"
import { callRpc } from "@/lib/rpc-client"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { getSelectedTaskIds } from "../_components/MaintenanceContextHelpers"

interface UseMaintenanceCompletionOptions {
  selectedPlan: MaintenancePlan | null
  user: AuthUser | null
  canCompleteTask: boolean
  tasks: MaintenanceTask[]
  fetchPlanDetails: (plan: MaintenancePlan) => Promise<void>
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  taskRowSelection: RowSelectionState
  setTaskRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
  taskToDelete: MaintenanceTask | null
  setTaskToDelete: (task: MaintenanceTask | null) => void
  setIsBulkScheduleOpen: (open: boolean) => void
  setIsConfirmingBulkDelete: (open: boolean) => void
  toast: (opts: { variant?: "destructive"; title: string; description?: string }) => void
}

export function useMaintenanceCompletion({
  selectedPlan,
  user,
  canCompleteTask,
  tasks: _tasks,
  fetchPlanDetails,
  draftTasks,
  setDraftTasks,
  taskRowSelection,
  setTaskRowSelection,
  taskToDelete,
  setTaskToDelete,
  setIsBulkScheduleOpen,
  setIsConfirmingBulkDelete,
  toast,
}: UseMaintenanceCompletionOptions) {
  const [completionStatus, setCompletionStatus] = React.useState<Record<string, CompletionStatusEntry>>({})
  const [isCompletingTask, setIsCompletingTask] = React.useState<string | null>(null)

  const selectedTaskIds = React.useMemo(() => getSelectedTaskIds(taskRowSelection), [taskRowSelection])
  const selectedTaskIdSet = React.useMemo(() => new Set(selectedTaskIds), [selectedTaskIds])
  const selectedTaskRowsCount = selectedTaskIds.length

  const handleMarkAsCompleted = React.useCallback(
    async (task: MaintenanceTask, month: number) => {
      if (!selectedPlan || !user || !canCompleteTask) {
        toast({
          variant: "destructive",
          title: "Không có quyền",
          description: "Bạn không có quyền thực hiện hành động này.",
        })
        return
      }

      const completionKey = `${task.id}-${month}`
      if (completionStatus[completionKey] || isCompletingTask) {
        return
      }

      setIsCompletingTask(completionKey)

      try {
        await callRpc<void>({
          fn: "maintenance_task_complete",
          args: { p_task_id: task.id, p_month: month },
        })

        toast({
          title: "Ghi nhận thành công",
          description: `Đã ghi nhận hoàn thành ${selectedPlan.loai_cong_viec} cho thiết bị tháng ${month}.`,
        })

        setCompletionStatus((prev) => ({
          ...prev,
          [completionKey]: { historyId: 0 },
        }))

        await fetchPlanDetails(selectedPlan)
      } catch (error) {
        const message = getUnknownErrorMessage(error, "Lỗi không xác định")
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: `Không thể ghi nhận hoàn thành. ${message}`,
        })
      } finally {
        setIsCompletingTask(null)
      }
    },
    [selectedPlan, user, canCompleteTask, completionStatus, isCompletingTask, toast, fetchPlanDetails]
  )

  const handleBulkScheduleApply = React.useCallback(
    (months: Record<string, boolean>) => {
      if (selectedTaskIds.length === 0) return

      setDraftTasks((currentDrafts) =>
        currentDrafts.map((task) =>
          selectedTaskIdSet.has(task.id) ? { ...task, ...months } : task
        )
      )

      setIsBulkScheduleOpen(false)
      toast({ title: "Đã áp dụng lịch", description: "Lịch trình đã được cập nhật vào bản nháp." })
    },
    [selectedTaskIds.length, selectedTaskIdSet, setDraftTasks, setIsBulkScheduleOpen, toast]
  )

  const handleBulkAssignUnit = React.useCallback(
    (unit: string | null) => {
      if (selectedTaskIds.length === 0) return

      setDraftTasks((currentDrafts) =>
        currentDrafts.map((task) =>
          selectedTaskIdSet.has(task.id) ? { ...task, don_vi_thuc_hien: unit } : task
        )
      )

      toast({ title: "Đã gán đơn vị", description: "Đã cập nhật đơn vị thực hiện vào bản nháp." })
    },
    [selectedTaskIds.length, selectedTaskIdSet, setDraftTasks, toast]
  )

  const confirmDeleteSingleTask = React.useCallback(() => {
    if (!taskToDelete) return

    setDraftTasks((currentDrafts) => currentDrafts.filter((task) => task.id !== taskToDelete.id))
    setTaskToDelete(null)
    toast({ title: "Đã xóa khỏi bản nháp" })
  }, [taskToDelete, setTaskToDelete, setDraftTasks, toast])

  const confirmDeleteSelectedTasks = React.useCallback(() => {
    if (selectedTaskIds.length === 0) return

    setDraftTasks((currentDrafts) => currentDrafts.filter((task) => !selectedTaskIdSet.has(task.id)))
    setTaskRowSelection({})
    setIsConfirmingBulkDelete(false)
    toast({ title: "Đã xóa khỏi bản nháp", description: `Đã xóa ${selectedTaskIds.length} công việc.` })
  }, [selectedTaskIds.length, selectedTaskIdSet, setDraftTasks, setTaskRowSelection, setIsConfirmingBulkDelete, toast])

  return {
    completionStatus,
    setCompletionStatus,
    isCompletingTask,
    selectedTaskIds,
    selectedTaskIdSet,
    selectedTaskRowsCount,
    handleMarkAsCompleted,
    handleBulkScheduleApply,
    handleBulkAssignUnit,
    confirmDeleteSingleTask,
    confirmDeleteSelectedTasks,
  }
}
