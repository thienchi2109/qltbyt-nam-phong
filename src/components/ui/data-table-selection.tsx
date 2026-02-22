"use client"

import * as React from "react"
import type { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

function stopPropagation(event: React.MouseEvent<HTMLDivElement>) {
  event.stopPropagation()
}

/**
 * Reusable selection column for TanStack Table page-scoped row selection.
 *
 * Consumers should set `getRowId` in their table config to avoid index-based
 * row identity drift when sorting or paginating.
 */
export function createSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Chọn tất cả"
        disabled={!table.getRowModel().rows.some((row) => row.getCanSelect())}
      />
    ),
    cell: ({ row }) => (
      <div onClick={stopPropagation}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Chọn dòng"
          disabled={!row.getCanSelect()}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  }
}

interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  entityLabel?: string
  children: React.ReactNode
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  entityLabel = "mục",
  children,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <p className="text-sm text-foreground">
        Đã chọn <strong>{selectedCount}</strong> {entityLabel}
      </p>
      <div className="ml-auto flex items-center gap-2">
        {children}
        <Button variant="ghost" size="sm" type="button" onClick={onClearSelection}>
          Bỏ chọn
        </Button>
      </div>
    </div>
  )
}
