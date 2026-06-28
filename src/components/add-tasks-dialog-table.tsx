import * as React from "react"
import type { Table as ReactTable } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Equipment } from "@/lib/data"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface AddTasksEquipmentTableProps {
  table: ReactTable<Equipment>
  columnCount: number
  missingPlanTenant: boolean
  isLoading: boolean
  error: Error | null
}

/** Renders the add-tasks equipment table body states and selectable rows. */
export function AddTasksEquipmentTable({
  table,
  columnCount,
  missingPlanTenant,
  isLoading,
  error,
}: AddTasksEquipmentTableProps) {
  return (
    <div className="flex-grow rounded-md border overflow-hidden">
      <ScrollArea className="h-full">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {missingPlanTenant ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-destructive">
                  Không xác định được đơn vị của kế hoạch.
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-destructive">
                  Không thể tải thiết bị. Vui lòng thử lại sau.
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center">
                  <Loader2 className="mx-auto size-6 animate-spin" />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(!row.getCanSelect() && "bg-muted/50 text-muted-foreground")}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center">
                  Không tìm thấy kết quả phù hợp
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
