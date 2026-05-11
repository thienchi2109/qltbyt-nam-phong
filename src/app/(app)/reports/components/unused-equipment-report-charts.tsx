"use client"

import * as React from "react"

import { DynamicPieChart } from "@/components/dynamic-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChartData, ChartTooltipProps } from "@/lib/chart-utils"
import type {
  UnusedEquipmentReportDepartment,
  UnusedEquipmentReportGroup,
} from "../hooks/use-unused-equipment-report"

interface UnusedEquipmentChartsProps {
  deviceGroups: UnusedEquipmentReportGroup[]
  departments: UnusedEquipmentReportDepartment[]
  isLoading: boolean
}

const UNUSED_EQUIPMENT_DONUT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#64748b",
]

interface UnusedEquipmentDonutDatum extends ChartData {
  key: string
  name: string
  value: number
  color: string
}

function toDeviceChartData(groups: UnusedEquipmentReportGroup[]): UnusedEquipmentDonutDatum[] {
  return groups.map((group, index) => ({
    key: `device-${group.deviceName}`,
    name: group.deviceName,
    value: group.equipmentCount,
    color: UNUSED_EQUIPMENT_DONUT_COLORS[index % UNUSED_EQUIPMENT_DONUT_COLORS.length],
  }))
}

function toDepartmentChartData(groups: UnusedEquipmentReportDepartment[]): UnusedEquipmentDonutDatum[] {
  return groups.map((group, index) => ({
    key: `department-${group.departmentName}`,
    name: group.departmentName,
    value: group.equipmentCount,
    color: UNUSED_EQUIPMENT_DONUT_COLORS[index % UNUSED_EQUIPMENT_DONUT_COLORS.length],
  }))
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%"
  return `${((value / total) * 100).toFixed(1).replace(/\.0$/, "")}%`
}

function getTooltipPayloadName(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("name" in payload)) {
    return ""
  }

  const { name } = payload as { name?: unknown }
  return typeof name === "string" ? name : ""
}

function UnusedEquipmentTooltip({
  active,
  payload,
}: ChartTooltipProps<number, string>) {
  if (!active || !payload?.length) return null

  const item = payload[0]
  const name = getTooltipPayloadName(item.payload) || String(item.name ?? "")
  const value = typeof item.value === "number" ? item.value : Number(item.value ?? 0)

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{name}</div>
      <div className="text-muted-foreground">{value} thiết bị</div>
    </div>
  )
}

function UnusedEquipmentDonutLegend({
  data,
  testId,
}: {
  data: UnusedEquipmentDonutDatum[]
  testId: string
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div data-testid={testId} className="grid gap-2">
      {data.map((item) => (
        <div
          key={item.key}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-background/60 px-3 py-2"
        >
          <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.name}</div>
            <div className="text-xs text-muted-foreground">{formatPercent(item.value, total)}</div>
          </div>
          <div className="text-right text-sm font-semibold">{item.value} thiết bị</div>
        </div>
      ))}
    </div>
  )
}

export function UnusedEquipmentCharts({
  deviceGroups,
  departments,
  isLoading,
}: UnusedEquipmentChartsProps) {
  const deviceData = React.useMemo(() => toDeviceChartData(deviceGroups), [deviceGroups])
  const departmentData = React.useMemo(() => toDepartmentChartData(departments), [departments])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Cơ cấu theo loại thiết bị</CardTitle>
          <CardDescription>Nhóm thiết bị chưa có nhu cầu sử dụng theo số lượng</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : deviceData.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(260px,1fr)]">
              <DynamicPieChart
                data={deviceData}
                height={260}
                dataKey="value"
                nameKey="name"
                colors={UNUSED_EQUIPMENT_DONUT_COLORS}
                innerRadius={64}
                outerRadius={100}
                showLabels={false}
                customTooltip={UnusedEquipmentTooltip}
              />
              <UnusedEquipmentDonutLegend
                data={deviceData}
                testId="unused-equipment-device-legend"
              />
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              Không có dữ liệu.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phân bố theo khoa/phòng</CardTitle>
          <CardDescription>Khoa/phòng đang quản lý thiết bị</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : departmentData.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(220px,0.85fr)_minmax(260px,1fr)]">
              <DynamicPieChart
                data={departmentData}
                height={260}
                dataKey="value"
                nameKey="name"
                colors={UNUSED_EQUIPMENT_DONUT_COLORS}
                innerRadius={64}
                outerRadius={100}
                showLabels={false}
                customTooltip={UnusedEquipmentTooltip}
              />
              <UnusedEquipmentDonutLegend
                data={departmentData}
                testId="unused-equipment-department-legend"
              />
            </div>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
              Không có dữ liệu.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
