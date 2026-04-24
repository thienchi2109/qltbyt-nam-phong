"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { isEquipmentManagerRole, isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance"
import { useMaintenanceOperations } from "../_hooks/use-maintenance-operations"
import { useMaintenancePrint } from "../_hooks/use-maintenance-print"
import { useMaintenanceDrafts } from "../_hooks/use-maintenance-drafts"
import { useMaintenanceCompletion } from "../_hooks/use-maintenance-completion"
import { useMaintenanceDialogActions } from "../_hooks/use-maintenance-dialog-actions"
import { useTaskEditing } from "./task-editing"
import type {
  AuthUser,
  MaintenanceContextValue,
} from "./maintenance-context.types"

export const MaintenanceContext = React.createContext<MaintenanceContextValue | null>(null)

interface MaintenanceProviderProps {
  children: React.ReactNode
  taskRowSelection: RowSelectionState
  setTaskRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
}

export { getNextMaintenanceTempTaskId } from "./MaintenanceContextHelpers"

export function MaintenanceProvider({
  children,
  taskRowSelection,
  setTaskRowSelection,
}: MaintenanceProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session, status: sessionStatus } = useSession()
  const user: AuthUser | null = session?.user ?? null

  const isAuthLoading = sessionStatus === "loading"
  const isRegionalLeader = isRegionalLeaderRole(user?.role)
  const canManagePlans = isEquipmentManagerRole(user?.role)
  const canCreatePlans = canManagePlans && !isGlobalRole(user?.role) && !isRegionalLeader
  const canCompleteTask = !isRegionalLeader && isEquipmentManagerRole(user?.role)

  const [selectedPlan, setSelectedPlan] = React.useState<MaintenancePlan | null>(null)
  const [activeTab, setActiveTab] = React.useState("plans")

  const isPlanApproved = selectedPlan?.trang_thai === "Đã duyệt"

  const maintenanceDrafts = useMaintenanceDrafts({ selectedPlan })
  const {
    tasks,
    draftTasks,
    setDraftTasks,
    hasChanges,
    isLoading: isLoadingTasks,
    isSaving: isSavingAll,
    fetchTasks,
    saveAllChanges,
    cancelAllChanges,
    getDraftCacheKey,
  } = maintenanceDrafts
  const isLoadingCompletion =
    Boolean(selectedPlan && selectedPlan.trang_thai === "Đã duyệt") && isLoadingTasks

  const taskEditing = useTaskEditing({
    draftTasks,
    setDraftTasks,
    canManagePlans,
    isPlanApproved,
  })
  const {
    editingTaskId,
    editingTaskData,
    taskToDelete,
    setTaskToDelete,
    handleStartEdit,
    handleCancelEdit,
    handleTaskDataChange,
    handleSaveTask,
  } = taskEditing
  const taskEditingValue = React.useMemo(
    () => ({
      editingTaskId,
      editingTaskData,
      taskToDelete,
      setTaskToDelete,
      handleStartEdit,
      handleCancelEdit,
      handleTaskDataChange,
      handleSaveTask,
    }),
    [
      editingTaskId,
      editingTaskData,
      taskToDelete,
      setTaskToDelete,
      handleStartEdit,
      handleCancelEdit,
      handleTaskDataChange,
      handleSaveTask,
    ]
  )

  const operations = useMaintenanceOperations({
    selectedPlan,
    setSelectedPlan,
    setActiveTab,
    getDraftCacheKey,
    user,
  })
  const {
    confirmDialog,
    setRejectionReason,
    closeDialog,
    openApproveDialog,
    openRejectDialog,
    openDeleteDialog,
    handleApprovePlan,
    handleRejectPlan,
    handleDeletePlan,
    isApproving,
    isRejecting,
    isDeleting,
  } = operations
  const operationsValue = React.useMemo(
    () => ({
      confirmDialog,
      setRejectionReason,
      closeDialog,
      openApproveDialog,
      openRejectDialog,
      openDeleteDialog,
      handleApprovePlan,
      handleRejectPlan,
      handleDeletePlan,
      isApproving,
      isRejecting,
      isDeleting,
    }),
    [
      confirmDialog,
      setRejectionReason,
      closeDialog,
      openApproveDialog,
      openRejectDialog,
      openDeleteDialog,
      handleApprovePlan,
      handleRejectPlan,
      handleDeletePlan,
      isApproving,
      isRejecting,
      isDeleting,
    ]
  )

  const { generatePlanForm, isGenerating: isPrintGenerating } = useMaintenancePrint({
    selectedPlan,
    tasks,
    user,
  })

  const dialogActions = useMaintenanceDialogActions({
    selectedPlan,
    setSelectedPlan,
    setActiveTab,
    hasChanges,
    cancelAllChanges,
    saveAllChanges,
    fetchTasks,
    draftTasks,
    setDraftTasks,
    toast,
    queryClient,
  })
  const {
    dialogState,
    setIsAddPlanDialogOpen,
    setEditingPlan,
    setIsAddTasksDialogOpen,
    setIsBulkScheduleOpen,
    setIsConfirmingCancel,
    setIsConfirmingBulkDelete,
    fetchPlanDetails,
    handleCancelAllChanges,
    handleSaveAllChanges,
    handleSelectPlan,
    existingEquipmentIdsInDraft,
    handleAddTasksFromDialog,
    onPlanMutationSuccess,
  } = dialogActions

  const completion = useMaintenanceCompletion({
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
  })
  const {
    completionStatus,
    isCompletingTask,
    selectedTaskRowsCount,
    handleMarkAsCompleted,
    handleBulkScheduleApply,
    handleBulkAssignUnit,
    confirmDeleteSingleTask,
    confirmDeleteSelectedTasks,
  } = completion

  const value: MaintenanceContextValue = React.useMemo(
    () => ({
      user,
      isAuthLoading,
      isRegionalLeader,
      canManagePlans,
      canCreatePlans,
      canCompleteTask,

      selectedPlan,
      setSelectedPlan,
      activeTab,
      setActiveTab,

      dialogState,
      setIsAddPlanDialogOpen,
      setEditingPlan,
      setIsAddTasksDialogOpen,
      setIsBulkScheduleOpen,
      setIsConfirmingCancel,
      setIsConfirmingBulkDelete,

      tasks,
      draftTasks,
      setDraftTasks,
      hasChanges,
      isLoadingTasks,
      isSavingAll,
      fetchPlanDetails,
      handleSaveAllChanges,
      handleCancelAllChanges,
      getDraftCacheKey,

      taskEditing: taskEditingValue,

      completionStatus,
      isLoadingCompletion,
      isCompletingTask,
      handleMarkAsCompleted,

      operations: operationsValue,

      generatePlanForm,
      isPrintGenerating,

      existingEquipmentIdsInDraft,
      handleAddTasksFromDialog,
      handleSelectPlan,
      onPlanMutationSuccess,
      handleBulkScheduleApply,
      handleBulkAssignUnit,
      confirmDeleteSingleTask,
      confirmDeleteSelectedTasks,
      isPlanApproved,
      selectedTaskRowsCount,
      taskRowSelection,
      setTaskRowSelection,
    }),
    [
      user,
      isAuthLoading,
      isRegionalLeader,
      canManagePlans,
      canCreatePlans,
      canCompleteTask,
      selectedPlan,
      activeTab,
      dialogState,
      setIsAddPlanDialogOpen,
      setEditingPlan,
      setIsAddTasksDialogOpen,
      setIsBulkScheduleOpen,
      setIsConfirmingCancel,
      setIsConfirmingBulkDelete,
      tasks,
      draftTasks,
      setDraftTasks,
      hasChanges,
      isLoadingTasks,
      isSavingAll,
      fetchPlanDetails,
      handleSaveAllChanges,
      handleCancelAllChanges,
      getDraftCacheKey,
      taskEditingValue,
      completionStatus,
      isLoadingCompletion,
      isCompletingTask,
      handleMarkAsCompleted,
      operationsValue,
      generatePlanForm,
      isPrintGenerating,
      existingEquipmentIdsInDraft,
      handleAddTasksFromDialog,
      handleSelectPlan,
      onPlanMutationSuccess,
      handleBulkScheduleApply,
      handleBulkAssignUnit,
      confirmDeleteSingleTask,
      confirmDeleteSelectedTasks,
      isPlanApproved,
      selectedTaskRowsCount,
      taskRowSelection,
      setTaskRowSelection,
    ]
  )

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>
}
