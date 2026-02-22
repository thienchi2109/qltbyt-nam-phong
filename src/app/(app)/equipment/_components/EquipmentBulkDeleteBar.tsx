"use client"

import * as React from "react"
import type { Table } from "@tanstack/react-table"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { BulkActionBar } from "@/components/ui/data-table-selection"
import { useBulkDeleteEquipment } from "@/hooks/use-cached-equipment"
import type { Equipment } from "@/types/database"

interface EquipmentBulkDeleteBarProps {
  table: Table<Equipment>
  canBulkSelect: boolean
  isCardView: boolean
}

export function EquipmentBulkDeleteBar({
  table,
  canBulkSelect,
  isCardView,
}: EquipmentBulkDeleteBarProps) {
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const { mutate: bulkDelete, isPending: isDeleting } = useBulkDeleteEquipment()

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedIds = React.useMemo(
    () =>
      selectedRows
        .map((row) => Number(row.original.id))
        .filter((id) => Number.isFinite(id)),
    [selectedRows]
  )
  const selectedCount = selectedIds.length

  React.useEffect(() => {
    if (selectedCount === 0 && isConfirmOpen) {
      setIsConfirmOpen(false)
    }
  }, [selectedCount, isConfirmOpen])

  const handleConfirmDelete = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (selectedIds.length === 0 || isDeleting) return

      bulkDelete(selectedIds, {
        onSuccess: () => {
          setIsConfirmOpen(false)
          table.resetRowSelection()
        },
      })
    },
    [selectedIds, isDeleting, bulkDelete, table]
  )

  if (!canBulkSelect || isCardView) {
    return null
  }

  return (
    <BulkActionBar
      selectedCount={selectedCount}
      onClearSelection={() => table.resetRowSelection()}
      entityLabel="thiết bị"
    >
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" variant="destructive" disabled={isDeleting}>
            Xóa đã chọn
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent onClick={(event) => event.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa các thiết bị đã chọn?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Hành động này sẽ xóa mềm ${selectedCount} thiết bị đã chọn. Bạn có thể khôi phục lại sau nếu cần.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(event) => {
                event.stopPropagation()
                setIsConfirmOpen(false)
              }}
            >
              Hủy
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={selectedCount === 0 || isDeleting}
            >
              {isDeleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BulkActionBar>
  )
}
