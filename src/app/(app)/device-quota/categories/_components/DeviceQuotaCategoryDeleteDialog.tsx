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

import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

export function DeviceQuotaCategoryDeleteDialog() {
  const {
    categoryToDelete,
    closeDeleteDialog,
    deleteMutation,
    mutatingCategoryId,
  } = useDeviceQuotaCategoryContext()

  if (!categoryToDelete) return null

  const isPending = deleteMutation.isPending || mutatingCategoryId === categoryToDelete.id

  const handleConfirm = () => {
    deleteMutation.mutate(categoryToDelete.id)
  }

  return (
    <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && closeDeleteDialog()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Danh mục
            <strong> {categoryToDelete.ten_nhom} </strong>
            sẽ bị xóa vĩnh viễn nếu không có ràng buộc.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Hủy</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xóa danh mục
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
