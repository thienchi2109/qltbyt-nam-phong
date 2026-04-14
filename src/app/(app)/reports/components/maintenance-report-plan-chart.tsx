"use client"

import * as React from "react"
import { Inbox } from "lucide-react"

import { DynamicBarChart } from "@/components/dynamic-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { MaintenancePlanChartPoint } from "./maintenance-report-utils"

interface MaintenanceReportPlanChartProps {
  isLoading: boolean
  maintenancePlanData: MaintenancePlanChartPoint[]
}

export function MaintenanceReportPlanChart({
  isLoading,
  maintenancePlanData,
}: MaintenanceReportPlanChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kế hoạch vs. Thực tế</CardTitle>
        <CardDescription>So sánh công việc bảo trì theo kế hoạch và thực tế hoàn thành.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <Skeleton className="h-[360px] w-full" />
        ) : maintenancePlanData.length === 0 ? (
          <div className="text-sm text-muted-foreground h-[360px] flex flex-col items-center justify-center gap-2">
            <Inbox className="h-8 w-8 text-muted-foreground/60" />
            <span>Không có dữ liệu kế hoạch bảo trì.</span>
          </div>
        ) : (
          <DynamicBarChart
            data={maintenancePlanData}
            height={360}
            xAxisKey="name"
            bars={[
              { key: "planned", color: "var(--color-planned)", name: "Kế hoạch" },
              { key: "actual", color: "var(--color-actual)", name: "Thực tế" },
            ]}
            margin={{ top: 20, right: 24, left: 16, bottom: 40 }}
          />
        )}
      </CardContent>
    </Card>
  )
}
