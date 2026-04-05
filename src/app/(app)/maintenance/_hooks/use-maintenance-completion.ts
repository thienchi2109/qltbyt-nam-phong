"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"
import type { AuthUser, CompletionStatusEntry } from "../_components/maintenance-context.types"
import { callRpc } from "@/lib/rpc-client"
import { getUnknownErrorMessage } from "@/lib/error-utils"
import { buildCompletionStatus, getSelectedTaskIds } from "../_components/MaintenanceContextHelpers"
import { toMaintenanceTaskRowId } from "../_components/maintenance-task-row-id"

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
  tasks,
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
  const [localCompletionStatus, setCompletionStatus] = React.useState<Record<string, CompletionStatusEntry>>({})
  const [isCompletingTask, setIsCompletingTask] = React.useState<string | null>(null)
  const inFlightKeysRef = React.useRef(new Set<string>())

  // Seed from tasks data so already-completed months are reflected immediately
  const seededStatus = React.useMemo(() => buildCompletionStatus(tasks), [tasks])
  const completionStatus = React.useMemo(
    () => ({ ...seededStatus, ...localCompletionStatus }),
    [seededStatus, localCompletionStatus]
  )

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
      if (completionStatus[completionKey] || inFlightKeysRef.current.has(completionKey)) {
        return
      }

      inFlightKeysRef.current.add(completionKey)
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

        try {
          await fetchPlanDetails(selectedPlan)
        } catch {
          // Rollback completion key so user can retry
          setCompletionStatus((prev) => {
            const next = { ...prev }
            delete next[completionKey]
            return next
          })
          throw new Error("Không thể tải lại dữ liệu kế hoạch")
        }
      } catch (error) {
        const message = getUnknownErrorMessage(error, "Lỗi không xác định")
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: `Không thể ghi nhận hoàn thành. ${message}`,
        })
      } finally {
        inFlightKeysRef.current.delete(completionKey)
        setIsCompletingTask(inFlightKeysRef.current.size > 0
          ? [...inFlightKeysRef.current][0] ?? null
          : null
        )
      }
    },
    [selectedPlan, user, canCompleteTask, completionStatus, toast, fetchPlanDetails]
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

    // Clear deleted task from row selection to prevent stale count
    const deletedRowKey = toMaintenanceTaskRowId(taskToDelete.id)
    setTaskRowSelection((prev) => {
      if (!(deletedRowKey in prev)) return prev
      const next = { ...prev }
      delete next[deletedRowKey]
      return next
    })

    setTaskToDelete(null)
    toast({ title: "Đã xóa khỏi bản nháp" })
  }, [taskToDelete, setTaskToDelete, setDraftTasks, setTaskRowSelection, toast])

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
