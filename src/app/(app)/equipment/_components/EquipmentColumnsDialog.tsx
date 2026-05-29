"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { columnLabels } from "@/components/equipment/equipment-table-columns"
import type { Equipment } from "@/types/database"
import type { Table } from "@tanstack/react-table"

import { useEquipmentContext } from "../_hooks/useEquipmentContext"

interface EquipmentColumnsDialogProps {
  table: Table<Equipment>
}

/** Renders the equipment table column visibility dialog. */
export function EquipmentColumnsDialog({
  table,
}: EquipmentColumnsDialogProps) {
  const { dialogState, closeColumnsDialog } = useEquipmentContext()
  const hideableColumns = React.useMemo(() => {
    const columns: ReturnType<typeof table.getAllColumns> = []
    for (const column of table.getAllColumns()) {
      if (column.getCanHide()) {
        columns.push(column)
      }
    }
    return columns
  }, [table])

  return (
    <Dialog open={dialogState.isColumnsOpen} onOpenChange={(open) => !open && closeColumnsDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hiện/Ẩn cột</DialogTitle>
          <DialogDescription>Chọn các cột muốn hiển thị trong bảng.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-y-auto space-y-1">
          {hideableColumns.map((column) => (
              <div key={column.id} className="flex items-center justify-between py-1">
                <span className="text-sm text-muted-foreground">
                  {columnLabels[column.id as keyof Equipment] || column.id}
                </span>
                <Button
                  variant={column.getIsVisible() ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7"
                  onClick={() => column.toggleVisibility(!column.getIsVisible())}
                >
                  {column.getIsVisible() ? 'Ẩn' : 'Hiện'}
                </Button>
              </div>
            ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closeColumnsDialog}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
