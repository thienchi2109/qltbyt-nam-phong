"use client"

import * as React from "react"
import { Inbox } from "lucide-react"

import type { ChartTooltipProps } from "@/lib/chart-utils"
import { DynamicBarChart, DynamicLineChart } from "@/components/dynamic-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  RepairCompletionTimeByMonthPoint,
  RepairCompletionTimeChart,
} from "../hooks/use-maintenance-data.types"
import {
  buildCompletionTimeChartData,
  buildCompletionTimeTrendData,
  formatDurationAuto,
} from "./maintenance-report-utils"

const PERCENT_FORMATTER = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 })

interface MaintenanceReportCompletionTimeProps {
  isLoading: boolean
  repairCompletionTime: RepairCompletionTimeChart
  repairCompletionTimeByMonth: RepairCompletionTimeByMonthPoint[]
}

export function MaintenanceReportCompletionTime({
  isLoading,
  repairCompletionTime,
  repairCompletionTimeByMonth,
}: MaintenanceReportCompletionTimeProps) {
  const histogramData = React.useMemo(
    () => buildCompletionTimeChartData(repairCompletionTime.distribution),
    [repairCompletionTime.distribution]
  )
  const trendData = React.useMemo(
    () => buildCompletionTimeTrendData(repairCompletionTimeByMonth),
    [repairCompletionTimeByMonth]
  )

  const { stats } = repairCompletionTime
  const hasCompletionData = stats.totalCompleted > 0

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[460px] w-full" />
        <Skeleton className="h-[460px] w-full" />
      </div>
    )
  }

  if (!hasCompletionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Thời gian hoàn thành yêu cầu sửa chữa</CardTitle>
          <CardDescription>Thống kê các yêu cầu đã hoàn thành trong khoảng thời gian đã chọn.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[360px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Inbox className="size-8 text-muted-foreground/60" />
            <span>Chưa có yêu cầu hoàn thành trong khoảng thời gian đã chọn.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Thời gian hoàn thành yêu cầu sửa chữa</CardTitle>
          <CardDescription>Phân bố thời gian từ lúc yêu cầu đến khi hoàn thành.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <CompletionStat label="Trung vị" value={formatDurationAuto(stats.medianMinutes)} />
            <CompletionStat label="Thời gian trung bình" value={formatDurationAuto(stats.averageMinutes)} />
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">
                Tỉ lệ đúng hạn (≤{stats.thresholdDays} ngày)
              </div>
              <div className="mt-1 text-xl font-semibold">
                {PERCENT_FORMATTER.format(stats.onTimePercent)}%
              </div>
              <Progress className="mt-3 h-2" value={stats.onTimePercent} />
              <div className="mt-2 text-xs text-muted-foreground">
                {stats.onTimeCount}/{stats.totalCompleted} yêu cầu trong ngưỡng {stats.thresholdDays} ngày
              </div>
            </div>
          </div>

          <DynamicBarChart
            data={histogramData}
            height={300}
            xAxisKey="label"
            bars={[{
              key: "count",
              color: "hsl(var(--chart-1))",
              name: "Số yêu cầu",
              cellColorKey: "fill",
            }]}
            customTooltip={CompletionHistogramTooltip}
            margin={{ top: 16, right: 24, left: 16, bottom: 36 }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Xu hướng thời gian hoàn thành theo tháng</CardTitle>
          <CardDescription>Trung vị, mốc 90% và trung bình theo tháng hoàn thành.</CardDescription>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="flex h-[360px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Inbox className="size-8 text-muted-foreground/60" />
              <span>Chưa có dữ liệu theo tháng trong khoảng thời gian đã chọn.</span>
            </div>
          ) : (
            <DynamicLineChart
              data={trendData}
              height={360}
              xAxisKey="period"
              lines={[
                { key: "medianMinutes", color: "hsl(var(--chart-1))", name: "Trung vị" },
                { key: "p90Minutes", color: "hsl(var(--chart-5))", name: "90% hoàn thành trong" },
                { key: "averageMinutes", color: "hsl(var(--chart-2))", name: "Trung bình" },
              ]}
              customTooltip={CompletionTrendTooltip}
              margin={{ top: 16, right: 24, left: 16, bottom: 12 }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CompletionTrendTooltip({
  active,
  label,
  payload,
}: ChartTooltipProps<number, string>) {
  const entries = payload ?? []
  const periodLabel = typeof label === "string" || typeof label === "number" ? String(label) : null

  if (!active || entries.length === 0) {
    return null
  }

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      {periodLabel ? <p className="font-medium text-foreground">{periodLabel}</p> : null}
      <div className="mt-1 space-y-1">
        {entries.map((entry) => {
          const value = typeof entry.value === "number" ? entry.value : null
          const name = typeof entry.name === "string" || typeof entry.name === "number"
            ? String(entry.name)
            : "Giá trị"

          if (value == null) {
            return null
          }

          return (
            <p key={name} className="text-muted-foreground">
              {name}: {formatDurationAuto(value)}
            </p>
          )
        })}
      </div>
    </div>
  )
}

function CompletionHistogramTooltip({
  active,
  payload,
}: ChartTooltipProps<number, string>) {
  const entry = payload?.[0]
  const bucketLabel = typeof entry?.payload?.label === "string" ? entry.payload.label : null
  const count = typeof entry?.value === "number" ? entry.value : null

  if (!active || !bucketLabel || count == null) {
    return null
  }

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{bucketLabel}</p>
      <p className="text-muted-foreground">Số yêu cầu: {count}</p>
    </div>
  )
}

function CompletionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  )
}
