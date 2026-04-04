"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import {
  maintenanceKeys,
  type MaintenancePlan,
  type MaintenancePlanListResponse,
} from "@/hooks/use-cached-maintenance"
import type { Equipment, MaintenanceTask } from "@/lib/data"
import { useMaintenanceOperations } from "../_hooks/use-maintenance-operations"
import { useMaintenancePrint } from "../_hooks/use-maintenance-print"
import { useMaintenanceDrafts } from "../_hooks/use-maintenance-drafts"
import { useMaintenanceCompletion } from "../_hooks/use-maintenance-completion"
import { useTaskEditing } from "./task-editing"
import {
  findPlanInCachedResponses,
  getNextMaintenanceTempTaskId,
} from "./MaintenanceContextHelpers"
import type {
  AuthUser,
  DialogState,
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
  const { data: session } = useSession()
  const user: AuthUser | null = session?.user ?? null

  const isRegionalLeader = isRegionalLeaderRole(user?.role)
  const canManagePlans = isEquipmentManagerRole(user?.role)
  const canCompleteTask = !isRegionalLeader && isEquipmentManagerRole(user?.role)

  const [selectedPlan, setSelectedPlan] = React.useState<MaintenancePlan | null>(null)
  const [pendingPlanSelection, setPendingPlanSelection] = React.useState<MaintenancePlan | null>(null)
  const [activeTab, setActiveTab] = React.useState("plans")

  const [dialogState, setDialogState] = React.useState<DialogState>({
    isAddPlanDialogOpen: false,
    editingPlan: null,
    isAddTasksDialogOpen: false,
    isBulkScheduleOpen: false,
    isConfirmingCancel: false,
    isConfirmingBulkDelete: false,
  })

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

  const setIsAddPlanDialogOpen = React.useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, isAddPlanDialogOpen: open }))
  }, [])

  const setEditingPlan = React.useCallback((plan: MaintenancePlan | null) => {
    setDialogState((prev) => ({ ...prev, editingPlan: plan }))
  }, [])

  const setIsAddTasksDialogOpen = React.useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, isAddTasksDialogOpen: open }))
  }, [])

  const setIsBulkScheduleOpen = React.useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, isBulkScheduleOpen: open }))
  }, [])

  const setIsConfirmingCancel = React.useCallback(
    (open: boolean) => {
      setDialogState((prev) => ({ ...prev, isConfirmingCancel: open }))

      if (!open) {
        setPendingPlanSelection(null)
      }
    },
    []
  )

  const setIsConfirmingBulkDelete = React.useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, isConfirmingBulkDelete: open }))
  }, [])

  const fetchPlanDetails = React.useCallback(
    async (plan: MaintenancePlan) => {
      await fetchTasks(plan)
    },
    [fetchTasks]
  )

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

  const handleCancelAllChanges = React.useCallback(() => {
    const nextPlan = pendingPlanSelection
    cancelAllChanges()
    setPendingPlanSelection(null)
    setDialogState((prev) => ({ ...prev, isConfirmingCancel: false }))

    if (nextPlan) {
      setSelectedPlan(nextPlan)
      setActiveTab("tasks")
    }
  }, [cancelAllChanges, pendingPlanSelection])

  const handleSaveAllChanges = React.useCallback(async () => {
    await saveAllChanges()
  }, [saveAllChanges])

  const handleSelectPlan = React.useCallback(
    (plan: MaintenancePlan) => {
      if (hasChanges && selectedPlan) {
        setPendingPlanSelection(plan)
        setIsConfirmingCancel(true)
        return
      }

      setSelectedPlan(plan)
      setActiveTab("tasks")
    },
    [hasChanges, selectedPlan, setIsConfirmingCancel]
  )

  const existingEquipmentIdsInDraft = React.useMemo(
    () => draftTasks.map((task) => task.thiet_bi_id).filter((id): id is number => id !== null),
    [draftTasks]
  )

  const handleAddTasksFromDialog = React.useCallback(
    (newlySelectedEquipment: Equipment[]) => {
      if (!selectedPlan) return

      setDraftTasks((currentDrafts) => {
        let tempIdCounter = getNextMaintenanceTempTaskId(currentDrafts)

        const tasksToAdd: MaintenanceTask[] = newlySelectedEquipment.map((equipment) => ({
          id: tempIdCounter--,
          ke_hoach_id: selectedPlan.id,
          thiet_bi_id: equipment.id,
          loai_cong_viec: selectedPlan.loai_cong_viec,
          diem_hieu_chuan: null,
          don_vi_thuc_hien: null,
          thang_1: false,
          thang_2: false,
          thang_3: false,
          thang_4: false,
          thang_5: false,
          thang_6: false,
          thang_7: false,
          thang_8: false,
          thang_9: false,
          thang_10: false,
          thang_11: false,
          thang_12: false,
          ghi_chu: null,
          thiet_bi: {
            ma_thiet_bi: equipment.ma_thiet_bi,
            ten_thiet_bi: equipment.ten_thiet_bi,
            khoa_phong_quan_ly: equipment.khoa_phong_quan_ly,
          },
        }))

        return [...currentDrafts, ...tasksToAdd]
      })

      setIsAddTasksDialogOpen(false)
      toast({
        title: "Đã thêm vào bản nháp",
        description: `Đã thêm ${newlySelectedEquipment.length} thiết bị. Nhấn \"Lưu thay đổi\" để xác nhận.`,
      })
    },
    [selectedPlan, setDraftTasks, setIsAddTasksDialogOpen, toast]
  )

  const onPlanMutationSuccess = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: maintenanceKeys.planStatusCounts() })

    void queryClient
      .invalidateQueries({ queryKey: maintenanceKeys.plans() })
      .then(() => {
        setSelectedPlan((currentSelectedPlan) => {
          if (!currentSelectedPlan) {
            return null
          }

          const cachedResponses = queryClient.getQueriesData<MaintenancePlanListResponse>({
            queryKey: maintenanceKeys.plans(),
          })
          const refreshedSelectedPlan = findPlanInCachedResponses(cachedResponses, currentSelectedPlan.id)

          return refreshedSelectedPlan ?? currentSelectedPlan
        })
      })
      .catch(() => {
        // Keep existing selected plan when refresh fails.
      })
  }, [queryClient])

  const value: MaintenanceContextValue = React.useMemo(
    () => ({
      user,
      isRegionalLeader,
      canManagePlans,
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
      isRegionalLeader,
      canManagePlans,
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
