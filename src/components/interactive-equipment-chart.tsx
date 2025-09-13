"use client"

import * as React from "react"
import { Filter, BarChart3, MapPin, Building2, X } from "lucide-react"
import { DynamicBarChart } from "@/components/dynamic-chart"

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

interface InteractiveEquipmentChartProps {
  className?: string
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0)
    
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 min-w-[200px]">
        <p className="font-medium mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded"
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
}

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
      <Filter className="h-4 w-4 text-muted-foreground" />
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

export function InteractiveEquipmentChart({ className }: InteractiveEquipmentChartProps) {
  const [viewType, setViewType] = React.useState<'department' | 'location'>('department')
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>('all')
  const [selectedLocation, setSelectedLocation] = React.useState<string>('all')
  
  // Apply cross-filtering to the hook
  const crossFilterDept = viewType === 'location' ? selectedDepartment : undefined
  const crossFilterLoc = viewType === 'department' ? selectedLocation : undefined
  
  const { data, isLoading, error } = useEquipmentDistribution(crossFilterDept, crossFilterLoc)

  // Reset filters function
  const resetFilters = () => {
    setSelectedDepartment('all')
    setSelectedLocation('all')
  }

  // Check if any filters are active
  const hasActiveFilters = selectedDepartment !== 'all' || selectedLocation !== 'all'

  // Filtered data based on current selection with cross-filtering
  const filteredData = React.useMemo(() => {
    if (!data) return []
    
    let sourceData = viewType === 'department' ? data.byDepartment : data.byLocation
    
    return sourceData.slice(0, 10) // Show top 10 for better visualization
  }, [data, viewType])

  // Statistics
  const stats = React.useMemo(() => {
    if (!data) return null
    
    const currentData = filteredData
    const totalCategories = currentData.length
    const totalEquipment = currentData.reduce((sum, item) => sum + item.total, 0)
    const avgEquipmentPerCategory = currentData.length > 0 
      ? Math.round(totalEquipment / currentData.length) 
      : 0
    
    return {
      totalCategories,
      totalEquipment,
      avgEquipmentPerCategory
    }
  }, [filteredData])

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <BarChart3 className="h-5 w-5" />
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
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
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
            <div className="flex gap-4 text-sm">
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

      <CardContent>
        <Tabs value={viewType} onValueChange={(value) => setViewType(value as 'department' | 'location')} className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="department" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Theo Khoa/Phòng
              </TabsTrigger>
              <TabsTrigger value="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Theo Vị trí
              </TabsTrigger>
            </TabsList>

            {/* Cross Filters and Reset */}
            <div className="flex items-center gap-2">
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
                  <X className="h-3 w-3" />
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          </div>

          <TabsContent value="department" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : filteredData.length === 0 ? (
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
              <div className="space-y-4">
                {/* Chart */}
                <DynamicBarChart
                  data={filteredData}
                  height={400}
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

                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center pt-4 border-t">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: STATUS_COLORS[key as keyof typeof STATUS_COLORS] }}
                      />
                      <span className="text-sm">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="location" className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : filteredData.length === 0 ? (
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
              <div className="space-y-4">
                {/* Chart */}
                <DynamicBarChart
                  data={filteredData}
                  height={400}
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

                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center pt-4 border-t">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
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