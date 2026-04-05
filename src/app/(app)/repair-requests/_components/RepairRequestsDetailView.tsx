import * as React from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { mapRepairRequestHistoryEntries } from "../_lib/repairRequestHistoryAdapter"
import { useRepairRequestHistory } from "../_hooks/useRepairRequestHistory"
import type { RepairRequestWithEquipment } from "../types"
import { RepairRequestsDetailTabs } from "./RepairRequestsDetailTabs"

interface RepairRequestsDetailViewProps {
  requestToView: RepairRequestWithEquipment | null
  onClose: () => void
}

/**
 * Detail view for a repair request — unified Sheet shell with tabs for details and history.
 */
export const RepairRequestsDetailView = React.memo(function RepairRequestsDetailView({
  requestToView,
  onClose,
}: RepairRequestsDetailViewProps) {
  const { data: session } = useSession()
  const user = session?.user
  const effectiveTenantKey = user?.don_vi ?? user?.current_don_vi ?? "none"
  const historyQuery = useRepairRequestHistory({
    requestId: requestToView?.id ?? null,
    effectiveTenantKey,
    userRole: user?.role,
    userDiaBanId: user?.dia_ban_id,
    hasUser: !!user,
  })
  const historyEntries = mapRepairRequestHistoryEntries(historyQuery.data ?? [])

  if (!requestToView) return null

  return (
    <Sheet open={!!requestToView} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0">
        <div className="flex h-full flex-col">
          <div className="p-4 border-b">
            <SheetTitle>Chi tiết yêu cầu sửa chữa</SheetTitle>
            <SheetDescription>
              Thông tin chi tiết và lịch sử của yêu cầu sửa chữa thiết bị
            </SheetDescription>
          </div>
          <RepairRequestsDetailTabs
            request={requestToView}
            historyEntries={historyEntries}
            isLoadingHistory={historyQuery.isLoading}
          />
          <div className="p-4 border-t flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
})
