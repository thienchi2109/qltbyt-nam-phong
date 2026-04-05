"use client"

import * as React from "react"
import type { QueryClient } from "@tanstack/react-query"
import {
  maintenanceKeys,
  type MaintenancePlan,
  type MaintenancePlanListResponse,
} from "@/hooks/use-cached-maintenance"
import type { Equipment, MaintenanceTask } from "@/lib/data"
import type { DialogState } from "../_components/maintenance-context.types"
import {
  findPlanInCachedResponses,
  getNextMaintenanceTempTaskId,
} from "../_components/MaintenanceContextHelpers"

interface UseMaintenanceDialogActionsOptions {
  selectedPlan: MaintenancePlan | null
  setSelectedPlan: React.Dispatch<React.SetStateAction<MaintenancePlan | null>>
  setActiveTab: React.Dispatch<React.SetStateAction<string>>
  hasChanges: boolean
  cancelAllChanges: () => void
  saveAllChanges: () => Promise<void>
  fetchTasks: (plan: MaintenancePlan) => Promise<void>
  draftTasks: MaintenanceTask[]
  setDraftTasks: React.Dispatch<React.SetStateAction<MaintenanceTask[]>>
  toast: (opts: { variant?: "destructive"; title: string; description?: string }) => void
  queryClient: QueryClient
}

export function useMaintenanceDialogActions({
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
}: UseMaintenanceDialogActionsOptions) {
  const [pendingPlanSelection, setPendingPlanSelection] = React.useState<MaintenancePlan | null>(null)

  const [dialogState, setDialogState] = React.useState<DialogState>({
    isAddPlanDialogOpen: false,
    editingPlan: null,
    isAddTasksDialogOpen: false,
    isBulkScheduleOpen: false,
    isConfirmingCancel: false,
    isConfirmingBulkDelete: false,
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

  const handleCancelAllChanges = React.useCallback(() => {
    const nextPlan = pendingPlanSelection
    cancelAllChanges()
    setPendingPlanSelection(null)
    setDialogState((prev) => ({ ...prev, isConfirmingCancel: false }))

    if (nextPlan) {
      setSelectedPlan(nextPlan)
      setActiveTab("tasks")
    }
  }, [cancelAllChanges, pendingPlanSelection, setSelectedPlan, setActiveTab])

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
    [hasChanges, selectedPlan, setIsConfirmingCancel, setSelectedPlan, setActiveTab]
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
  }, [queryClient, setSelectedPlan])

  return {
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
  }
}
