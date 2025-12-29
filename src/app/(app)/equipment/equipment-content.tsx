"use client"

import * as React from "react"
import type { ColumnDef, Table } from "@tanstack/react-table"
import { flexRender } from "@tanstack/react-table"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MobileEquipmentListItem } from "@/components/mobile-equipment-list-item"
import type { Equipment } from "@/types/database"

export interface EquipmentContentProps {
  isGlobal: boolean
  shouldFetchEquipment: boolean
  isLoading: boolean
  isFetching: boolean
  isCardView: boolean
  table: Table<Equipment>
  columns: ColumnDef<Equipment>[]
  onShowDetails: (equipment: Equipment) => void
  onEdit: (equipment: Equipment | null) => void
}

export function EquipmentContent({
  isGlobal,
  shouldFetchEquipment,
  isLoading,
  isFetching,
  isCardView,
  table,
  columns,
  onShowDetails,
  onEdit,
}: EquipmentContentProps) {
  // Global users must select a tenant first
  if (isGlobal && !shouldFetchEquipment) {
    return (
      <div className="p-4 border rounded-md bg-muted/30 text-sm text-muted-foreground">
        Vui lòng chọn đơn vị cụ thể ở bộ lọc để xem dữ liệu thiết bị
      </div>
    )
  }

  // Loading skeleton
  if (isLoading) {
    return isCardView ? (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-start justify-between pb-4">
              <div>
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-8 w-8 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    ) : (
      <UITable>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <Skeleton className="h-5 w-full" />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {Array.from({ length: 10 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={columns.length}>
                <Skeleton className="h-8 w-full" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    )
  }

  // Empty state
  if (table.getRowModel().rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Không tìm thấy kết quả phù hợp
      </div>
    )
  }

  // Card view (mobile/tablet)
  if (isCardView) {
    return (
      <div className="relative space-y-3">
        {isFetching && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {table.getRowModel().rows.map((row) => (
          <MobileEquipmentListItem
            key={row.original.id}
            equipment={row.original}
            onShowDetails={onShowDetails}
            onEdit={onEdit}
          />
        ))}
      </div>
    )
  }

  // Table view (desktop)
  return (
    <div className="relative overflow-x-auto rounded-md border">
      {isFetching && (
        <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] flex items-center justify-center z-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <UITable>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted hover:bg-muted">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              data-equipment-id={row.original.id}
              className="hover:bg-muted cursor-pointer"
              onClick={() => onShowDetails(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </UITable>
    </div>
  )
}
