"use client"

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
import { Loader2 } from "lucide-react"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

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
    <AlertDialog open={!!requestToDelete} onOpenChange={(open) => !open && closeAllDialogs()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Yêu cầu sửa chữa cho thiết bị
            <strong> {requestToDelete.thiet_bi?.ten_thiet_bi} </strong>
            sẽ bị xóa vĩnh viễn.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xóa
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
