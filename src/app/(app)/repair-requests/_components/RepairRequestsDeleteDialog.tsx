"use client"

import * as React from "react"

import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

/**
 * Delete confirmation dialog for the selected repair request.
 */
export function RepairRequestsDeleteDialog() {
  const {
    dialogState: { requestToDelete },
    closeAllDialogs,
    deleteMutation,
  } = useRepairRequestsContext()

  const handleConfirm = () => {
    if (!requestToDelete) return
    deleteMutation.mutate(requestToDelete.id, { onSuccess: closeAllDialogs })
  }

  if (!requestToDelete) return null

  return (
    <DestructiveConfirmDialog
      open={!!requestToDelete}
      onOpenChange={(open) => !open && closeAllDialogs()}
      title="Bạn có chắc chắn muốn xóa?"
      description={
        <>
          Hành động này không thể hoàn tác. Yêu cầu sửa chữa cho thiết bị
          <strong> {requestToDelete.thiet_bi?.ten_thiet_bi} </strong>
          sẽ bị xóa vĩnh viễn.
        </>
      }
      confirmLabel="Xóa"
      isPending={deleteMutation.isPending}
      onConfirm={handleConfirm}
    />
  )
}
