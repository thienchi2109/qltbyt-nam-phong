import * as React from "react"

import { DynamicBarChart } from "@/components/dynamic-chart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsContent } from "@/components/ui/tabs"
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type EquipmentDistributionItem,
} from "@/hooks/use-equipment-distribution"
import { cn } from "@/lib/utils"
import { EquipmentChartTooltip } from "@/components/interactive-equipment-chart-tooltip"

const DISTRIBUTION_CHART_HEIGHT = 400
const DENSE_CATEGORY_THRESHOLD = 20
const DENSE_CATEGORY_WIDTH = 56
const STATUS_BARS = Object.entries(STATUS_COLORS).map(([key, color]) => ({
  key,
  color,
  name: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
  stackId: "status",
}))

interface EquipmentChartDistributionTabProps {
  value: "department" | "location"
  chartData: EquipmentDistributionItem[]
  isLoading: boolean
  hasActiveFilters: boolean
  onResetFilters: () => void
}

export function EquipmentChartDistributionTab({
  value,
  chartData,
  isLoading,
  hasActiveFilters,
  onResetFilters,
}: EquipmentChartDistributionTabProps) {
  const isDenseChart = chartData.length > DENSE_CATEGORY_THRESHOLD
  const chartContainerClassName = cn(
    "min-w-0 max-w-full",
    isDenseChart && "w-0 min-w-full overflow-x-auto pb-2",
  )
  const chartWidth = isDenseChart ? `${chartData.length * DENSE_CATEGORY_WIDTH}px` : undefined

  return (
    <TabsContent value={value} className="min-w-0 space-y-4">
      {isLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : chartData.length === 0 ? (
        <div className="h-[400px] flex items-center justify-center">
          <Alert>
            <AlertDescription>
              Không có dữ liệu để hiển thị với bộ lọc hiện tại.
              {hasActiveFilters && (
                <>
                  {" "}
                  <Button variant="link" className="p-0 h-auto" onClick={onResetFilters}>
                    Xóa bộ lọc
                  </Button>
                  {" "}để xem tất cả dữ liệu.
                </>
              )}
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="min-w-0 space-y-4">
          <div data-testid="equipment-chart-scroll-frame" className={chartContainerClassName}>
            <div data-testid="equipment-chart-scroll-inner" style={{ width: chartWidth }}>
              <DynamicBarChart
                data={chartData}
                height={DISTRIBUTION_CHART_HEIGHT}
                xAxisKey="name"
                bars={STATUS_BARS}
                showGrid={true}
                showTooltip={true}
                showLegend={false}
                xAxisAngle={-45}
                customTooltip={EquipmentChartTooltip}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 justify-center pt-4 border-t">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="size-3 rounded"
                  style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
                />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </TabsContent>
  )
}
