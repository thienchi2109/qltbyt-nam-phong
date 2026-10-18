"use client"

import * as React from "react"
import Link from "next/link"
import { Bell, ArrowLeftRight, HardHat, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { TemperatureNotifications } from "@/types/temperature-monitoring"
import { AppNotificationBadge } from "@/components/app-notification-badge"

interface NotificationBellDialogProps {
  temperature?: TemperatureNotifications | null
  allRepairRequests?: Array<{ trang_thai?: string }>
  allTransferRequests?: Array<{ trang_thai?: string }>
  // Optional direct counts (preferred). When provided, component won't re-count from arrays
  repairCount?: number
  transferCount?: number
  maintenanceCount?: number
}

/** Displays current alerts and the notification settings link. */
export function NotificationBellDialog({
  temperature,
  allRepairRequests,
  allTransferRequests,
  repairCount: repairCountProp,
  transferCount: transferCountProp,
  maintenanceCount: maintenanceCountProp = 0,
}: NotificationBellDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const handleDetailClick = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  // Support either direct counts or fallback to array-based counting for backward compatibility
  const repairCount =
    typeof repairCountProp === "number"
      ? repairCountProp
      : allRepairRequests?.filter(
          (req) => req.trang_thai === "Chờ xử lý" || req.trang_thai === "Đã duyệt"
        )?.length || 0

  const transferCount =
    typeof transferCountProp === "number"
      ? transferCountProp
      : allTransferRequests?.filter(
          (req) => req.trang_thai === "cho_duyet" || req.trang_thai === "da_duyet"
        )?.length || 0

  const maintenanceCount = typeof maintenanceCountProp === "number" ? maintenanceCountProp : 0

  const totalAlertsCount =
    repairCount +
    transferCount +
    maintenanceCount +
    (temperature?.pending_review ?? 0) +
    (temperature?.open_deviations ?? 0)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="size-5" />
          <AppNotificationBadge
            count={totalAlertsCount}
            mode="floating"
            className="-right-1 -top-1 h-4 min-w-[1rem] px-1 text-xs"
          />
          <span className="sr-only">Mở thông báo</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] md:max-w-[650px] lg:max-w-[750px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Thông báo và Cảnh báo ({totalAlertsCount})</DialogTitle>
          <DialogDescription>Xem các cảnh báo quan trọng tại đây.</DialogDescription>
        </DialogHeader>

        <Button variant="link" className="w-fit p-0" asChild>
          <Link href="/notifications" onClick={handleDetailClick}>
            Cài đặt nhận thông báo
          </Link>
        </Button>

        <ScrollArea className="flex-grow pr-6 -mr-6">
          {totalAlertsCount === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bell className="mx-auto size-12 mb-4 opacity-50" />
              <p>Không có thông báo mới.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {temperature &&
                (temperature.pending_review > 0 || temperature.open_deviations > 0) && (
                  <section>
                    <h3 className="font-semibold">
                      Sổ nhiệt độ · {temperature.from_date} – {temperature.to_date}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {[
                        ["review_queue", "Chờ xác nhận", temperature.pending_review],
                        ["open_deviations", "Sai lệch mở", temperature.open_deviations],
                      ].map(([kind, label, count]) => (
                        <Link
                          key={kind}
                          className="min-h-11 p-3 underline"
                          onClick={handleDetailClick}
                          href={`/temperature-monitoring?kind=${kind}&from=${temperature.from_date}&to=${temperature.to_date}`}
                        >
                          {label}: {count}
                        </Link>
                      ))}
                    </div>
                    {temperature.items.map((item) => (
                      <Button
                        key={`${item.reading_id}-${item.kind}`}
                        variant="link"
                        className="h-auto w-full justify-start whitespace-normal text-left"
                        asChild
                      >
                        <Link
                          href={`/temperature-monitoring?equipment=${item.equipment_id}&date=${item.monitoring_date}&reading=${item.reading_id}`}
                          onClick={handleDetailClick}
                        >
                          {item.equipment_name} · {item.monitoring_date} ·{" "}
                          {item.kind === "review" ? "Xét duyệt" : "Xử lý sai lệch"}
                        </Link>
                      </Button>
                    ))}
                  </section>
                )}
              {repairCount > 0 && (
                <section>
                  <h3 className="text-md font-semibold mb-2 flex items-center">
                    <Wrench className="size-4 mr-2 text-orange-500" />
                    Yêu cầu Sửa chữa ({repairCount})
                  </h3>
                  <div className="p-3 border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Có {repairCount} yêu cầu sửa chữa đang chờ xử lý hoặc đã được duyệt.
                    </p>
                    <Button variant="link" className="p-0 h-auto text-sm" asChild>
                      <Link href="/repair-requests" onClick={handleDetailClick}>
                        Xem chi tiết →
                      </Link>
                    </Button>
                  </div>
                </section>
              )}

              {transferCount > 0 && (
                <section>
                  <h3 className="text-md font-semibold mb-2 flex items-center">
                    <ArrowLeftRight className="size-4 mr-2 text-blue-500" />
                    Yêu cầu Luân chuyển ({transferCount})
                  </h3>
                  <div className="p-3 border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Có {transferCount} yêu cầu luân chuyển đang chờ duyệt hoặc đã được duyệt.
                    </p>
                    <Button variant="link" className="p-0 h-auto text-sm" asChild>
                      <Link href="/transfers" onClick={handleDetailClick}>
                        Xem chi tiết →
                      </Link>
                    </Button>
                  </div>
                </section>
              )}

              {maintenanceCount > 0 && (
                <section>
                  <h3 className="text-md font-semibold mb-2 flex items-center">
                    <HardHat className="size-4 mr-2 text-emerald-600" />
                    Yêu cầu Bảo trì ({maintenanceCount})
                  </h3>
                  <div className="p-3 border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Có {maintenanceCount} kế hoạch bảo trì đã được duyệt đang chờ triển khai.
                    </p>
                    <Button variant="link" className="p-0 h-auto text-sm" asChild>
                      <Link href="/maintenance" onClick={handleDetailClick}>
                        Xem chi tiết →
                      </Link>
                    </Button>
                  </div>
                </section>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
