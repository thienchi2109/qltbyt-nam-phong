"use client"

import * as React from "react"
import { Filter, BarChart3, MapPin, Building2, X } from "lucide-react"
import { DynamicBarChart } from "@/components/dynamic-chart"
import type { ChartTooltipProps } from "@/lib/chart-utils"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  useEquipmentDistribution, 
  STATUS_COLORS,
  STATUS_LABELS
} from "@/hooks/use-equipment-distribution"
import { buildKeyedTooltipEntries } from "@/lib/runtime-list-keys"
import { cn } from "@/lib/utils"

interface InteractiveEquipmentChartProps {
  className?: string
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
}

const DEFAULT_DISTRIBUTION_CHART_HEIGHT = 400
const DENSE_DISTRIBUTION_CATEGORY_THRESHOLD = 20
const DENSE_DISTRIBUTION_CATEGORY_WIDTH = 56

type TooltipPayloadEntry = NonNullable<ChartTooltipProps<number, string>['payload']>[number]

function getTooltipCategoryName(entry: TooltipPayloadEntry): string | null {
  const row = entry.payload
  if (!row || typeof row !== "object" || !("name" in row)) return null

  const name = (row as Record<string, unknown>).name
  return typeof name === "string" && name.trim() ? name : null
}

// Custom tooltip component — memoized to avoid re-computing keyed entries on unchanged payload
const CustomTooltip = React.memo(function CustomTooltip({
  active,
  payload,
  label,
}: ChartTooltipProps<number, string>) {
  const tooltipEntries = payload ?? []

  if (active && tooltipEntries.length > 0) {
    const total = tooltipEntries.reduce(
      (sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0),
      0,
    )
    const keyedPayload = buildKeyedTooltipEntries<TooltipPayloadEntry>(tooltipEntries)
    const categoryName = tooltipEntries.map(getTooltipCategoryName).find(Boolean) ?? label
    
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[200px]">
        <p className="font-medium mb-2">{categoryName}</p>
        <div className="space-y-1">
          {keyedPayload.map(({ key, entry }) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="size-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span>{STATUS_LABELS[entry.dataKey as keyof typeof STATUS_LABELS]}</span>
              </div>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
          <div className="border-t pt-1 mt-2">
            <div className="flex items-center justify-between font-medium">
              <span>Tổng:</span>
              <span>{total}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }
  return null
})

// Filter component for departments and locations
function DataFilters({ 
  viewType, 
  selectedFilter, 
  onFilterChange, 
  departments, 
  locations, 
  isLoading 
}: {
  viewType: 'department' | 'location'
  selectedFilter: string
  onFilterChange: (value: string) => void
  departments: string[]
  locations: string[]
  isLoading: boolean
}) {
  const options = viewType === 'department' ? departments : locations
  const placeholder = viewType === 'department' ? 'Tất cả khoa/phòng' : 'Tất cả vị trí'
  
  return (
    <div className="flex items-center gap-2">
      <Filter className="size-4 text-muted-foreground" />
      <Select 
        value={selectedFilter} 
        onValueChange={onFilterChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function InteractiveEquipmentChart({ className, tenantFilter, selectedDonVi, effectiveTenantKey }: InteractiveEquipmentChartProps) {
  const [viewType, setViewType] = React.useState<'department' | 'location'>('department')
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>('all')
  const [selectedLocation, setSelectedLocation] = React.useState<string>('all')
  
  // Apply cross-filtering to the hook
  const crossFilterDept = viewType === 'location' ? selectedDepartment : undefined
  const crossFilterLoc = viewType === 'department' ? selectedLocation : undefined
  
  const { data, isLoading, error } = useEquipmentDistribution(
    crossFilterDept,
    crossFilterLoc,
    tenantFilter,
    selectedDonVi,
    effectiveTenantKey
  )

  // Reset filters function
  const resetFilters = () => {
    setSelectedDepartment('all')
    setSelectedLocation('all')
  }

  // Check if any filters are active
  const hasActiveFilters = selectedDepartment !== 'all' || selectedLocation !== 'all'

  // Filtered data based on current selection with cross-filtering
  const chartData = React.useMemo(() => {
    if (!data) return []

    return viewType === 'department' ? data.byDepartment : data.byLocation
  }, [data, viewType])

  const isDenseChart = chartData.length > DENSE_DISTRIBUTION_CATEGORY_THRESHOLD
  const chartContainerClassName = cn("min-w-0 max-w-full", isDenseChart && "overflow-x-auto pb-2")
  const chartMinWidth = isDenseChart ? `${chartData.length * DENSE_DISTRIBUTION_CATEGORY_WIDTH}px` : undefined

  // Statistics
  const stats = React.useMemo(() => {
    if (!data) return null

    const totalCategories = chartData.length
    const totalEquipment = (typeof data.totalEquipment === 'number' && !Number.isNaN(data.totalEquipment))
      ? data.totalEquipment
      : chartData.reduce((sum, item) => sum + item.total, 0)
    const avgEquipmentPerCategory = totalCategories > 0 
      ? Math.round(totalEquipment / totalCategories) 
      : 0
    
    return {
      totalCategories,
      totalEquipment,
      avgEquipmentPerCategory
    }
  }, [chartData])

  if (error) {
    return (
      <Card className={cn("min-w-0 overflow-hidden", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <BarChart3 className="size-5" />
            Lỗi tải dữ liệu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Không thể tải dữ liệu phân bố thiết bị. Vui lòng thử lại sau.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="equipment-chart-card" className={cn("min-w-0 overflow-hidden", className)}>
      <CardHeader>
        <div
          data-testid="equipment-chart-header"
          className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"
        >
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-5" />
              Phân bố Thiết bị theo {viewType === 'department' ? 'Khoa/Phòng' : 'Vị trí'}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <span>Biểu đồ tương tác thể hiện số lượng và trạng thái thiết bị</span>
              {selectedDepartment !== 'all' && viewType === 'location' && (
                <Badge variant="secondary" className="text-xs">
                  Khoa/Phòng: {selectedDepartment}
                </Badge>
              )}
              {selectedLocation !== 'all' && viewType === 'department' && (
                <Badge variant="secondary" className="text-xs">
                  Vị trí: {selectedLocation}
                </Badge>
              )}
            </CardDescription>
          </div>
          
          {stats && (
            <div className="flex w-full flex-wrap gap-4 text-sm xl:w-auto xl:justify-end">
              <div className="text-center">
                <div className="font-semibold text-blue-600">{stats.totalEquipment}</div>
                <div className="text-muted-foreground">Tổng TB</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-green-600">{stats.totalCategories}</div>
                <div className="text-muted-foreground">{viewType === 'department' ? 'Khoa/Phòng' : 'Vị trí'}</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-600">{stats.avgEquipmentPerCategory}</div>
                <div className="text-muted-foreground">TB/nhóm</div>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent data-testid="equipment-chart-content" className="min-w-0">
        <Tabs value={viewType} onValueChange={(value) => setViewType(value as 'department' | 'location')} className="min-w-0 space-y-4">
          <div
            data-testid="equipment-chart-toolbar"
            className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
          >
            <div data-testid="equipment-chart-tabs-scroll" className="w-full overflow-x-auto pb-1 xl:w-auto">
              <TabsList className="w-max min-w-max">
                <TabsTrigger value="department" className="flex items-center gap-2">
                  <Building2 className="size-4" />
                  Theo Khoa/Phòng
                </TabsTrigger>
                <TabsTrigger value="location" className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  Theo Vị trí
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Cross Filters and Reset */}
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-end">
              {/* When viewing by department, allow filtering by location */}
              {viewType === 'department' && data?.locations && (
                <DataFilters
                  viewType="location"
                  selectedFilter={selectedLocation}
                  onFilterChange={setSelectedLocation}
                  departments={data.departments}
                  locations={data.locations}
                  isLoading={isLoading}
                />
              )}
              
              {/* When viewing by location, allow filtering by department */}
              {viewType === 'location' && data?.departments && (
                <DataFilters
                  viewType="department"
                  selectedFilter={selectedDepartment}
                  onFilterChange={setSelectedDepartment}
                  departments={data.departments}
                  locations={data.locations}
                  isLoading={isLoading}
                />
              )}

              {/* Reset filters button */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="flex items-center gap-1"
                >
                  <X className="size-3" />
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="department" className="min-w-0 space-y-4">
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
                        <Button variant="link" className="p-0 h-auto" onClick={resetFilters}>
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
                {/* Chart */}
                <div data-testid="equipment-chart-scroll-frame" className={chartContainerClassName}>
                  <div data-testid="equipment-chart-scroll-inner" style={{ minWidth: chartMinWidth }}>
                    <DynamicBarChart
                      data={chartData}
                      height={DEFAULT_DISTRIBUTION_CHART_HEIGHT}
                      xAxisKey="name"
                      bars={Object.entries(STATUS_COLORS).map(([key, color]) => ({
                        key,
                        color,
                        name: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
                        stackId: "status"
                      }))}
                      showGrid={true}
                      showTooltip={true}
                      showLegend={false}
                      xAxisAngle={-45}
                      customTooltip={CustomTooltip}
                      margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                    />
                  </div>
                </div>

                {/* Legend */}
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

          <TabsContent value="location" className="min-w-0 space-y-4">
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
                        <Button variant="link" className="p-0 h-auto" onClick={resetFilters}>
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
                {/* Chart */}
                <div data-testid="equipment-chart-scroll-frame" className={chartContainerClassName}>
                  <div data-testid="equipment-chart-scroll-inner" style={{ minWidth: chartMinWidth }}>
                    <DynamicBarChart
                      data={chartData}
                      height={DEFAULT_DISTRIBUTION_CHART_HEIGHT}
                      xAxisKey="name"
                      bars={Object.entries(STATUS_COLORS).map(([key, color]) => ({
                        key,
                        color,
                        name: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
                        stackId: "status"
                      }))}
                      showGrid={true}
                      showTooltip={true}
                      showLegend={false}
                      xAxisAngle={-45}
                      customTooltip={CustomTooltip}
                      margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                    />
                  </div>
                </div>

                {/* Legend */}
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
        </Tabs>
      </CardContent>
    </Card>
  )
} 
