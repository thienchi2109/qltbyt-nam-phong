"use client"

import * as React from "react"
import { BarChart3, MapPin, Building2, X } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  useEquipmentDistribution
} from "@/hooks/use-equipment-distribution"
import { EquipmentChartFilters } from "@/components/interactive-equipment-chart-controls"
import { EquipmentChartDistributionTab } from "@/components/interactive-equipment-chart-distribution-tab"
import { cn } from "@/lib/utils"

interface InteractiveEquipmentChartProps {
  className?: string
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
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
                <EquipmentChartFilters
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
                <EquipmentChartFilters
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

          <EquipmentChartDistributionTab
            value="department"
            chartData={chartData}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
          />

          <EquipmentChartDistributionTab
            value="location"
            chartData={chartData}
            isLoading={isLoading}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={resetFilters}
          />
        </Tabs>
      </CardContent>
    </Card>
  )
} 
