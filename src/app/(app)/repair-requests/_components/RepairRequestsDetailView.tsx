import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RepairRequestsDetailContent } from "./RepairRequestsDetailContent"
import type { RepairRequestWithEquipment } from "../types"

interface RepairRequestsDetailViewProps {
  requestToView: RepairRequestWithEquipment | null
  isMobile: boolean
  onClose: () => void
}

/**
 * Detail view for a repair request — shows Dialog on mobile, Sheet on desktop.
 * Extracted from RepairRequestsPageClient (Batch 2 Cycle 4).
 */
export const RepairRequestsDetailView = React.memo(function RepairRequestsDetailView({
  requestToView,
  isMobile,
  onClose,
}: RepairRequestsDetailViewProps) {
  if (!requestToView) return null

  if (isMobile) {
    return (
      <Dialog open={!!requestToView} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-lg font-semibold">
              Chi tiết yêu cầu sửa chữa
            </DialogTitle>
            <DialogDescription>
              Thông tin chi tiết về yêu cầu sửa chữa thiết bị
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden pr-4">
            <ScrollArea className="h-full">
              <RepairRequestsDetailContent request={requestToView} />
            </ScrollArea>
          </div>

          <DialogFooter className="flex-shrink-0 mt-4 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={!!requestToView} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <SheetTitle>Chi tiết yêu cầu sửa chữa</SheetTitle>
            <SheetDescription>Thông tin chi tiết về yêu cầu sửa chữa thiết bị</SheetDescription>
          </div>
          <div className="flex-1 overflow-hidden px-4">
            <ScrollArea className="h-full">
              <RepairRequestsDetailContent request={requestToView} />
            </ScrollArea>
          </div>
          <div className="p-4 border-t flex justify-end">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})
