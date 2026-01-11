"use client"

import * as React from "react"
import {
  flexRender,
  type Table as TanStackTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"

import type { RepairRequestWithEquipment } from "../types"


interface RepairRequestsTableProps {
  table: TanStackTable<RepairRequestWithEquipment>
  isLoading: boolean
}

export function RepairRequestsTable({
  table,
  isLoading
}: RepairRequestsTableProps) {
  const { openViewDialog } = useRepairRequestsContext()
  const columns = table.getAllColumns()

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-muted/50 border-b border-border/60">
              {headerGroup.headers.map((header, colIdx) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider text-muted-foreground py-3 h-10",
                    colIdx === 0 && "sticky left-0 z-20 bg-muted/50 w-[20rem] min-w-[20rem] max-w-[20rem] border-r shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]",
                    colIdx === 1 && "sticky left-[20rem] z-20 bg-muted/50 w-[14rem] min-w-[14rem] max-w-[14rem] border-r shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]"
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center py-3"
              >
                <div className="flex justify-center items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang tải dữ liệu...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              // Row logic simplified - removed side stripes
              return (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  tabIndex={0}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-muted/40 focus:bg-muted/40 focus:outline-none border-b border-border/40 last:border-0",
                  )}
                  onClick={() => openViewDialog(row.original)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") openViewDialog(row.original)
                  }}
                >
                  {row.getVisibleCells().map((cell, colIdx) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "align-top py-3 whitespace-normal break-words", // Align top for better readability
                        colIdx === 0 && "sticky left-0 z-10 bg-background/95 backdrop-blur-sm w-[20rem] min-w-[20rem] max-w-[20rem] border-r shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]",
                        colIdx === 1 && "sticky left-[20rem] z-10 bg-background/95 backdrop-blur-sm w-[14rem] min-w-[14rem] max-w-[14rem] border-r shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)]"
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-lg font-medium">Không tìm thấy yêu cầu nào</span>
                  <span className="text-sm">Thử thay đổi bộ lọc hoặc tìm kiếm lại</span>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
