"use client"

import * as React from "react"
import { CalendarIcon, Download, FileText, TrendingUp, TrendingDown, Package } from "lucide-react"
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns"
import { vi } from "date-fns/locale"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { InventoryCharts } from "./inventory-charts"
import { InventoryTable } from "./inventory-table"
import { ExportReportDialog } from "./export-report-dialog"
import { useInventoryData } from "../hooks/use-inventory-data"
import { InteractiveEquipmentChart } from "@/components/interactive-equipment-chart"
import { EquipmentDistributionSummary } from "@/components/equipment-distribution-summary"
import { useReportInventoryFilters } from "../hooks/use-report-filters"

interface DateRange {
  from: Date
  to: Date
}

interface InventoryReportTabProps {
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
}

export function InventoryReportTab({ 
  tenantFilter, 
  selectedDonVi, 
  effectiveTenantKey 
}: InventoryReportTabProps) {
  const { toast } = useToast()
  
  // Persisted filters per tenant via TanStack Query cache
  const tenantCacheKey = effectiveTenantKey || 'auto'
  const { filters, setDateRange, setSelectedDepartment, setSearchTerm } = useReportInventoryFilters(tenantCacheKey)
  const dateRange = filters.dateRange
  const selectedDepartment = filters.selectedDepartment
  const searchTerm = filters.searchTerm
  const [showExportDialog, setShowExportDialog] = React.useState(false)

  // (debug removed)
  
  // Fetch data using React Query hook with tenant parameters
  const { 
    data: inventoryResult, 
    isLoading, 
    error,
    refetch 
  } = useInventoryData(
    dateRange, 
    selectedDepartment, 
    searchTerm,
    tenantFilter,
    selectedDonVi,
    effectiveTenantKey
  )

  // Extract data from query result
  const data = inventoryResult?.data || []
  const summary = inventoryResult?.summary || {
    totalImported: 0,
    totalExported: 0,
    currentStock: 0,
    netChange: 0
  }
  const departments = inventoryResult?.departments || []

  const handleRefresh = () => {
    refetch()
    toast({
      title: "Đã làm mới dữ liệu",
      description: "Báo cáo đã được cập nhật với dữ liệu mới nhất."
    })
  }

  // Show error if any
  React.useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "Lỗi tải dữ liệu",
        description: error instanceof Error ? error.message : "Không thể tải dữ liệu báo cáo"
      })
    }
  }, [error, toast])

  return (
    <>
      <div className="space-y-4">
        {/* Filters Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Báo cáo Xuất-Nhập-Tồn thiết bị
            </CardTitle>
            <CardDescription>
              Theo dõi tình hình xuất, nhập và tồn kho thiết bị theo thời gian
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Date Range Picker */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Khoảng thời gian</label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          format(dateRange.from, "dd/MM/yyyy")
                        ) : (
                          "Từ ngày"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                        disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                        initialFocus
                        locale={vi}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[140px] justify-start text-left font-normal",
                          !dateRange.to && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.to ? (
                          format(dateRange.to, "dd/MM/yyyy")
                        ) : (
                          "Đến ngày"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                        disabled={(date) => date > new Date() || date < dateRange.from}
                        initialFocus
                        locale={vi}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Department Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Khoa/Phòng</label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Chọn khoa/phòng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    {departments.map((dept: string) => (
                      <SelectItem key={dept} value={dept}>
                        {dept || "Chưa phân loại"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Tìm kiếm</label>
                <Input
                  placeholder="Tên hoặc mã thiết bị..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[200px]"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 sm:ml-auto">
                <label className="text-sm font-medium invisible">Actions</label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                    Làm mới
                  </Button>
                  <Button onClick={() => setShowExportDialog(true)}>
                    <Download className="mr-2 h-4 w-4" />
                    Xuất báo cáo
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng nhập</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-16" /> : summary.totalImported}
              </div>
              <p className="text-xs text-muted-foreground">
                Thiết bị nhập trong kỳ
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng xuất</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-16" /> : summary.totalExported}
              </div>
              <p className="text-xs text-muted-foreground">
                Thiết bị xuất trong kỳ
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tồn kho</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-16" /> : summary.currentStock}
              </div>
              <p className="text-xs text-muted-foreground">
                Thiết bị hiện có
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Biến động</CardTitle>
              <Badge variant={summary.netChange >= 0 ? "default" : "destructive"}>
                {summary.netChange >= 0 ? "+" : ""}{summary.netChange}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? <Skeleton className="h-8 w-16" /> : Math.abs(summary.netChange)}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.netChange >= 0 ? "Tăng" : "Giảm"} so với đầu kỳ
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Equipment Distribution Overview */}
        <EquipmentDistributionSummary tenantFilter={tenantFilter} selectedDonVi={selectedDonVi} effectiveTenantKey={effectiveTenantKey} />

        {/* Interactive Equipment Distribution Chart */}
        <InteractiveEquipmentChart tenantFilter={tenantFilter} selectedDonVi={selectedDonVi} effectiveTenantKey={effectiveTenantKey} />

        {/* Charts Section */}
        <InventoryCharts data={data} isLoading={isLoading} />

        {/* Detailed Table */}
        <InventoryTable data={data} isLoading={isLoading} />
      </div>

      {/* Export Dialog */}
      <ExportReportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        data={data}
        summary={summary}
        dateRange={dateRange}
        department={selectedDepartment}
      />
    </>
  )
} 