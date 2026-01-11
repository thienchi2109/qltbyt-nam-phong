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
import { calculateDaysRemaining } from "../utils"
import type { RepairRequestWithEquipment } from "../types"
import type { ViewDensity, TextWrap as TextWrapPref } from "@/lib/rr-prefs"

interface RepairRequestsTableProps {
  table: TanStackTable<RepairRequestWithEquipment>
  isLoading: boolean
  density: ViewDensity
  textWrap: TextWrapPref
}

export function RepairRequestsTable({
  table,
  isLoading,
  density,
  textWrap
}: RepairRequestsTableProps) {
  const { openViewDialog } = useRepairRequestsContext()
  const columns = table.getAllColumns()

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header, colIdx) => (
              <TableHead
                key={header.id}
                className={cn(
                  density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2",
                  colIdx === 0 && "sticky left-0 z-20 bg-background w-[20rem] min-w-[20rem] max-w-[20rem] border-r",
                  colIdx === 1 && "sticky left-[20rem] z-20 bg-background w-[14rem] min-w-[14rem] max-w-[14rem] border-r"
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
              className={cn(
                "h-24 text-center",
                density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2"
              )}
            >
              <div className="flex justify-center items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tải...</span>
              </div>
            </TableCell>
          </TableRow>
        ) : table.getRowModel().rows?.length ? (
          table.getRowModel().rows.map((row) => {
            const req = row.original
            const isCompleted = req.trang_thai === "Hoàn thành" || req.trang_thai === "Không HT"
            const daysInfo = !isCompleted && req.ngay_mong_muon_hoan_thanh
              ? calculateDaysRemaining(req.ngay_mong_muon_hoan_thanh)
              : null
            const stripeClass = daysInfo
              ? daysInfo.status === "success"
                ? "border-l-4 border-green-500"
                : daysInfo.status === "warning"
                ? "border-l-4 border-orange-500"
                : "border-l-4 border-red-500"
              : ""

            return (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                tabIndex={0}
                className={cn("cursor-pointer hover:bg-muted/50 focus:outline-none", stripeClass)}
                onClick={() => openViewDialog(row.original)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openViewDialog(row.original)
                }}
              >
                {row.getVisibleCells().map((cell, colIdx) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      density === "compact" ? "py-1" : density === "spacious" ? "py-3" : "py-2",
                      colIdx === 0 && "sticky left-0 z-10 bg-background w-[20rem] min-w-[20rem] max-w-[20rem] border-r",
                      colIdx === 1 && "sticky left-[20rem] z-10 bg-background w-[14rem] min-w-[14rem] max-w-[14rem] border-r",
                      textWrap === "truncate" ? "truncate" : "whitespace-normal break-words"
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
            <TableCell colSpan={columns.length} className="h-24 text-center">
              Không có kết quả.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
