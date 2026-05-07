import Link from "next/link"
import { ArrowUpRight, Calendar } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsContent } from "@/components/ui/tabs"
import type { MaintenancePlan } from "@/hooks/use-cached-maintenance.types"

interface DashboardPlansTabProps {
  plansError: unknown
  showPlanSkeleton: boolean
  planItems: MaintenancePlan[]
  planListDataLoaded: boolean
  planPage: number
  planTotalPages: number
  planTotal: number
  planHasMore: boolean
  isFetchingPlans: boolean
  onPreviousPage: () => void
  onNextPage: () => void
}

function getPlanStatusVariant(status: string): "secondary" | "default" | "outline" {
  switch (status) {
    case "Bản nháp":
      return "secondary"
    case "Đã duyệt":
      return "default"
    default:
      return "outline"
  }
}

export function DashboardPlansTab({
  plansError,
  showPlanSkeleton,
  planItems,
  planListDataLoaded,
  planPage,
  planTotalPages,
  planTotal,
  planHasMore,
  isFetchingPlans,
  onPreviousPage,
  onNextPage,
}: DashboardPlansTabProps) {
  return (
    <TabsContent value="plans" className="mt-0 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <CardDescription>
          Danh sách các kế hoạch bảo trì, hiệu chuẩn, kiểm định mới nhất
        </CardDescription>
        <Button asChild size="sm" variant="ghost" className="gap-1 text-blue-600 hover:text-blue-700">
          <Link href="/maintenance">
            Xem tất cả
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {plansError ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Lỗi tải dữ liệu kế hoạch</p>
        </div>
      ) : (
        <div className="space-y-3">
          {showPlanSkeleton ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="p-4 rounded-xl border border-gray-200/50 bg-white/60 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-56" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </div>
              </div>
            ))
          ) : planItems.length > 0 ? (
            planItems.map((plan) => (
              <Link
                key={plan.id}
                href={`/maintenance?planId=${plan.id}&tab=tasks`}
                className="block"
              >
                <div className="rounded-xl border border-blue-200/60 bg-gradient-to-r from-blue-100/70 via-blue-50/80 to-white p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1 truncate">
                        {plan.ten_ke_hoach}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {plan.khoa_phong || "Tổng thể"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {plan.loai_cong_viec}
                        </Badge>
                        <Badge variant={getPlanStatusVariant(plan.trang_thai)} className="text-xs">
                          {plan.trang_thai}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Năm {plan.nam}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-gray-400 shrink-0" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
              <p>Chưa có kế hoạch nào</p>
            </div>
          )}

          {planListDataLoaded && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-500">
                Trang {planPage} / {planTotalPages} • Tổng {planTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={planPage === 1 || isFetchingPlans}
                  onClick={onPreviousPage}
                >
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!planHasMore || isFetchingPlans}
                  onClick={onNextPage}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </TabsContent>
  )
}
