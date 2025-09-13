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
}

export function NotificationBellDialog({
  allRepairRequests,
  allTransferRequests,
}: NotificationBellDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Log incoming data to debug
  React.useEffect(() => {
    console.log("Notification data:", {
      allRepairRequests,
      allTransferRequests,
      repairRequestsType: typeof allRepairRequests,
      transferRequestsType: typeof allTransferRequests,
      repairRequestsLength: allRepairRequests?.length,
      transferRequestsLength: allTransferRequests?.length,
    });
    
    if (allRepairRequests && allRepairRequests.length > 0) {
      console.log("First repair request:", allRepairRequests[0]);
    }
    
    if (allTransferRequests && allTransferRequests.length > 0) {
      console.log("First transfer request:", allTransferRequests[0]);
    }
  }, [allRepairRequests, allTransferRequests]);

  // Temporary placeholder - count of pending requests
  const repairCount = allRepairRequests?.filter((req: any) => 
    req.trang_thai === 'Chờ xử lý' || req.trang_thai === 'Đã duyệt'
  )?.length || 0;
  
  const transferCount = allTransferRequests?.filter((req: any) => 
    req.trang_thai === 'cho_duyet' || req.trang_thai === 'da_duyet'
  )?.length || 0;
  
  const totalAlertsCount = repairCount + transferCount;

  console.log("Calculated counts:", { repairCount, transferCount, totalAlertsCount });

  // Log detailed filtering for repair requests
  if (Array.isArray(allRepairRequests)) {
    console.log('Repair requests detailed analysis:');
    allRepairRequests.forEach((req, index) => {
      console.log(`Repair ${index + 1}:`, {
        id: req.id,
        trang_thai: req.trang_thai,
        mo_ta_su_co: req.mo_ta_su_co?.substring(0, 50),
        ngay_yeu_cau: req.ngay_yeu_cau,
        allKeys: Object.keys(req)
      });
    });
  } else {
    console.log('allRepairRequests is not an array:', allRepairRequests);
  }

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
