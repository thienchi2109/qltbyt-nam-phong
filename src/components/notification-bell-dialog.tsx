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
import { AppNotificationBadge } from "@/components/app-notification-badge"

interface NotificationBellDialogProps {
  allRepairRequests?: Array<{ trang_thai?: string }>;
  allTransferRequests?: Array<{ trang_thai?: string }>;
  // Optional direct counts (preferred). When provided, component won't re-count from arrays
  repairCount?: number;
  transferCount?: number;
  maintenanceCount?: number;
}

export function NotificationBellDialog({
  allRepairRequests,
  allTransferRequests,
  repairCount: repairCountProp,
  transferCount: transferCountProp,
  maintenanceCount: maintenanceCountProp = 0,
}: NotificationBellDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleDetailClick = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  // Support either direct counts or fallback to array-based counting for backward compatibility
  const repairCount =
    typeof repairCountProp === 'number'
      ? repairCountProp
      : (allRepairRequests?.filter((req) =>
          req.trang_thai === 'Chờ xử lý' || req.trang_thai === 'Đã duyệt'
        )?.length || 0);
  
  const transferCount =
    typeof transferCountProp === 'number'
      ? transferCountProp
      : (allTransferRequests?.filter((req) =>
          req.trang_thai === 'cho_duyet' || req.trang_thai === 'da_duyet'
        )?.length || 0);

  const maintenanceCount =
    typeof maintenanceCountProp === "number" ? maintenanceCountProp : 0

  const totalAlertsCount = repairCount + transferCount + maintenanceCount;

  

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
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

        <ScrollArea className="flex-grow pr-6 -mr-6">
          {totalAlertsCount === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>Không có thông báo mới.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {repairCount > 0 && (
                <section>
                  <h3 className="text-md font-semibold mb-2 flex items-center">
                    <Wrench className="h-4 w-4 mr-2 text-orange-500" />
                    Yêu cầu Sửa chữa ({repairCount})
                  </h3>
                  <div className="p-3 border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Có {repairCount} yêu cầu sửa chữa đang chờ xử lý hoặc đã được duyệt.
                    </p>
                    <Button variant="link" className="p-0 h-auto text-sm" asChild>
                      <Link href="/repair-requests" onClick={handleDetailClick}>Xem chi tiết →</Link>
                    </Button>
                  </div>
                </section>
              )}

              {transferCount > 0 && (
                <section>
                  <h3 className="text-md font-semibold mb-2 flex items-center">
                    <ArrowLeftRight className="h-4 w-4 mr-2 text-blue-500" />
                    Yêu cầu Luân chuyển ({transferCount})
                  </h3>
                  <div className="p-3 border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Có {transferCount} yêu cầu luân chuyển đang chờ duyệt hoặc đã được duyệt.
                    </p>
                    <Button variant="link" className="p-0 h-auto text-sm" asChild>
                      <Link href="/transfers" onClick={handleDetailClick}>Xem chi tiết →</Link>
                    </Button>
                  </div>
                </section>
              )}

              {maintenanceCount > 0 && (
                <section>
                  <h3 className="text-md font-semibold mb-2 flex items-center">
                    <HardHat className="h-4 w-4 mr-2 text-emerald-600" />
                    Yêu cầu Bảo trì ({maintenanceCount})
                  </h3>
                  <div className="p-3 border rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Có {maintenanceCount} kế hoạch bảo trì đã được duyệt đang chờ triển khai.
                    </p>
                    <Button variant="link" className="p-0 h-auto text-sm" asChild>
                      <Link href="/maintenance" onClick={handleDetailClick}>Xem chi tiết →</Link>
                    </Button>
                  </div>
                </section>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
