"use client"

import * as React from "react"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import type { MaintenanceTask } from "@/lib/data"

export interface UseTaskEditingOptions {
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  canManagePlans: boolean
  isPlanApproved: boolean
}

export function useTaskEditing(options: UseTaskEditingOptions) {
  const { toast } = useToast()

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
    // Implementation will be added in next task
  }, [])

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

// Memoized NotesInput component
export const NotesInput = React.memo(({ taskId, value, onChange }: {
  taskId: number;
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8"
      autoFocus
    />
  )
})
