"use client"

import * as React from "react"
import type { RowSelectionState } from "@tanstack/react-table"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { useToast } from "@/hooks/use-toast"
import { callRpc } from "@/lib/rpc-client"
import { isEquipmentManagerRole, isRegionalLeaderRole } from "@/lib/rbac"
import { maintenanceKeys, type MaintenancePlan } from "@/hooks/use-cached-maintenance"
import type { Equipment, MaintenanceTask } from "@/lib/data"
import { useMaintenanceOperations } from "../_hooks/use-maintenance-operations"
import { useMaintenancePrint } from "../_hooks/use-maintenance-print"
import { useMaintenanceDrafts } from "../_hooks/use-maintenance-drafts"
import { useTaskEditing } from "./task-editing"
import type {
  AuthUser,
  CompletionStatusEntry,
  DialogState,
  MaintenanceContextValue,
} from "./maintenance-context.types"

export const MaintenanceContext = React.createContext<MaintenanceContextValue | null>(null)

interface MaintenanceProviderProps {
  children: React.ReactNode
  taskRowSelection: RowSelectionState
  setTaskRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>
}

function buildCompletionStatus(tasks: MaintenanceTask[]) {
  const statusMap: Record<string, CompletionStatusEntry> = {}

  tasks.forEach((task) => {
    for (let month = 1; month <= 12; month += 1) {
      const completed = Boolean((task as Record<string, unknown>)[`thang_${month}_hoan_thanh`])
      const completionDate = (task as Record<string, unknown>)[`ngay_hoan_thanh_${month}`]

      if (completed && completionDate) {
        statusMap[`${task.id}-${month}`] = { historyId: 0 }
      }
    }
  })

  return statusMap
}

function getSelectedTaskIds(taskRowSelection: RowSelectionState) {
  return Object.entries(taskRowSelection)
    .filter(([, selected]) => Boolean(selected))
    .map(([rowId]) => Number(rowId))
    .filter((id) => Number.isFinite(id))
}

export function MaintenanceProvider({
  children,
  taskRowSelection,
  setTaskRowSelection,
}: MaintenanceProviderProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const user = session?.user as AuthUser | null

  const isRegionalLeader = isRegionalLeaderRole(user?.role)
  const canManagePlans = isEquipmentManagerRole(user?.role)
  const canCompleteTask = !isRegionalLeader && isEquipmentManagerRole(user?.role)

  const [selectedPlan, setSelectedPlan] = React.useState<MaintenancePlan | null>(null)
  const [activeTab, setActiveTab] = React.useState("plans")

  const [dialogState, setDialogState] = React.useState<DialogState>({
    isAddPlanDialogOpen: false,
    editingPlan: null,
    isAddTasksDialogOpen: false,
    isBulkScheduleOpen: false,
    isConfirmingCancel: false,
    isConfirmingBulkDelete: false,
  })

  const [isDeletingTasks, setIsDeletingTasks] = React.useState(false)
  const [completionStatus, setCompletionStatus] = React.useState<Record<string, CompletionStatusEntry>>({})
  const [isLoadingCompletion, setIsLoadingCompletion] = React.useState(false)
  const [isCompletingTask, setIsCompletingTask] = React.useState<string | null>(null)

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

  const taskEditing = useTaskEditing({
    draftTasks,
    setDraftTasks,
    canManagePlans,
    isPlanApproved,
  })

  const operations = useMaintenanceOperations({
    selectedPlan,
    setSelectedPlan,
    setActiveTab,
    getDraftCacheKey,
    user,
  })

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

  const setIsConfirmingCancel = React.useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, isConfirmingCancel: open }))
  }, [])

  const setIsConfirmingBulkDelete = React.useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, isConfirmingBulkDelete: open }))
  }, [])

  const fetchPlanDetails = React.useCallback(
    async (plan: MaintenancePlan) => {
      setCompletionStatus({})
      await fetchTasks(plan)
    },
    [fetchTasks]
  )

  React.useEffect(() => {
    if (!selectedPlan || selectedPlan.trang_thai !== "Đã duyệt") {
      setCompletionStatus({})
      setIsLoadingCompletion(false)
      return
    }

    setIsLoadingCompletion(true)
    setCompletionStatus(buildCompletionStatus(tasks))
    setIsLoadingCompletion(false)
  }, [selectedPlan, tasks])

  const handleCancelAllChanges = React.useCallback(() => {
    cancelAllChanges()
    setIsConfirmingCancel(false)
  }, [cancelAllChanges, setIsConfirmingCancel])

  const handleSaveAllChanges = React.useCallback(async () => {
    await saveAllChanges()
  }, [saveAllChanges])

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
        const message = error instanceof Error ? error.message : "Lỗi không xác định"
        toast({
          variant: "destructive",
          title: "Lỗi",
          description: `Không thể ghi nhận hoàn thành. ${message}`,
        })
      } finally {
        setIsCompletingTask(null)
      }
    },
    [
      selectedPlan,
      user,
      canCompleteTask,
      completionStatus,
      isCompletingTask,
      toast,
      fetchPlanDetails,
    ]
  )

  const handleSelectPlan = React.useCallback(
    (plan: MaintenancePlan) => {
      if (hasChanges && selectedPlan) {
        const shouldDiscard = confirm(
          `Bạn có các thay đổi chưa lưu trong kế hoạch "${selectedPlan.ten_ke_hoach}". Bạn có muốn hủy các thay đổi và chuyển sang kế hoạch khác không?`
        )

        if (!shouldDiscard) {
          setActiveTab("tasks")
          return
        }

        handleCancelAllChanges()
      }

      setSelectedPlan(plan)
      setActiveTab("tasks")
    },
    [hasChanges, selectedPlan, handleCancelAllChanges]
  )

  const existingEquipmentIdsInDraft = React.useMemo(
    () => draftTasks.map((task) => task.thiet_bi_id).filter((id): id is number => id !== null),
    [draftTasks]
  )

  const handleAddTasksFromDialog = React.useCallback(
    (newlySelectedEquipment: Equipment[]) => {
      if (!selectedPlan) return

      setDraftTasks((currentDrafts) => {
        let tempIdCounter = Math.min(-1, ...currentDrafts.map((task) => task.id).filter((id) => id < 0), 0) - 1

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
    queryClient.invalidateQueries({ queryKey: maintenanceKeys.plans() })
  }, [queryClient])

  const selectedTaskIds = React.useMemo(() => getSelectedTaskIds(taskRowSelection), [taskRowSelection])
  const selectedTaskIdSet = React.useMemo(() => new Set(selectedTaskIds), [selectedTaskIds])
  const selectedTaskRowsCount = selectedTaskIds.length

  const handleBulkScheduleApply = React.useCallback(
    (months: Record<string, boolean>) => {
      if (selectedTaskIds.length === 0) {
        return
      }

      setDraftTasks((currentDrafts) =>
        currentDrafts.map((task) =>
          selectedTaskIdSet.has(task.id)
            ? { ...task, ...months }
            : task
        )
      )

      setIsBulkScheduleOpen(false)
      toast({ title: "Đã áp dụng lịch", description: "Lịch trình đã được cập nhật vào bản nháp." })
    },
    [selectedTaskIds.length, selectedTaskIdSet, setDraftTasks, setIsBulkScheduleOpen, toast]
  )

  const handleBulkAssignUnit = React.useCallback(
    (unit: string | null) => {
      if (selectedTaskIds.length === 0) {
        return
      }

      setDraftTasks((currentDrafts) =>
        currentDrafts.map((task) =>
          selectedTaskIdSet.has(task.id)
            ? { ...task, don_vi_thuc_hien: unit }
            : task
        )
      )

      toast({ title: "Đã gán đơn vị", description: "Đã cập nhật đơn vị thực hiện vào bản nháp." })
    },
    [selectedTaskIds.length, selectedTaskIdSet, setDraftTasks, toast]
  )

  const confirmDeleteSingleTask = React.useCallback(() => {
    const toDelete = taskEditing.taskToDelete
    if (!toDelete) {
      return
    }

    setIsDeletingTasks(true)
    setDraftTasks((currentDrafts) => currentDrafts.filter((task) => task.id !== toDelete.id))
    taskEditing.setTaskToDelete(null)
    setIsDeletingTasks(false)
    toast({ title: "Đã xóa khỏi bản nháp" })
  }, [taskEditing, setDraftTasks, toast])

  const confirmDeleteSelectedTasks = React.useCallback(() => {
    if (selectedTaskIds.length === 0) {
      return
    }

    setIsDeletingTasks(true)
    setDraftTasks((currentDrafts) => currentDrafts.filter((task) => !selectedTaskIdSet.has(task.id)))
    setTaskRowSelection({})
    setIsConfirmingBulkDelete(false)
    setIsDeletingTasks(false)
    toast({ title: "Đã xóa khỏi bản nháp", description: `Đã xóa ${selectedTaskIds.length} công việc.` })
  }, [selectedTaskIds.length, selectedTaskIdSet, setDraftTasks, setTaskRowSelection, setIsConfirmingBulkDelete, toast])

  const value: MaintenanceContextValue = {
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

    taskEditing,

    completionStatus,
    isLoadingCompletion,
    isCompletingTask,
    handleMarkAsCompleted,

    operations,

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
    isDeletingTasks,
    isPlanApproved,
    selectedTaskRowsCount,
    taskRowSelection,
    setTaskRowSelection,
  }

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>
}
