import type * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { Equipment, MaintenanceTask } from "@/lib/data"
import type { useMaintenanceOperations } from "../_hooks/use-maintenance-operations"
import type { useTaskEditing } from "./task-editing"

export interface AuthUser {
  id?: string
  role?: string
  don_vi_id?: number
  dia_ban_id?: number
  full_name?: string
  username?: string
}

export interface DialogState {
  isAddPlanDialogOpen: boolean
  editingPlan: MaintenancePlan | null
  isAddTasksDialogOpen: boolean
  isBulkScheduleOpen: boolean
  isConfirmingCancel: boolean
  isConfirmingBulkDelete: boolean
}

export interface CompletionStatusEntry {
  historyId: number
}

export interface MaintenanceContextValue {
  user: AuthUser | null
  isRegionalLeader: boolean
  canManagePlans: boolean
  canCompleteTask: boolean

  selectedPlan: MaintenancePlan | null
  setSelectedPlan: React.Dispatch<React.SetStateAction<MaintenancePlan | null>>
  activeTab: string
  setActiveTab: React.Dispatch<React.SetStateAction<string>>

  dialogState: DialogState
  setIsAddPlanDialogOpen: (open: boolean) => void
  setEditingPlan: (plan: MaintenancePlan | null) => void
  setIsAddTasksDialogOpen: (open: boolean) => void
  setIsBulkScheduleOpen: (open: boolean) => void
  setIsConfirmingCancel: (open: boolean) => void
  setIsConfirmingBulkDelete: (open: boolean) => void

  tasks: MaintenanceTask[]
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  hasChanges: boolean
  isLoadingTasks: boolean
  isSavingAll: boolean
  fetchPlanDetails: (plan: MaintenancePlan) => Promise<void>
  handleSaveAllChanges: () => Promise<void>
  handleCancelAllChanges: () => void
  getDraftCacheKey: (planId: number) => string

  taskEditing: ReturnType<typeof useTaskEditing>

  completionStatus: Record<string, CompletionStatusEntry>
  isLoadingCompletion: boolean
  isCompletingTask: string | null
  handleMarkAsCompleted: (task: MaintenanceTask, month: number) => Promise<void>

  operations: ReturnType<typeof useMaintenanceOperations>

  generatePlanForm: () => void
  isPrintGenerating: boolean

  existingEquipmentIdsInDraft: number[]
  handleAddTasksFromDialog: (newlySelectedEquipment: Equipment[]) => void
  handleSelectPlan: (plan: MaintenancePlan) => void
  onPlanMutationSuccess: () => void
  handleBulkScheduleApply: (months: Record<string, boolean>) => void
  handleBulkAssignUnit: (unit: string | null) => void
  confirmDeleteSingleTask: () => void
  confirmDeleteSelectedTasks: () => void
  isPlanApproved: boolean
  selectedTaskRowsCount: number
  taskRowSelection: RowSelectionState
  setTaskRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
}
