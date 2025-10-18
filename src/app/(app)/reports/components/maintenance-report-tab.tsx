"use client"

import * as React from "react"
import { format, parseISO, startOfYear, endOfYear } from "date-fns"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, Wrench, CheckCircle, Clock, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { vi } from "date-fns/locale"

import { useMaintenanceReportData } from "../hooks/use-maintenance-data"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DynamicBarChart, DynamicLineChart, DynamicPieChart } from "@/components/dynamic-chart"

const parseNumericValue = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

interface DateRange {
  from: Date
  to: Date
}

interface MaintenanceReportTabProps {
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
}

export function MaintenanceReportTab({ 
  tenantFilter, 
  selectedDonVi, 
  effectiveTenantKey 
}: MaintenanceReportTabProps) {
  const [dateRange, setDateRange] = React.useState<DateRange>({
    from: startOfYear(new Date()),
    to: endOfYear(new Date()),
  })

  // ✅ Pass tenant parameters for proper scoping
  const { data: reportData, isLoading } = useMaintenanceReportData(
    dateRange,
    selectedDonVi,
    effectiveTenantKey
  )

  const summary = reportData?.summary
  const charts = reportData?.charts
  const repairFrequency = charts?.repairFrequencyByMonth ?? []
  const repairStatusData = charts?.repairStatusDistribution ?? []
  const topEquipmentRepairs = reportData?.topEquipmentRepairs ?? []
  const recentRepairHistory = reportData?.recentRepairHistory ?? []

  const normalizedSummary = React.useMemo(() => ({
    totalRepairs: parseNumericValue(summary?.totalRepairs),
    repairCompletionRate: parseNumericValue(summary?.repairCompletionRate),
    totalMaintenancePlanned: parseNumericValue(summary?.totalMaintenancePlanned),
    maintenanceCompletionRate: parseNumericValue(summary?.maintenanceCompletionRate),
  }), [summary])

  const maintenancePlanData = React.useMemo(() => {
    return (charts?.maintenancePlanVsActual ?? []).map((item) => ({
      ...item,
      planned: parseNumericValue(item.planned),
      actual: parseNumericValue(item.actual),
    }))
  }, [charts?.maintenancePlanVsActual])

  const numberFormatter = React.useMemo(() => new Intl.NumberFormat("vi-VN"), [])

  const repairTrendData = React.useMemo(() => {
    return repairFrequency.map(({ period, total, completed }) => {
      const [year, month] = period.split('-')
      const parsed = new Date(Number(year), Number(month) - 1)
      const label = Number.isNaN(parsed.getTime()) ? period : format(parsed, "MMM yyyy", { locale: vi })
      return {
        period: label,
        totalRequests: parseNumericValue(total),
        completedRequests: parseNumericValue(completed),
      }
    })
  }, [repairFrequency])

  const topEquipmentChartData = React.useMemo(
    () =>
      topEquipmentRepairs.slice(0, 8).map((item, index) => ({
        name: item.equipmentName,
        totalRequests: parseNumericValue(item.totalRequests),
        rank: index + 1,
        latestCompletedDate: item.latestCompletedDate,
        latestStatus: item.latestStatus,
      })),
    [topEquipmentRepairs]
  )

  const formatDateDisplay = React.useCallback((value?: string | null) => {
    if (!value) return "—"
    try {
      return format(parseISO(value), "dd/MM/yyyy")
    } catch {
      return "—"
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc báo cáo</CardTitle>
          <CardDescription>Chọn khoảng thời gian để xem báo cáo.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y", { locale: vi })} -{" "}
                      {format(dateRange.to, "LLL dd, y", { locale: vi })}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Chọn khoảng ngày</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => range && setDateRange({ from: range.from || new Date(), to: range.to || new Date()})}
                numberOfMonths={2}
                locale={vi}
              />
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Yêu cầu sửa chữa</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{normalizedSummary.totalRepairs}</div>}
            <p className="text-xs text-muted-foreground">Tổng số yêu cầu trong kỳ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành (Sửa chữa)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{normalizedSummary.repairCompletionRate.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground">So với tổng số yêu cầu</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Công việc bảo trì (Kế hoạch)</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{normalizedSummary.totalMaintenancePlanned}</div>}
            <p className="text-xs text-muted-foreground">Tổng công việc trong kỳ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành (Bảo trì)</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{normalizedSummary.maintenanceCompletionRate.toFixed(1)}%</div>}
            <p className="text-xs text-muted-foreground">So với kế hoạch</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Xu hướng sửa chữa theo thời gian</CardTitle>
            <CardDescription>Số lượng yêu cầu sửa chữa và hoàn thành theo tháng.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[340px] w-full" />
            ) : repairTrendData.length === 0 ? (
              <div className="text-sm text-muted-foreground h-[340px] flex flex-col items-center justify-center gap-2">
                <Inbox className="h-8 w-8 text-muted-foreground/60" />
                <span>Không có dữ liệu xu hướng sửa chữa.</span>
              </div>
            ) : (
              <DynamicLineChart
                data={repairTrendData}
                height={340}
                xAxisKey="period"
                lines={[
                  { key: "totalRequests", color: "hsl(var(--chart-1))", name: "Tổng yêu cầu" },
                  { key: "completedRequests", color: "hsl(var(--chart-4))", name: "Hoàn thành" },
                ]}
                margin={{ top: 16, right: 24, left: 16, bottom: 12 }}
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tình trạng yêu cầu sửa chữa</CardTitle>
            <CardDescription>Phân bổ các yêu cầu sửa chữa theo trạng thái.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[340px] w-full" />
            ) : repairStatusData.length === 0 ? (
              <div className="text-sm text-muted-foreground h-[340px] flex flex-col items-center justify-center gap-2">
                <Inbox className="h-8 w-8 text-muted-foreground/60" />
                <span>Không có dữ liệu trạng thái sửa chữa.</span>
              </div>
            ) : (
              <DynamicPieChart
                data={repairStatusData}
                height={340}
                dataKey="value"
                nameKey="name"
                colors={repairStatusData.map(entry => entry.color)}
                innerRadius={90}
                outerRadius={130}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kế hoạch vs. Thực tế</CardTitle>
          <CardDescription>So sánh công việc bảo trì theo kế hoạch và thực tế hoàn thành.</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : maintenancePlanData.length === 0 ? (
            <div className="text-sm text-muted-foreground h-[360px] flex flex-col items-center justify-center gap-2">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <span>Không có dữ liệu kế hoạch bảo trì.</span>
            </div>
          ) : (
            <DynamicBarChart
              data={maintenancePlanData}
              height={360}
              xAxisKey="name"
              bars={[
                { key: "planned", color: "var(--color-planned)", name: "Kế hoạch" },
                { key: "actual", color: "var(--color-actual)", name: "Thực tế" },
              ]}
              margin={{ top: 20, right: 24, left: 16, bottom: 40 }}
            />
          )}
        </CardContent>
      </Card>

      {/* Repair history table */}
      <Card className="border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Thiết bị sửa chữa nhiều nhất</CardTitle>
          <CardDescription>Top thiết bị có số lượng yêu cầu sửa chữa cao trong khoảng thời gian đã chọn.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : topEquipmentRepairs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Không có dữ liệu sửa chữa trong khoảng thời gian đã chọn.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">#</TableHead>
                    <TableHead>Thiết bị</TableHead>
                    <TableHead>Số yêu cầu</TableHead>
                    <TableHead>Trạng thái gần nhất</TableHead>
                    <TableHead>Ngày sửa chữa gần nhất</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topEquipmentChartData.map((item) => (
                    <TableRow key={`${item.name}-${item.rank}`} className="group">
                      <TableCell className="text-center">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary group-hover:bg-primary/20">
                          {item.rank}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{numberFormatter.format(item.totalRequests)}</TableCell>
                      <TableCell>
                        <Badge variant={item.latestStatus === "Hoàn thành" ? "default" : "secondary"}>
                          {item.latestStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateDisplay(item.latestCompletedDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Lịch sử sửa chữa gần đây</CardTitle>
          <CardDescription>Các yêu cầu sửa chữa mới nhất nằm trong khoảng thời gian đã chọn.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : recentRepairHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">Không có lịch sử sửa chữa trong khoảng thời gian đã chọn.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thiết bị</TableHead>
                    <TableHead>Sự cố</TableHead>
                    <TableHead>Ngày yêu cầu</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Ngày hoàn thành</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentRepairHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.equipmentName}</TableCell>
                      <TableCell className="max-w-[320px] truncate" title={item.issue}>{item.issue}</TableCell>
                      <TableCell>{formatDateDisplay(item.requestedDate)}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Hoàn thành" ? "default" : "secondary"}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>{formatDateDisplay(item.completedDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 