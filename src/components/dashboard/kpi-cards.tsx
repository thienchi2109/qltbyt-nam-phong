"use client"

import Link from "next/link"
import { Package, HardHat, Wrench, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useTotalEquipment,
  useMaintenanceCount,
  useRepairRequestStats,
  useMaintenancePlanStats
} from "@/hooks/use-dashboard-stats"

// Total Equipment Card
export function TotalEquipmentCard() {
  const { data: totalDevices, isLoading, error } = useTotalEquipment()

  return (
    <Card className="mobile-kpi-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 md:p-6 md:pb-2">
        <CardTitle className="text-xs md:text-sm font-medium truncate">
          Tổng số thiết bị
        </CardTitle>
        <Package className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        {isLoading ? (
          <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
        ) : error ? (
          <div className="text-lg md:text-2xl font-bold text-destructive">--</div>
        ) : (
          <div className="text-lg md:text-2xl font-bold">{totalDevices}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1 leading-tight">
          Thiết bị đang được quản lý
        </p>
      </CardContent>
    </Card>
  )
}

// Maintenance Count Card
export function MaintenanceCountCard() {
  const { data: maintenanceCount, isLoading, error } = useMaintenanceCount()

  return (
    <Card className="mobile-kpi-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 md:p-6 md:pb-2">
        <CardTitle className="text-xs md:text-sm font-medium truncate">
          Cần bảo trì/hiệu chuẩn
        </CardTitle>
        <HardHat className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        {isLoading ? (
          <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
        ) : error ? (
          <div className="text-lg md:text-2xl font-bold text-destructive">--</div>
        ) : (
          <div className="text-lg md:text-2xl font-bold">{maintenanceCount}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1 leading-tight">
          Thiết bị có lịch bảo trì hoặc hiệu chuẩn
        </p>
      </CardContent>
    </Card>
  )
}

// Repair Requests Card
export function RepairRequestsCard() {
  const { data: repairStats, isLoading, error } = useRepairRequestStats()

  return (
    <Card className="mobile-kpi-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 md:p-6 md:pb-2">
        <CardTitle className="text-xs md:text-sm font-medium truncate">Yêu cầu sửa chữa</CardTitle>
        <Wrench className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        {isLoading ? (
          <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
        ) : error ? (
          <div className="text-lg md:text-2xl font-bold text-destructive">--</div>
        ) : (
          <div className="text-lg md:text-2xl font-bold">{repairStats?.total || 0}</div>
        )}
        {isLoading ? (
          <Skeleton className="h-3 w-24 md:w-32" />
        ) : (
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            {error ? (
              "Lỗi tải dữ liệu"
            ) : (
              <span className="hidden md:inline">
                {`${repairStats?.pending || 0} chờ xử lý • ${repairStats?.approved || 0} đã duyệt • ${repairStats?.completed || 0} hoàn thành`}
              </span>
            )}
            {!error && (
              <span className="md:hidden">
                {`${repairStats?.pending || 0} chờ • ${repairStats?.approved || 0} duyệt • ${repairStats?.completed || 0} xong`}
              </span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Maintenance Plans Card
export function MaintenancePlansCard() {
  const { data: planStats, isLoading, error } = useMaintenancePlanStats()

  return (
    <Card className="mobile-kpi-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-3 md:p-6 md:pb-2">
        <CardTitle className="text-xs md:text-sm font-medium truncate">Kế hoạch BT/HC/KĐ</CardTitle>
        <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground flex-shrink-0" />
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        {isLoading ? (
          <Skeleton className="h-6 md:h-8 w-12 md:w-16" />
        ) : error ? (
          <div className="text-lg md:text-2xl font-bold text-destructive">--</div>
        ) : (
          <div className="text-lg md:text-2xl font-bold">{planStats?.total || 0}</div>
        )}
        {isLoading ? (
          <Skeleton className="h-3 w-20 md:w-24" />
        ) : (
          <p className="text-xs text-muted-foreground mt-1 leading-tight">
            {error ? (
              "Lỗi tải dữ liệu"
            ) : (
              `${planStats?.draft || 0} nháp • ${planStats?.approved || 0} đã duyệt`
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Combined KPI Cards Component
export function KPICards() {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
      <TotalEquipmentCard />
      <MaintenanceCountCard />
      <RepairRequestsCard />
      <MaintenancePlansCard />
    </div>
  )
}
