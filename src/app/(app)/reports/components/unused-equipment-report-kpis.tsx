"use client"

import * as React from "react"
import { BarChart3, Building2, Layers3, PackageSearch } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatReportCurrency, formatReportNumber } from "./unused-equipment-report-format"

interface UnusedEquipmentKpiCardsProps {
  totalCount: number
  deviceTypeCount: number
  departmentCount: number
  totalOriginalValue: number
  isLoading: boolean
}

export function UnusedEquipmentKpiCards({
  totalCount,
  deviceTypeCount,
  departmentCount,
  totalOriginalValue,
  isLoading,
}: UnusedEquipmentKpiCardsProps) {
  const cards = [
    {
      title: "Số thiết bị",
      value: formatReportNumber(totalCount),
      description: "Thiết bị chưa có nhu cầu sử dụng",
      icon: PackageSearch,
    },
    {
      title: "Số loại thiết bị",
      value: formatReportNumber(deviceTypeCount),
      description: "Theo tên thiết bị",
      icon: Layers3,
    },
    {
      title: "Số khoa/phòng quản lý",
      value: formatReportNumber(departmentCount),
      description: "Đang quản lý thiết bị",
      icon: Building2,
    },
    {
      title: "Tổng nguyên giá",
      value: formatReportCurrency(totalOriginalValue),
      description: "Theo dữ liệu ghi nhận",
      icon: BarChart3,
    },
  ] as const

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon

        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 [&>*+*]:mt-0">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-20" /> : card.value}
              </div>
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
