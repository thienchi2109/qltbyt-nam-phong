"use client"

import * as React from "react"
import { Inbox } from "lucide-react"

import { DynamicLineChart, DynamicPieChart } from "@/components/dynamic-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { MaintenanceReportData } from "../hooks/use-maintenance-data.types"
import type { RepairTrendChartPoint } from "./maintenance-report-utils"

interface MaintenanceReportRepairChartsProps {
  isLoading: boolean
  repairTrendData: RepairTrendChartPoint[]
  repairStatusData: MaintenanceReportData["charts"]["repairStatusDistribution"]
}

export function MaintenanceReportRepairCharts({
  isLoading,
  repairTrendData,
  repairStatusData,
}: MaintenanceReportRepairChartsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Xu hướng sửa chữa theo thời gian</CardTitle>
          <CardDescription>Số lượng yêu cầu sửa chữa và hoàn thành theo tháng.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : repairTrendData.length === 0 ? (
            <div className="text-sm text-muted-foreground h-[340px] flex flex-col items-center justify-center gap-2">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <span>Không có dữ liệu xu hướng sửa chữa.</span>
            </div>
          ) : (
            <DynamicLineChart
              data={repairTrendData}
              height={340}
              xAxisKey="period"
              lines={[
                { key: "totalRequests", color: "hsl(var(--chart-1))", name: "Tổng yêu cầu" },
                { key: "completedRequests", color: "hsl(var(--chart-4))", name: "Hoàn thành" },
              ]}
              margin={{ top: 16, right: 24, left: 16, bottom: 12 }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tình trạng yêu cầu sửa chữa</CardTitle>
          <CardDescription>Phân bổ các yêu cầu sửa chữa theo trạng thái.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[340px] w-full" />
          ) : repairStatusData.length === 0 ? (
            <div className="text-sm text-muted-foreground h-[340px] flex flex-col items-center justify-center gap-2">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <span>Không có dữ liệu trạng thái sửa chữa.</span>
            </div>
          ) : (
            <DynamicPieChart
              data={repairStatusData}
              height={340}
              dataKey="value"
              nameKey="name"
              colors={repairStatusData.map((entry) => entry.color)}
              innerRadius={90}
              outerRadius={130}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
