"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UnusedEquipmentReportItem } from "../hooks/use-unused-equipment-report"
import { formatReportCurrency, formatReportNumber } from "./unused-equipment-report-format"

const UNUSED_EQUIPMENT_TABLE_SKELETON_ROWS = [
  "unused-equipment-loading-1",
  "unused-equipment-loading-2",
  "unused-equipment-loading-3",
  "unused-equipment-loading-4",
  "unused-equipment-loading-5",
] as const

interface UnusedEquipmentTableProps {
  items: UnusedEquipmentReportItem[]
  totalCount: number
  page: number
  pageSize: number
  isLoading: boolean
  onPageChange: (page: number) => void
}

export function UnusedEquipmentTable({
  items,
  totalCount,
  page,
  pageSize,
  isLoading,
  onPageChange,
}: UnusedEquipmentTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const canPrevious = page > 1
  const canNext = page < totalPages

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách thiết bị chưa có nhu cầu sử dụng</CardTitle>
        <CardDescription>Danh sách chi tiết theo phạm vi đơn vị đang xem</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã thiết bị</TableHead>
                <TableHead>Tên thiết bị</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Serial</TableHead>
                <TableHead>Khoa/phòng quản lý</TableHead>
                <TableHead>Ngày nhập</TableHead>
                <TableHead className="text-right">Nguyên giá</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                UNUSED_EQUIPMENT_TABLE_SKELETON_ROWS.map((rowKey) => (
                  <TableRow key={rowKey}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.maThietBi || "-"}</TableCell>
                    <TableCell>{item.tenThietBi || "Không xác định"}</TableCell>
                    <TableCell>{item.model || "-"}</TableCell>
                    <TableCell>{item.serial || "-"}</TableCell>
                    <TableCell>{item.khoaPhongQuanLy || "Không xác định"}</TableCell>
                    <TableCell>{item.ngayNhap || "-"}</TableCell>
                    <TableCell className="text-right">{formatReportCurrency(item.giaGoc)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    Không có dữ liệu.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Trang {formatReportNumber(totalCount === 0 ? 0 : page)} /{" "}
            {formatReportNumber(totalCount === 0 ? 0 : totalPages)} -{" "}
            {formatReportNumber(totalCount)} thiết bị
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrevious || isLoading}
              onClick={() => onPageChange(page - 1)}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext || isLoading}
              onClick={() => onPageChange(page + 1)}
            >
              Sau
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
