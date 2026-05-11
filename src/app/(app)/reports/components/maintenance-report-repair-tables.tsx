"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { TopEquipmentRepairRow } from "./maintenance-report-utils"

interface MaintenanceReportRepairTablesProps {
  isLoading: boolean
  topEquipmentRows: TopEquipmentRepairRow[]
  numberFormatter: Intl.NumberFormat
  formatDateDisplay: (value?: string | null) => string
}

export function MaintenanceReportRepairTables({
  isLoading,
  topEquipmentRows,
  numberFormatter,
  formatDateDisplay,
}: MaintenanceReportRepairTablesProps) {
  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle>Thiết bị sửa chữa nhiều nhất</CardTitle>
        <CardDescription>Top thiết bị có số lượng yêu cầu sửa chữa cao trong khoảng thời gian đã chọn.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : topEquipmentRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Không có dữ liệu sửa chữa trong khoảng thời gian đã chọn.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px] text-center">#</TableHead>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>Số yêu cầu</TableHead>
                  <TableHead>Trạng thái gần nhất</TableHead>
                  <TableHead>Ngày sửa chữa gần nhất</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEquipmentRows.map((item) => (
                  <TableRow key={`${item.equipmentId}-${item.rank}`} className="group">
                    <TableCell className="text-center">
                        <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary group-hover:bg-primary/20">
                        {item.rank}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{numberFormatter.format(item.totalRequests)}</TableCell>
                    <TableCell>
                      <Badge variant={item.latestStatus === "Hoàn thành" ? "default" : "secondary"}>
                        {item.latestStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateDisplay(item.latestCompletedDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
