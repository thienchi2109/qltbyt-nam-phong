"use client"

import * as React from "react"
import { Activity, AlertCircle, CheckCircle, Clock, XCircle, Pause } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { DynamicPieChart } from "@/components/dynamic-chart"
import { buildStatusDonutData } from "@/components/equipment-distribution-summary.utils"
import { 
  useEquipmentDistribution, 
  STATUS_COLORS,
  STATUS_LABELS
} from "@/hooks/use-equipment-distribution"

interface EquipmentDistributionSummaryProps {
  className?: string
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
}

const EQUIPMENT_DISTRIBUTION_SKELETON_KEYS = [
  "equipment-distribution-skeleton-1",
  "equipment-distribution-skeleton-2",
  "equipment-distribution-skeleton-3",
  "equipment-distribution-skeleton-4",
] as const

const STATUS_DISPLAY_ORDER = [
  "hoat_dong",
  "ngung_su_dung",
  "chua_co_nhu_cau",
  "cho_sua_chua",
  "cho_bao_tri",
  "cho_hieu_chuan",
] as const

export function EquipmentDistributionSummary({ className, tenantFilter, selectedDonVi, effectiveTenantKey }: EquipmentDistributionSummaryProps) {
  const { data, isLoading, error } = useEquipmentDistribution(undefined, undefined, tenantFilter, selectedDonVi, effectiveTenantKey)

  // Calculate overall statistics
  const overallStats = React.useMemo(() => {
    if (!data) return null

    const totalEquipment = data.totalEquipment
    
    // Sum up all status counts from departments data
    const statusCounts = data.byDepartment.reduce((acc, dept) => {
      acc.hoat_dong += dept.hoat_dong
      acc.cho_sua_chua += dept.cho_sua_chua
      acc.cho_bao_tri += dept.cho_bao_tri
      acc.cho_hieu_chuan += dept.cho_hieu_chuan
      acc.ngung_su_dung += dept.ngung_su_dung
      acc.chua_co_nhu_cau += dept.chua_co_nhu_cau
      return acc
    }, {
      hoat_dong: 0,
      cho_sua_chua: 0,
      cho_bao_tri: 0,
      cho_hieu_chuan: 0,
      ngung_su_dung: 0,
      chua_co_nhu_cau: 0
    })

    // Calculate percentages
    const statusPercentages = Object.entries(statusCounts).map(([key, count]) => ({
      key,
      count,
      percentage: totalEquipment > 0 ? Math.round((count / totalEquipment) * 100) : 0,
      label: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
      color: STATUS_COLORS[key as keyof typeof STATUS_COLORS]
    }))

    // Health score calculation (active equipment percentage)
    const healthScore = totalEquipment > 0 ? Math.round((statusCounts.hoat_dong / totalEquipment) * 100) : 0

    return {
      totalEquipment,
      statusCounts,
      statusPercentages,
      healthScore,
      departmentCount: data.departments.length,
      locationCount: data.locations.length
    }
  }, [data])

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {EQUIPMENT_DISTRIBUTION_SKELETON_KEYS.map((token) => (
          <Card key={token}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !overallStats) {
    return null
  }

  const getStatusIcon = (statusKey: string) => {
    const iconClassName = "size-5 text-white"

    switch (statusKey) {
      case 'hoat_dong':
        return <CheckCircle className={iconClassName} />
      case 'cho_sua_chua':
        return <XCircle className={iconClassName} />
      case 'cho_bao_tri':
        return <Clock className={iconClassName} />
      case 'cho_hieu_chuan':
        return <AlertCircle className={iconClassName} />
      case 'ngung_su_dung':
        return <Pause className={iconClassName} />
      default:
        return <Activity className={iconClassName} />
    }
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600"
    if (score >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getHealthScoreBadge = (score: number) => {
    if (score >= 80) return "default"
    if (score >= 60) return "secondary"
    return "destructive"
  }

  const donutData = buildStatusDonutData(overallStats.statusPercentages)
  const hasDonutData = donutData.length > 0
  const visibleStatusRows = overallStats.statusPercentages
    .filter((status) => status.count > 0)
    .sort(
      (a, b) =>
        STATUS_DISPLAY_ORDER.indexOf(a.key as (typeof STATUS_DISPLAY_ORDER)[number]) -
        STATUS_DISPLAY_ORDER.indexOf(b.key as (typeof STATUS_DISPLAY_ORDER)[number])
    )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Equipment Health Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tình trạng tổng thể</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthScoreColor(overallStats.healthScore)}`}>
              {overallStats.healthScore}%
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={overallStats.healthScore} className="flex-1" />
              <Badge variant={getHealthScoreBadge(overallStats.healthScore)}>
                {overallStats.healthScore >= 80 ? 'Tốt' : 
                 overallStats.healthScore >= 60 ? 'Trung bình' : 'Cần chú ý'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Total Equipment */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thiết bị</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {overallStats.totalEquipment}
            </div>
            <p className="text-xs text-muted-foreground">
              {overallStats.statusCounts.hoat_dong} đang hoạt động
            </p>
          </CardContent>
        </Card>

        {/* Departments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Khoa/Phòng</CardTitle>
            <Badge variant="outline">{overallStats.departmentCount}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {overallStats.departmentCount > 0 
                ? Math.round(overallStats.totalEquipment / overallStats.departmentCount)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              TB trung bình/khoa
            </p>
          </CardContent>
        </Card>

        {/* Locations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vị trí</CardTitle>
            <Badge variant="outline">{overallStats.locationCount}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {overallStats.locationCount > 0 
                ? Math.round(overallStats.totalEquipment / overallStats.locationCount)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              TB trung bình/vị trí
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Phân bố trạng thái thiết bị</CardTitle>
          <CardDescription>
            Chi tiết tình trạng của {overallStats.totalEquipment} thiết bị trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-5">
          <div
            data-testid="status-distribution-layout"
            className="grid gap-5 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]"
          >
            <div className="min-w-0">
              {hasDonutData ? (
                <div className="relative">
                  <DynamicPieChart
                    data={donutData}
                    height={260}
                    dataKey="value"
                    nameKey="name"
                    colors={donutData.map((d) => d.color)}
                    innerRadius={70}
                    outerRadius={105}
                    showLabels={false}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div data-testid="status-donut-total" className="text-3xl font-bold tracking-normal">
                        {overallStats.totalEquipment}
                      </div>
                      <div className="text-xs text-muted-foreground">thiết bị</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Không có dữ liệu trạng thái
                </div>
              )}
              {hasDonutData && (
                <div data-testid="status-donut-legend" className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
                  {donutData.map((item) => (
                    <div
                      key={item.key}
                      data-testid="status-donut-legend-item"
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          data-testid={`status-donut-legend-swatch-${item.key}`}
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.percent}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div data-testid="status-comparison-list" className="grid content-center gap-3">
              {visibleStatusRows.map((status) => (
                <div
                  key={status.key}
                  data-testid="status-comparison-row"
                  className="grid min-h-[74px] grid-cols-[48px_minmax(0,1fr)] items-center gap-4 rounded-lg border bg-card p-3"
                >
                  <div
                    className="flex size-12 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ backgroundColor: status.color }}
                  >
                    {getStatusIcon(status.key)}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{status.label}</div>
                        <div className="text-xs text-muted-foreground">
                          <span className="text-lg font-bold text-foreground">{status.count}</span> thiết bị
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{status.percentage}%</span> tổng số
                      </div>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`Tỷ lệ ${status.label}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={status.percentage}
                      className="h-2 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${status.percentage}%`, backgroundColor: status.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
