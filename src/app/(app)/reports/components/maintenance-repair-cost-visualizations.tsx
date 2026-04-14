"use client"

import * as React from "react"
import { Inbox } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DynamicBarChart, DynamicScatterChart } from "@/components/dynamic-chart"
import type {
  RepairUsageCostCorrelation,
  TopEquipmentRepairCostEntry,
} from "../hooks/use-maintenance-data.types"

const MIN_CORRELATION_POINTS = 3

interface MaintenanceRepairCostVisualizationsProps {
  topEquipmentRepairCosts: TopEquipmentRepairCostEntry[]
  repairUsageCostCorrelation: RepairUsageCostCorrelation
}

type CorrelationScopeKey = keyof RepairUsageCostCorrelation

export function MaintenanceRepairCostVisualizations({
  topEquipmentRepairCosts,
  repairUsageCostCorrelation,
}: MaintenanceRepairCostVisualizationsProps) {
  const [scope, setScope] = React.useState<CorrelationScopeKey>("period")

  const activeCorrelationScope = repairUsageCostCorrelation[scope]
  const hasRepairCostData = topEquipmentRepairCosts.length > 0
  const hasCorrelationData =
    activeCorrelationScope.dataQuality.equipmentWithBoth >= MIN_CORRELATION_POINTS

  const topRepairCostChartData = React.useMemo(
    () =>
      topEquipmentRepairCosts.slice(0, 10).map((item) => ({
        equipmentName: item.equipmentName,
        equipmentCode: item.equipmentCode,
        equipmentLabel: `${item.equipmentName} (${item.equipmentCode})`,
        totalRepairCost: item.totalRepairCost,
        completedRepairRequests: item.completedRepairRequests,
        costRecordedCount: item.costRecordedCount,
      })),
    [topEquipmentRepairCosts]
  )

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Top 10 thiết bị có chi phí sửa chữa cao nhất</CardTitle>
          <CardDescription>Thiết bị được xếp theo tổng chi phí sửa chữa hoàn thành trong khoảng thời gian đã chọn.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasRepairCostData ? (
            <div className="flex h-[360px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <span>Không có dữ liệu chi phí sửa chữa trong khoảng thời gian đã chọn.</span>
            </div>
          ) : (
            <DynamicBarChart
              data={topRepairCostChartData}
              height={360}
              xAxisKey="equipmentLabel"
              yAxisKey="equipmentLabel"
              layout="vertical"
              bars={[
                { key: "totalRepairCost", color: "hsl(var(--chart-1))", name: "Chi phí sửa chữa" },
              ]}
              margin={{ top: 16, right: 24, left: 16, bottom: 12 }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <div className="space-y-1">
            <CardTitle>Giờ sử dụng và chi phí sửa chữa</CardTitle>
            <CardDescription>
              {scope === "period"
                ? "Tương quan giữa giờ sử dụng hoàn thành và chi phí sửa chữa trong kỳ."
                : "Tương quan lũy kế đến ngày kết thúc đã chọn."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={scope === "period" ? "default" : "outline"}
              onClick={() => setScope("period")}
            >
              Theo kỳ
            </Button>
            <Button
              variant={scope === "cumulative" ? "default" : "outline"}
              onClick={() => setScope("cumulative")}
            >
              Lũy kế
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!hasCorrelationData ? (
            <div className="flex h-[360px] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <span>Chưa đủ dữ liệu để hiển thị tương quan.</span>
              <span>Thiết bị có giờ sử dụng: {activeCorrelationScope.dataQuality.equipmentWithUsage}</span>
              <span>Thiết bị có chi phí sửa chữa: {activeCorrelationScope.dataQuality.equipmentWithRepairCost}</span>
              <span>Thiết bị có đủ cả hai: {activeCorrelationScope.dataQuality.equipmentWithBoth}</span>
            </div>
          ) : (
            <DynamicScatterChart
              data={activeCorrelationScope.points}
              height={360}
              xAxisKey="totalUsageHours"
              yAxisKey="totalRepairCost"
              zAxisKey="completedRepairRequests"
              scatterName="Thiết bị"
              fill="hsl(var(--chart-2))"
              margin={{ top: 16, right: 24, left: 16, bottom: 12 }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
