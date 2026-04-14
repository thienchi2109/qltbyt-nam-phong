"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RecentRepairHistoryRow, TopEquipmentRepairRow } from "./maintenance-report-utils"

interface MaintenanceReportRepairTablesProps {
  isLoading: boolean
  topEquipmentRows: TopEquipmentRepairRow[]
  recentRepairHistory: RecentRepairHistoryRow[]
  numberFormatter: Intl.NumberFormat
  formatDateDisplay: (value?: string | null) => string
}

export function MaintenanceReportRepairTables({
  isLoading,
  topEquipmentRows,
  recentRepairHistory,
  numberFormatter,
  formatDateDisplay,
}: MaintenanceReportRepairTablesProps) {
  return (
    <>
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
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary group-hover:bg-primary/20">
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

      <Card className="border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Lịch sử sửa chữa gần đây</CardTitle>
          <CardDescription>Các yêu cầu sửa chữa mới nhất nằm trong khoảng thời gian đã chọn.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : recentRepairHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">Không có lịch sử sửa chữa trong khoảng thời gian đã chọn.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thiết bị</TableHead>
                    <TableHead>Sự cố</TableHead>
                    <TableHead>Ngày yêu cầu</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày hoàn thành</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRepairHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.equipmentName}</TableCell>
                      <TableCell className="max-w-[320px] truncate" title={item.issue}>{item.issue}</TableCell>
                      <TableCell>{formatDateDisplay(item.requestedDate)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Hoàn thành" ? "default" : "secondary"}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDateDisplay(item.completedDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
