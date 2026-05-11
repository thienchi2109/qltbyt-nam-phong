"use client"

import * as React from "react"

import { DynamicBarChart } from "@/components/dynamic-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ChartData } from "@/lib/chart-utils"
import type {
  UnusedEquipmentReportDepartment,
  UnusedEquipmentReportGroup,
} from "../hooks/use-unused-equipment-report"

interface UnusedEquipmentChartsProps {
  deviceGroups: UnusedEquipmentReportGroup[]
  departments: UnusedEquipmentReportDepartment[]
  isLoading: boolean
}

function toDeviceChartData(groups: UnusedEquipmentReportGroup[]): ChartData[] {
  return groups.map((group) => ({
    name: group.deviceName,
    count: group.equipmentCount,
  }))
}

function toDepartmentChartData(groups: UnusedEquipmentReportDepartment[]): ChartData[] {
  return groups.map((group) => ({
    name: group.departmentName,
    count: group.equipmentCount,
  }))
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
            <DynamicBarChart
              data={deviceData}
              height={Math.max(260, deviceData.length * 36)}
              layout="vertical"
              xAxisKey="count"
              yAxisKey="name"
              bars={[{ key: "count", color: "#2563eb", name: "Số thiết bị" }]}
              showLegend={false}
              margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
            />
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
            <DynamicBarChart
              data={departmentData}
              height={Math.max(260, departmentData.length * 36)}
              layout="vertical"
              xAxisKey="count"
              yAxisKey="name"
              bars={[{ key: "count", color: "#16a34a", name: "Số thiết bị" }]}
              showLegend={false}
              margin={{ top: 8, right: 24, bottom: 8, left: 24 }}
            />
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
