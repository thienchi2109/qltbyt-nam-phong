"use client"

import * as React from "react"
import { Bell, ArrowLeftRight, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NotificationBellDialogProps {
  allRepairRequests?: any;
  allTransferRequests?: any;
  // Optional direct counts (preferred). When provided, component won't re-count from arrays
  repairCount?: number;
  transferCount?: number;
}

export function NotificationBellDialog({
  allRepairRequests,
  allTransferRequests,
  repairCount: repairCountProp,
  transferCount: transferCountProp,
}: NotificationBellDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Support either direct counts or fallback to array-based counting for backward compatibility
  const repairCount =
    typeof repairCountProp === 'number'
      ? repairCountProp
      : (allRepairRequests?.filter((req: any) =>
          req.trang_thai === 'Chờ xử lý' || req.trang_thai === 'Đã duyệt'
        )?.length || 0);
  
  const transferCount =
    typeof transferCountProp === 'number'
      ? transferCountProp
      : (allTransferRequests?.filter((req: any) =>
          req.trang_thai === 'cho_duyet' || req.trang_thai === 'da_duyet'
        )?.length || 0);
  
  const totalAlertsCount = repairCount + transferCount;

  

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {totalAlertsCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 min-w-[1rem] p-0.5 text-xs flex items-center justify-center rounded-full"
            >
              {totalAlertsCount > 9 ? "9+" : totalAlertsCount}
            </Badge>
          )}
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
                      <a href="/repair-requests">Xem chi tiết →</a>
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
                      <a href="/transfers">Xem chi tiết →</a>
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
