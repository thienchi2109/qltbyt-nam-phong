"use client"

import * as React from "react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState
} from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTablePagination } from "@/components/shared/DataTablePagination"
import type { DisplayContext } from "@/components/shared/DataTablePagination/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { InventoryItem } from "../hooks/use-inventory-data"

interface InventoryTableProps {
  data: InventoryItem[]
  isLoading: boolean
}

const INVENTORY_ENTITY = { singular: "bản ghi" } as const

const inventoryDisplayFormat = (ctx: DisplayContext) => {
  const entityLabel = ctx.entity.plural ?? ctx.entity.singular
  return `Hiển thị ${ctx.startItem} đến ${ctx.endItem} trong tổng số ${ctx.totalCount} ${entityLabel}`
}

export function InventoryTable({ data, isLoading }: InventoryTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")

  const columns: ColumnDef<InventoryItem>[] = [
    {
      accessorKey: "ngay_nhap",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Ngày
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = parseISO(row.getValue("ngay_nhap"))
        return format(date, "dd/MM/yyyy", { locale: vi })
      },
    },
    {
      accessorKey: "ma_thiet_bi",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Mã thiết bị
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("ma_thiet_bi")}</div>
      ),
    },
    {
      accessorKey: "ten_thiet_bi",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Tên thiết bị
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="max-w-xs truncate" title={row.getValue("ten_thiet_bi")}>
          {row.getValue("ten_thiet_bi")}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Loại giao dịch",
      cell: ({ row }) => {
        const type = row.getValue("type") as string
        return (
          <Badge variant={type === "import" ? "default" : "destructive"}>
            {type === "import" ? "Nhập" : "Xuất"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "source",
      header: "Nguồn/Hình thức",
      cell: ({ row }) => {
        const source = row.getValue("source") as string
        const sourceLabels = {
          manual: "Thêm thủ công",
          excel: "Import Excel",
          transfer_internal: "Luân chuyển nội bộ",
          transfer_external: "Luân chuyển bên ngoài",
          liquidation: "Thanh lý"
        }
        return (
          <Badge variant="outline">
            {sourceLabels[source as keyof typeof sourceLabels] || source}
          </Badge>
        )
      },
    },
    {
      accessorKey: "khoa_phong_quan_ly",
      header: "Khoa/Phòng",
      cell: ({ row }) => {
        const dept = row.getValue("khoa_phong_quan_ly") as string
        return <div className="max-w-xs truncate">{dept || "Chưa phân loại"}</div>
      },
    },
    {
      accessorKey: "model",
      header: "Model",
      cell: ({ row }) => {
        const model = row.getValue("model") as string
        return <div className="max-w-xs truncate">{model || "-"}</div>
      },
    },
    {
      accessorKey: "serial",
      header: "Serial",
      cell: ({ row }) => {
        const serial = row.getValue("serial") as string
        return <div className="max-w-xs truncate">{serial || "-"}</div>
      },
    },
    {
      accessorKey: "reason",
      header: "Lý do/Đích đến",
      cell: ({ row }) => {
        const reason = row.getValue("reason") as string
        const destination = row.original.destination
        const displayText = reason || destination || "-"
        return (
          <div className="max-w-xs truncate" title={displayText}>
            {displayText}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const searchableColumns = ['ma_thiet_bi', 'ten_thiet_bi', 'khoa_phong_quan_ly', 'model', 'serial']
      return searchableColumns.some(col => {
        const value = row.getValue(col)
        return value && String(value).toLowerCase().includes(filterValue.toLowerCase())
      })
    },
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi tiết giao dịch xuất-nhập</CardTitle>
        <CardDescription>
          Danh sách chi tiết tất cả các giao dịch xuất và nhập thiết bị
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table filters */}
        <div className="flex items-center gap-4 py-4">
          <Input
            placeholder="Tìm kiếm thiết bị..."
            value={globalFilter ?? ""}
            onChange={(event) => setGlobalFilter(String(event.target.value))}
            className="max-w-sm"
          />
          <Select
            value={(table.getColumn("type")?.getFilterValue() as string) ?? "all"}
            onValueChange={(value) =>
              table.getColumn("type")?.setFilterValue(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Loại giao dịch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="import">Nhập</SelectItem>
              <SelectItem value="export">Xuất</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    Không có dữ liệu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="py-4">
          <DataTablePagination
            table={table}
            totalCount={table.getFilteredRowModel().rows.length}
            entity={INVENTORY_ENTITY}
            displayFormat={inventoryDisplayFormat}
            pageSizeOptions={[]}
          />
        </div>
      </CardContent>
    </Card>
  )
} 
