"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle, Clock, Wrench } from "lucide-react"
import type { MaintenanceReportData } from "../hooks/use-maintenance-data.types"

interface MaintenanceReportSummaryCardsProps {
  summary: MaintenanceReportData["summary"]
  isLoading: boolean
  numberFormatter: Intl.NumberFormat
}

export function MaintenanceReportSummaryCards({
  summary,
  isLoading,
  numberFormatter,
}: MaintenanceReportSummaryCardsProps) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yêu cầu sửa chữa</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.totalRepairs}</div>}
            <p className="text-xs text-muted-foreground">Tổng số yêu cầu trong kỳ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành (Sửa chữa)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.repairCompletionRate.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground">So với tổng số yêu cầu</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Công việc bảo trì (Kế hoạch)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.totalMaintenancePlanned}</div>}
            <p className="text-xs text-muted-foreground">Tổng công việc trong kỳ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành (Bảo trì)</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{summary.maintenanceCompletionRate.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground">So với kế hoạch</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chi phí sửa chữa</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{numberFormatter.format(summary.totalRepairCost)} đ</div>
            )}
            <p className="text-xs text-muted-foreground">Tổng chi phí sửa chữa trong kỳ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chi phí TB ca hoàn thành</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{numberFormatter.format(summary.averageCompletedRepairCost)} đ</div>
            )}
            <p className="text-xs text-muted-foreground">Trung bình trên các ca có ghi nhận chi phí</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Có ghi nhận chi phí</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{numberFormatter.format(summary.costRecordedCount)}</div>
            )}
            <p className="text-xs text-muted-foreground">{numberFormatter.format(summary.costRecordedCount)} ca hoàn thành đã ghi nhận</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Thiếu chi phí</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{numberFormatter.format(summary.costMissingCount)}</div>
            )}
            <p className="text-xs text-muted-foreground">{numberFormatter.format(summary.costMissingCount)} ca hoàn thành chưa ghi nhận</p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
