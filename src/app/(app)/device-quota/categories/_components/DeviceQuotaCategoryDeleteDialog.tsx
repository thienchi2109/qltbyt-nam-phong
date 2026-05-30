"use client"

import * as React from "react"

import { DestructiveConfirmDialog } from "@/components/shared/DestructiveConfirmDialog"
import { useDeviceQuotaCategoryContext } from "../_hooks/useDeviceQuotaCategoryContext"

/**
 * Delete confirmation dialog for the selected device quota category.
 */
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
    <DestructiveConfirmDialog
      open={!!categoryToDelete}
      onOpenChange={(open) => !open && closeDeleteDialog()}
      title="Bạn có chắc chắn muốn xóa?"
      description={
        <>
          Hành động này không thể hoàn tác. Danh mục
          <strong> {categoryToDelete.ten_nhom} </strong>
          sẽ bị xóa vĩnh viễn nếu không có ràng buộc.
        </>
      }
      confirmLabel="Xóa danh mục"
      isPending={isPending}
      onConfirm={handleConfirm}
    />
  )
}
