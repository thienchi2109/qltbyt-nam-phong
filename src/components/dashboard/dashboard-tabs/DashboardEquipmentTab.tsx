import Link from "next/link"
import { ArrowUpRight, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TabsContent } from "@/components/ui/tabs"
import { TruncatedText } from "@/components/ui/truncated-text"
import type { EquipmentAttention } from "@/hooks/use-dashboard-stats.types"

interface DashboardEquipmentTabProps {
  equipmentAttentionHref: string
  equipmentError: unknown
  showEquipmentSkeleton: boolean
  equipmentNeedingAttention: EquipmentAttention[]
  equipmentPageDataLoaded: boolean
  equipmentPage: number
  equipmentTotalPages: number
  equipmentTotal: number
  equipmentHasMore: boolean
  isFetchingEquipment: boolean
  onPreviousPage: () => void
  onNextPage: () => void
}

function getEquipmentStatusColor(status: string) {
  switch (status) {
    case "Chờ sửa chữa":
      return "border-red-500 bg-red-50/80"
    case "Chờ bảo trì":
      return "border-orange-500 bg-orange-50/80"
    case "Chờ hiệu chuẩn/kiểm định":
      return "border-blue-500 bg-blue-50/80"
    default:
      return "border-gray-500 bg-gray-50/80"
  }
}

export function DashboardEquipmentTab({
  equipmentAttentionHref,
  equipmentError,
  showEquipmentSkeleton,
  equipmentNeedingAttention,
  equipmentPageDataLoaded,
  equipmentPage,
  equipmentTotalPages,
  equipmentTotal,
  equipmentHasMore,
  isFetchingEquipment,
  onPreviousPage,
  onNextPage,
}: DashboardEquipmentTabProps) {
  return (
    <TabsContent value="equipment" className="mt-0 min-w-0 space-y-4 overflow-hidden">
      <div className="mb-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardDescription className="min-w-0">
          Danh sách các thiết bị cần sửa chữa hoặc đang bảo trì
        </CardDescription>
        <Button asChild size="sm" variant="ghost" className="shrink-0 gap-1 self-start text-blue-600 hover:text-blue-700">
          <Link href={equipmentAttentionHref}>
            Xem tất cả
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {equipmentError ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Lỗi tải dữ liệu thiết bị</p>
        </div>
      ) : (
        <div className="space-y-3">
          {showEquipmentSkeleton ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-4 rounded-xl border border-gray-200/50 bg-white/60 backdrop-blur-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            ))
          ) : equipmentNeedingAttention.length > 0 ? (
            equipmentNeedingAttention.map((item) => (
              <div
                key={item.id}
                className={`min-w-0 overflow-hidden rounded-xl border-l-4 p-4 backdrop-blur-sm transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${getEquipmentStatusColor(item.tinh_trang_hien_tai)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <TruncatedText
                      text={item.ten_thiet_bi}
                      as="h4"
                      className="mb-1 block max-w-full font-semibold text-gray-900"
                    />
                    <p className="text-sm text-gray-600 mb-2 truncate">
                      {item.model || item.ma_thiet_bi}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="font-medium shrink-0">Vị trí:</span>
                        <span className="truncate">{item.vi_tri_lap_dat || "N/A"}</span>
                      </span>
                      {item.ngay_bt_tiep_theo && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <span className="font-medium">BT tiếp:</span>
                            <span>{item.ngay_bt_tiep_theo}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={item.tinh_trang_hien_tai === "Chờ sửa chữa" ? "destructive" : "secondary"}
                    className="shrink-0"
                  >
                    {item.tinh_trang_hien_tai}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <div className="p-4 bg-gray-100/50 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Wrench className="h-8 w-8 text-gray-400" />
              </div>
              <p>Không có thiết bị nào cần chú ý</p>
            </div>
          )}

          {equipmentPageDataLoaded && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-500">
                Trang {equipmentPage} / {equipmentTotalPages} • Tổng {equipmentTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={equipmentPage === 1 || isFetchingEquipment}
                  onClick={onPreviousPage}
                >
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!equipmentHasMore || isFetchingEquipment}
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
