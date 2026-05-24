"use client"

import * as React from "react"
import { Package } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChangeHistoryTab } from "@/components/change-history/ChangeHistoryTab"
import { SideSheetShell } from "@/components/shared/SideSheetShell"
import { useTransferDetailDialogData } from "@/components/transfer-detail-dialog.data"
import {
  mapTransferHistoryEntries,
  resolveTransferRelatedPeople,
} from "@/components/transfer-detail-history-adapter"
import { TransferDetailOverview } from "@/components/transfer-detail-overview"
import { TransferStatusProgress } from "@/components/transfers/TransferStatusProgress"
import type { TransferRequest } from "@/types/database"

interface TransferDetailDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly transfer: TransferRequest | null
}

function getTransferFreshness(value: TransferRequest | null | undefined) {
  const timestamp = value?.updated_at ?? value?.created_at
  if (!timestamp) return Number.NEGATIVE_INFINITY

  const parsed = new Date(timestamp).getTime()
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function resolveRelatedPerson<T extends { id: number }>(
  currentPersonId: number | null | undefined,
  basePerson: T | null | undefined,
  resolvedPerson: T | null | undefined,
): T | undefined {
  if (resolvedPerson && currentPersonId === resolvedPerson.id) {
    return resolvedPerson
  }

  if (basePerson && currentPersonId === basePerson.id) {
    return basePerson
  }

  return undefined
}

function resolveDisplayTransfer(
  transfer: TransferRequest | null,
  resolvedTransfer: TransferRequest | null,
  transferId: number | null,
): TransferRequest | null {
  const isSameTransfer = resolvedTransfer?.id === transferId
  const baseTransfer =
    isSameTransfer &&
    getTransferFreshness(resolvedTransfer) >= getTransferFreshness(transfer)
      ? resolvedTransfer
      : transfer

  if (!baseTransfer) {
    return null
  }

  if (!isSameTransfer || !resolvedTransfer) {
    return baseTransfer
  }

  return {
    ...baseTransfer,
    nguoi_yeu_cau: resolveRelatedPerson(
      baseTransfer.nguoi_yeu_cau_id,
      baseTransfer.nguoi_yeu_cau,
      resolvedTransfer.nguoi_yeu_cau,
    ),
    nguoi_duyet: resolveRelatedPerson(
      baseTransfer.nguoi_duyet_id,
      baseTransfer.nguoi_duyet,
      resolvedTransfer.nguoi_duyet,
    ),
  }
}

/**
 * Shows transfer request detail, history, and progress inside the shared side-sheet shell.
 */
export function TransferDetailDialog({
  open,
  onOpenChange,
  transfer,
}: TransferDetailDialogProps) {
  const { history, isLoadingHistory, resolvedTransfer, transferId } = useTransferDetailDialogData({
    open,
    transfer,
  })

  const displayTransfer = React.useMemo(
    () => resolveDisplayTransfer(transfer, resolvedTransfer, transferId),
    [resolvedTransfer, transfer, transferId],
  )

  const historyEntries = React.useMemo(
    () => mapTransferHistoryEntries(history),
    [history],
  )

  const relatedPeople = React.useMemo(
    () => resolveTransferRelatedPeople(history, displayTransfer),
    [displayTransfer, history],
  )

  if (!displayTransfer) return null

  return (
    <SideSheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <Package className="size-5" />
          Chi tiết yêu cầu luân chuyển - {displayTransfer.ma_yeu_cau}
        </span>
      }
      description="Thông tin chi tiết và lịch sử của yêu cầu luân chuyển thiết bị"
      contentClassName="sm:max-w-xl md:max-w-2xl lg:max-w-4xl"
      bodyClassName="flex flex-col overflow-hidden p-4"
    >
      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="shrink-0 self-start">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
          <TabsTrigger value="progress">Tiến trình</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <TransferDetailOverview transfer={displayTransfer} relatedPeople={relatedPeople} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <ChangeHistoryTab entries={historyEntries} isLoading={isLoadingHistory} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="progress" className="mt-0 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <div className="py-4">
              <h3 className="mb-4 text-lg font-semibold">Tiến trình xử lý</h3>
              <TransferStatusProgress
                type={displayTransfer.loai_hinh}
                currentStatus={displayTransfer.trang_thai}
                className="py-2"
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </SideSheetShell>
  )
}
