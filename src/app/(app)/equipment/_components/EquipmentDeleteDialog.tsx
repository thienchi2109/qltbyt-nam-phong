"use client"

import * as React from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDeleteEquipment } from "@/hooks/use-cached-equipment"
import { useEquipmentContext } from "../_hooks/useEquipmentContext"

export function EquipmentDeleteDialog() {
  const { dialogState, closeDeleteDialog, closeDetailDialog } = useEquipmentContext()
  const { mutate: deleteEquipment, isPending: isDeleting } = useDeleteEquipment()

  const { isDeleteOpen, deleteTarget, deleteSource } = dialogState

  const handleDeleteEquipment = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (!deleteTarget || isDeleting) return

      deleteEquipment(String(deleteTarget.id), {
        onSuccess: () => {
          closeDeleteDialog()
          if (deleteSource === "detail_dialog") {
            closeDetailDialog()
          }
        },
      })
    },
    [deleteTarget, isDeleting, deleteEquipment, closeDeleteDialog, deleteSource, closeDetailDialog]
  )

  if (!deleteTarget) {
    return null
  }

  return (
    <AlertDialog
      open={isDeleteOpen}
      onOpenChange={(open) => {
        if (!open) closeDeleteDialog()
      }}
    >
      <AlertDialogContent onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn muốn xóa thiết bị này không?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này sẽ chuyển thiết bị vào thùng rác (xóa mềm). Bạn có thể khôi phục lại sau nếu cần.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={(event) => {
              event.stopPropagation()
              closeDeleteDialog()
            }}
          >
            Hủy
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteEquipment}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? "Đang xóa..." : "Xóa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
