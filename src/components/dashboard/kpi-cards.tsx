"use client"

import { Package, HardHat, Wrench, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useTotalEquipment,
  useMaintenanceCount,
  useRepairRequestStats,
  useMaintenancePlanStats,
} from "@/hooks/use-dashboard-stats"

const metricSkeletonClass = "h-9 md:h-8 w-16 md:w-16"
const descriptionSkeletonClass = "h-4 w-28 md:w-32"
const plansSkeletonClass = "h-4 w-24 md:w-24"

// Base card styles - will be extended per card with custom gradients
const cardBaseClass =
  "mobile-kpi-card bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] ring-1 ring-black/5 mb-4 md:rounded-xl md:shadow-none md:ring-0 md:mb-0"

// Elegant vibrant gradient backgrounds for each KPI card
const equipmentCardClass = `${cardBaseClass}`
const maintenanceCardClass = `${cardBaseClass}`
const repairCardClass = `${cardBaseClass}`
const planCardClass = `${cardBaseClass}`
const headerClass =
  "flex flex-row items-center justify-between space-y-0 p-4 pb-2 md:p-6 md:pb-2 gap-3 md:gap-2"
const titleClass = "text-sm font-semibold truncate md:text-sm md:font-medium text-slate-600"
// Icon colors matching card gradients - more vibrant
const equipmentIconClass = "h-5 w-5 text-blue-600 md:h-4 md:w-4 flex-shrink-0"
const maintenanceIconClass = "h-5 w-5 text-emerald-600 md:h-4 md:w-4 flex-shrink-0"
const repairIconClass = "h-5 w-5 text-sky-600 md:h-4 md:w-4 flex-shrink-0"
const planIconClass = "h-5 w-5 text-purple-600 md:h-4 md:w-4 flex-shrink-0"
const contentClass = "p-4 pt-0 space-y-2 md:p-6 md:pt-0"
const metricClass =
  "text-4xl font-bold leading-tight tracking-tight md:text-2xl md:leading-snug md:tracking-normal text-slate-900"
const descriptionClass =
  "text-sm text-neutral-500 leading-snug md:text-xs md:text-muted-foreground md:leading-tight"

export function TotalEquipmentCard() {
  const { data: totalDevices, isLoading, error } = useTotalEquipment()

  return (
    <Card className={equipmentCardClass}>
      <CardHeader className={headerClass}>
        <CardTitle className={titleClass}>Tổng số thiết bị</CardTitle>
        <Package className={equipmentIconClass} aria-hidden="true" />
      </CardHeader>
      <CardContent className={contentClass}>
        {isLoading ? (
          <Skeleton className={metricSkeletonClass} />
        ) : error ? (
          <div className={`${metricClass} text-destructive`}>--</div>
        ) : (
          <div className={metricClass} aria-label={`${totalDevices ?? 0} thiết bị`}>
            {totalDevices ?? 0}
          </div>
        )}
        <p className={descriptionClass}>Thiết bị đang được quản lý</p>
      </CardContent>
    </Card>
  )
}

export function MaintenanceCountCard() {
  const { data: maintenanceCount, isLoading, error } = useMaintenanceCount()

  return (
    <Card className={maintenanceCardClass}>
      <CardHeader className={headerClass}>
        <CardTitle className={titleClass}>Cần bảo trì/hiệu chuẩn</CardTitle>
        <HardHat className={maintenanceIconClass} aria-hidden="true" />
      </CardHeader>
      <CardContent className={contentClass}>
        {isLoading ? (
          <Skeleton className={metricSkeletonClass} />
        ) : error ? (
          <div className={`${metricClass} text-destructive`}>--</div>
        ) : (
          <div className={metricClass} aria-label={`${maintenanceCount ?? 0} thiết bị cần bảo trì`}>
            {maintenanceCount ?? 0}
          </div>
        )}
        <p className={descriptionClass}>Thiết bị có lịch bảo trì hoặc hiệu chuẩn</p>
      </CardContent>
    </Card>
  )
}

export function RepairRequestsCard() {
  const { data: repairStats, isLoading, error } = useRepairRequestStats()

  const pending = repairStats?.pending ?? 0
  const approved = repairStats?.approved ?? 0
  const completed = repairStats?.completed ?? 0
  const total = repairStats?.total ?? 0

  return (
    <Card className={repairCardClass}>
      <CardHeader className={headerClass}>
        <CardTitle className={titleClass}>Yêu cầu sửa chữa</CardTitle>
        <Wrench className={repairIconClass} aria-hidden="true" />
      </CardHeader>
      <CardContent className={contentClass}>
        {isLoading ? (
          <Skeleton className={metricSkeletonClass} />
        ) : error ? (
          <div className={`${metricClass} text-destructive`}>--</div>
        ) : (
          <div className={metricClass} aria-label={`${total} yêu cầu sửa chữa`}>
            {total}
          </div>
        )}
        {isLoading ? (
          <Skeleton className={descriptionSkeletonClass} />
        ) : (
          <p className={descriptionClass}>
            {error ? (
              "Lỗi tải dữ liệu"
            ) : (
              <>
                <span className="hidden md:inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-red-600">{pending}</span>
                    <span>chờ xử lý</span>
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-amber-600">{approved}</span>
                    <span>đã duyệt</span>
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-green-600">{completed}</span>
                    <span>hoàn thành</span>
                  </span>
                </span>
                <span className="md:hidden inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-neutral-600">
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-red-600">{pending}</span>
                    <span>chờ</span>
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-amber-600">{approved}</span>
                    <span>duyệt</span>
                  </span>
                  <span className="text-neutral-400">•</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-semibold text-green-600">{completed}</span>
                    <span>xong</span>
                  </span>
                </span>
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function MaintenancePlansCard() {
  const { data: planStats, isLoading, error } = useMaintenancePlanStats()
  const total = planStats?.total ?? 0
  const draft = planStats?.draft ?? 0
  const approved = planStats?.approved ?? 0

  return (
    <Card className={planCardClass}>
      <CardHeader className={headerClass}>
        <CardTitle className={titleClass}>Kế hoạch BT/HC/KĐ</CardTitle>
        <Calendar className={planIconClass} aria-hidden="true" />
      </CardHeader>
      <CardContent className={contentClass}>
        {isLoading ? (
          <Skeleton className={metricSkeletonClass} />
        ) : error ? (
          <div className={`${metricClass} text-destructive`}>--</div>
        ) : (
          <div className={metricClass} aria-label={`${total} kế hoạch bảo trì, hiệu chuẩn, kiểm định`}>
            {total}
          </div>
        )}
        {isLoading ? (
          <Skeleton className={plansSkeletonClass} />
        ) : (
          <p className={descriptionClass}>
            {error ? "Lỗi tải dữ liệu" : `${draft} nháp • ${approved} đã duyệt`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function KPICards() {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-2 md:gap-10 md:pb-6 lg:grid-cols-4">
      <TotalEquipmentCard />
      <MaintenanceCountCard />
      <RepairRequestsCard />
      <MaintenancePlansCard />
    </div>
  )
}
