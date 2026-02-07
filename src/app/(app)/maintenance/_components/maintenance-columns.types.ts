import type { SortingState } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { MaintenanceTask } from "@/lib/data"

export interface TableMeta {
  editingTaskId: number | null
  editingTaskData: Partial<MaintenanceTask> | null
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  handleCancelEdit: () => void
  handleStartEdit: (task: MaintenanceTask) => void
  isPlanApproved: boolean
  setTaskToDelete: (task: MaintenanceTask | null) => void
  completionStatus: Record<string, { historyId: number }>
  isLoadingCompletion: boolean
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void
  isCompletingTask: string | null
  canCompleteTask: boolean
}

export interface PlanColumnOptions {
  sorting: SortingState
  setSorting: (sorting: SortingState) => void
  onRowClick: (plan: MaintenancePlan) => void
  openApproveDialog: (plan: MaintenancePlan) => void
  openRejectDialog: (plan: MaintenancePlan) => void
  openDeleteDialog: (plan: MaintenancePlan) => void
  setEditingPlan: (plan: MaintenancePlan | null) => void
  canManagePlans: boolean
  isRegionalLeader: boolean
}

export interface TaskColumnOptions {
  editingTaskId: number | null
  handleStartEdit: (task: MaintenanceTask) => void
  handleCancelEdit: () => void
  handleTaskDataChange: (field: keyof MaintenanceTask, value: unknown) => void
  handleSaveTask: () => void
  setTaskToDelete: (task: MaintenanceTask | null) => void
  canManagePlans: boolean
  isPlanApproved: boolean
  canCompleteTask: boolean
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => void
  isCompletingTask: string | null
  completionStatus: Record<string, { historyId: number }>
  isLoadingCompletion: boolean
  selectedPlan: MaintenancePlan | null
}
