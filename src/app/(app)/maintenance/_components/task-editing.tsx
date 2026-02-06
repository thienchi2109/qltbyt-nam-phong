"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import type { MaintenanceTask } from "@/lib/data"

export interface UseTaskEditingOptions {
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  canManagePlans: boolean
  isPlanApproved: boolean
}

export function useTaskEditing(options: UseTaskEditingOptions) {
  const { toast } = useToast()
  const { setDraftTasks } = options

  const [editingTaskId, setEditingTaskId] = React.useState<number | null>(null)
  const [editingTaskData, setEditingTaskData] = React.useState<Partial<MaintenanceTask> | null>(null)
  const [taskToDelete, setTaskToDelete] = React.useState<MaintenanceTask | null>(null)

  const handleStartEdit = React.useCallback((task: MaintenanceTask) => {
    setEditingTaskId(task.id)
    setEditingTaskData({ ...task })
  }, [])

  const handleCancelEdit = React.useCallback(() => {
    setEditingTaskId(null)
    setEditingTaskData(null)
  }, [])

  const handleTaskDataChange = React.useCallback((field: keyof MaintenanceTask, value: unknown) => {
    setEditingTaskData(prev => prev ? { ...prev, [field]: value } : null)
  }, [])

  const handleSaveTask = React.useCallback(() => {
    if (!editingTaskId || !editingTaskData) return

    setDraftTasks(currentDrafts =>
      currentDrafts.map(task =>
        task.id === editingTaskId ? { ...task, ...editingTaskData } : task
      )
    )

    // Reset editing state
    setEditingTaskId(null)
    setEditingTaskData(null)

    toast({
      title: "Thành công",
      description: "Đã cập nhật công việc"
    })
  }, [editingTaskId, editingTaskData, setDraftTasks, toast])

  return {
    editingTaskId,
    editingTaskData,
    taskToDelete,
    setTaskToDelete,
    handleStartEdit,
    handleCancelEdit,
    handleTaskDataChange,
    handleSaveTask,
  }
}
