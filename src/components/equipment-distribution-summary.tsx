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
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
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
    switch (statusKey) {
      case 'hoat_dong':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'cho_sua_chua':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'cho_bao_tri':
        return <Clock className="h-4 w-4 text-amber-600" />
      case 'cho_hieu_chuan':
        return <AlertCircle className="h-4 w-4 text-violet-600" />
      case 'ngung_su_dung':
        return <Pause className="h-4 w-4 text-gray-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-400" />
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
        <CardContent>
          <div
            data-testid="status-distribution-layout"
            className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]"
          >
            <div className="rounded-lg border p-4">
              <div className="mb-2 text-sm font-medium">Tỷ lệ trạng thái</div>
              {hasDonutData ? (
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
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Không có dữ liệu trạng thái
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {overallStats.statusPercentages
              .filter(status => status.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((status) => (
                <div 
                  key={status.key} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.key)}
                    <div>
                      <div className="font-medium text-sm">{status.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {status.percentage}% tổng số
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">{status.count}</div>
                    <div className="text-xs text-muted-foreground">thiết bị</div>
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
