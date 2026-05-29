import * as React from "react"
import { useSession } from "next-auth/react"
import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { Button } from "@/components/ui/button"
import {
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import { mapRepairRequestHistoryEntries } from "@/app/(app)/repair-requests/_lib/repairRequestHistoryAdapter"
import { useRepairRequestHistory } from "@/app/(app)/repair-requests/_hooks/useRepairRequestHistory"
import type { RepairRequestWithEquipment } from "@/app/(app)/repair-requests/types"
import { useRepairRequestsContext } from "../_hooks/useRepairRequestsContext"
import { RepairRequestsDetailTabs } from "./RepairRequestsDetailTabs"

interface ControlledRepairRequestsDetailViewProps {
  requestToView: RepairRequestWithEquipment | null
  onClose: () => void
  contentHeader?: React.ReactNode
  footerContent?: React.ReactNode
  renderSheetShell?: boolean
}

interface RepairRequestsDetailViewProps {
  contentHeader?: React.ReactNode
  footerContent?: React.ReactNode
  renderSheetShell?: boolean
}

const SAFE_HISTORY_ERROR_MESSAGE = "Không thể tải lịch sử thay đổi lúc này. Vui lòng thử lại sau."

function getSafeHistoryErrorMessage(error: unknown) {
  if (!error) return null

  const rawMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : ""

  if (
    /RPC repair_request_change_history_list failed/i.test(rawMessage) ||
    /\(\d{3}\)/.test(rawMessage)
  ) {
    return SAFE_HISTORY_ERROR_MESSAGE
  }

  return SAFE_HISTORY_ERROR_MESSAGE
}

/**
 * Controlled detail view for callers outside the repair-requests dialog context.
 */
export const ControlledRepairRequestsDetailView = React.memo(function ControlledRepairRequestsDetailView({
  requestToView,
  onClose,
  contentHeader,
  footerContent,
  renderSheetShell = true,
}: ControlledRepairRequestsDetailViewProps) {
  const hasFooterContent = footerContent !== null && footerContent !== undefined
  const [activeTab, setActiveTab] = React.useState("details")

  // Reset to details tab when viewing a different request
  React.useEffect(() => { setActiveTab("details") }, [requestToView?.id])

  const { data: session } = useSession()
  const user = session?.user
  const effectiveTenantKey = user?.don_vi ?? user?.current_don_vi ?? "none"
  const historyQuery = useRepairRequestHistory({
    requestId: requestToView?.id ?? null,
    effectiveTenantKey,
    userRole: user?.role,
    userDiaBanId: user?.dia_ban_id,
    hasUser: !!user,
    enabled: activeTab === "history",
  })
  const historyEntries = React.useMemo(
    () => historyQuery.data ? mapRepairRequestHistoryEntries(historyQuery.data) : [],
    [historyQuery.data],
  )
  const historyErrorMessage = React.useMemo(
    () => (historyQuery.isError ? getSafeHistoryErrorMessage(historyQuery.error) : null),
    [historyQuery.error, historyQuery.isError],
  )

  React.useEffect(() => {
    if (!historyQuery.isError || !historyQuery.error || !requestToView) return

    console.error("[RepairRequestsDetailView] Failed to load repair request history:", {
      requestId: requestToView.id,
      error: historyQuery.error,
    })
  }, [historyQuery.error, historyQuery.isError, requestToView])

  if (!requestToView) return null

  const detailTabs = (
    <RepairRequestsDetailTabs
      request={requestToView}
      historyEntries={historyEntries}
      isLoadingHistory={historyQuery.isLoading}
      isHistoryError={historyQuery.isError}
      historyErrorMessage={historyErrorMessage}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />
  )

  const footer = (
    <>
      {hasFooterContent ? <div className="min-w-0">{footerContent}</div> : null}
      <Button variant="outline" onClick={onClose}>
        Đóng
      </Button>
    </>
  )

  const footerClassName = hasFooterContent
    ? "flex items-center justify-between gap-3"
    : "flex justify-end"

  const content = (
    <div className="flex h-full flex-col">
      <div className="p-4 border-b">
        <SheetTitle>Chi tiết yêu cầu sửa chữa</SheetTitle>
        <SheetDescription>
          Thông tin chi tiết và lịch sử của yêu cầu sửa chữa thiết bị
        </SheetDescription>
      </div>
      {contentHeader}
      {detailTabs}
      <div
        className={
          hasFooterContent
            ? "p-4 border-t flex items-center justify-between gap-3"
            : "p-4 border-t flex justify-end"
        }
      >
        {footer}
      </div>
    </div>
  )

  if (!renderSheetShell) {
    return content
  }

  return (
    <SideSheetShell
      open={!!requestToView}
      onOpenChange={(open) => !open && onClose()}
      title="Chi tiết yêu cầu sửa chữa"
      description="Thông tin chi tiết và lịch sử của yêu cầu sửa chữa thiết bị"
      contentClassName="sm:max-w-xl md:max-w-2xl lg:max-w-3xl"
      bodyClassName="flex flex-col"
      footer={footer}
      footerClassName={footerClassName}
    >
      {contentHeader}
      {detailTabs}
    </SideSheetShell>
  )
})

/**
 * Detail view for the repair-requests page dialog context.
 */
export const RepairRequestsDetailView = React.memo(function RepairRequestsDetailView({
  contentHeader,
  footerContent,
  renderSheetShell = true,
}: RepairRequestsDetailViewProps) {
  const {
    dialogState: { requestToView },
    closeAllDialogs,
  } = useRepairRequestsContext()

  return (
    <ControlledRepairRequestsDetailView
      requestToView={requestToView}
      onClose={closeAllDialogs}
      contentHeader={contentHeader}
      footerContent={footerContent}
      renderSheetShell={renderSheetShell}
    />
  )
})
