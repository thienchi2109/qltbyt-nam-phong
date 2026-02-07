"use client"

import * as React from "react"
import {
  useApproveMaintenancePlan,
  useRejectMaintenancePlan,
  useDeleteMaintenancePlan,
  type MaintenancePlan,
} from "@/hooks/use-cached-maintenance"

interface UseMaintenanceOperationsParams {
  selectedPlan: MaintenancePlan | null
  setSelectedPlan: React.Dispatch<React.SetStateAction<MaintenancePlan | null>>
  setActiveTab: React.Dispatch<React.SetStateAction<string>>
  getDraftCacheKey: (planId: number) => string
  user: { full_name?: string | null; username?: string | null } | null
}

interface ConfirmDialogState {
  type: 'approve' | 'reject' | 'delete' | null
  plan: MaintenancePlan | null
  rejectionReason: string
}

export function useMaintenanceOperations({
  selectedPlan,
  setSelectedPlan,
  setActiveTab,
  getDraftCacheKey,
  user,
}: UseMaintenanceOperationsParams) {
  // Dialog state
  const [confirmDialog, setConfirmDialog] = React.useState<ConfirmDialogState>({
    type: null,
    plan: null,
    rejectionReason: "",
  })

  // Mutations from cached hook
  const { mutate: approvePlan, isPending: isApproving } = useApproveMaintenancePlan()
  const { mutate: rejectPlan, isPending: isRejecting } = useRejectMaintenancePlan()
  const { mutate: deletePlan, isPending: isDeleting } = useDeleteMaintenancePlan()

  // Dialog openers
  const openApproveDialog = React.useCallback((plan: MaintenancePlan) => {
    setConfirmDialog({ type: 'approve', plan, rejectionReason: "" })
  }, [])

  const openRejectDialog = React.useCallback((plan: MaintenancePlan) => {
    setConfirmDialog({ type: 'reject', plan, rejectionReason: "" })
  }, [])

  const openDeleteDialog = React.useCallback((plan: MaintenancePlan) => {
    setConfirmDialog({ type: 'delete', plan, rejectionReason: "" })
  }, [])

  const closeDialog = React.useCallback(() => {
    setConfirmDialog({ type: null, plan: null, rejectionReason: "" })
  }, [])

  const setRejectionReason = React.useCallback((reason: string) => {
    setConfirmDialog(prev => ({ ...prev, rejectionReason: reason }))
  }, [])

  // Approve handler
  const handleApprovePlan = React.useCallback(() => {
    const planToApprove = confirmDialog.plan
    if (!planToApprove) return

    approvePlan(
      {
        id: planToApprove.id,
        nguoi_duyet: user?.full_name || user?.username || ''
      },
      {
        onSuccess: () => {
          if (selectedPlan && selectedPlan.id === planToApprove.id) {
            const updatedPlan = {
              ...selectedPlan,
              trang_thai: 'Đã duyệt' as const,
              ngay_phe_duyet: new Date().toISOString()
            }
            setSelectedPlan(updatedPlan)
          }
          closeDialog()
        },
        onError: () => {
          closeDialog()
        }
      }
    )
  }, [confirmDialog.plan, approvePlan, selectedPlan, setSelectedPlan, user, closeDialog])

  // Reject handler
  const handleRejectPlan = React.useCallback(() => {
    const planToReject = confirmDialog.plan
    const reason = confirmDialog.rejectionReason
    if (!planToReject || !reason.trim()) return

    rejectPlan(
      {
        id: planToReject.id,
        nguoi_duyet: user?.full_name || user?.username || '',
        ly_do: reason.trim()
      },
      {
        onSuccess: () => {
          if (selectedPlan && selectedPlan.id === planToReject.id) {
            const updatedPlan = {
              ...selectedPlan,
              trang_thai: 'Không duyệt' as const,
              ngay_phe_duyet: new Date().toISOString()
            }
            setSelectedPlan(updatedPlan)
          }
          closeDialog()
        },
        onError: () => {
          closeDialog()
        }
      }
    )
  }, [confirmDialog.plan, confirmDialog.rejectionReason, rejectPlan, selectedPlan, setSelectedPlan, user, closeDialog])

  // Delete handler
  const handleDeletePlan = React.useCallback(() => {
    const planToDelete = confirmDialog.plan
    if (!planToDelete) return

    deletePlan(
      planToDelete.id,
      {
        onSuccess: () => {
          localStorage.removeItem(getDraftCacheKey(planToDelete.id))
          if (selectedPlan && selectedPlan.id === planToDelete.id) {
            setSelectedPlan(null)
            setActiveTab("plans")
          }
          closeDialog()
        },
        onError: () => {
          closeDialog()
        }
      }
    )
  }, [confirmDialog.plan, deletePlan, selectedPlan, setSelectedPlan, setActiveTab, getDraftCacheKey, closeDialog])

  return React.useMemo(
    () => ({
      // Dialog state
      confirmDialog,
      setRejectionReason,
      closeDialog,

      // Dialog openers (for row actions)
      openApproveDialog,
      openRejectDialog,
      openDeleteDialog,

      // Confirmed actions (for dialog buttons)
      handleApprovePlan,
      handleRejectPlan,
      handleDeletePlan,

      // Loading states
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
}
