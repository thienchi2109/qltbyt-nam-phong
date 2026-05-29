import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { TransferListItem } from '@/types/transfers-data-grid'
import { HydrationSafeRelativeTime } from '@/components/time/HydrationSafeRelativeTime'

interface TransfersKanbanCardProps {
  transfer: TransferListItem
  onClick: (transfer: TransferListItem) => void
  actions: React.ReactNode
  /** Reference date for overdue calculation - passed from parent for consistent updates */
  referenceDate: Date
}

function getTypeVariant(type: string): 'default' | 'secondary' | 'destructive' {
  switch (type) {
    case 'noi_bo':
      return 'default'
    case 'ben_ngoai':
      return 'secondary'
    case 'thanh_ly':
      return 'destructive'
    default:
      return 'default'
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'noi_bo':
      return 'Nội bộ'
    case 'ben_ngoai':
      return 'Bên ngoài'
    case 'thanh_ly':
      return 'Thanh lý'
    default:
      return type
  }
}

function isOverdue(dateStr: string | null, currentDate: Date): boolean {
  if (!dateStr) return false
  const dueTime = Date.parse(dateStr)
  return Number.isFinite(dueTime) && dueTime < currentDate.getTime() && dueTime !== 0
}

function TransfersKanbanCardComponent({
  transfer,
  onClick,
  actions,
  referenceDate,
}: TransfersKanbanCardProps) {
  const openTransferFromCard = React.useCallback(
    (e: React.MouseEvent) => {
      // Allow clicks on actions menu to propagate
      if ((e.target as HTMLElement).closest('[data-actions-menu]')) {
        return
      }
      onClick(transfer)
    },
    [onClick, transfer]
  )

  const stopActionPropagation = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation()
    },
    []
  )

  return (
    <Card className="mb-2 hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <button
          type="button"
          className="block w-full cursor-pointer space-y-2 rounded-md bg-transparent p-0 text-left text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={openTransferFromCard}
          aria-label={`Mở yêu cầu luân chuyển ${transfer.ma_yeu_cau}`}
        >
          {/* Header: Transfer code + type badge */}
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-sm truncate">
              {transfer.ma_yeu_cau}
            </span>
            <Badge variant={getTypeVariant(transfer.loai_hinh)} className="shrink-0">
              {getTypeLabel(transfer.loai_hinh)}
            </Badge>
          </div>

        {/* Equipment info */}
        <div className="space-y-1">
          <p className="text-sm font-medium truncate" title={transfer.thiet_bi?.ten_thiet_bi || 'N/A'}>
            {transfer.thiet_bi?.ten_thiet_bi || 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {transfer.thiet_bi?.ma_thiet_bi || 'N/A'} • {transfer.thiet_bi?.model || 'N/A'}
          </p>
        </div>

        {/* Transfer direction */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ArrowRight className="size-3 shrink-0" />
          <span className="truncate" title={`${transfer.khoa_phong_hien_tai || 'N/A'} → ${transfer.khoa_phong_nhan || transfer.don_vi_nhan || 'N/A'}`}>
            {transfer.khoa_phong_hien_tai || 'N/A'} → {transfer.khoa_phong_nhan || transfer.don_vi_nhan || 'N/A'}
          </span>
        </div>

        {/* Footer: Date + overdue badge */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            <HydrationSafeRelativeTime value={transfer.created_at} />
          </span>
          {transfer.ngay_du_kien_tra && isOverdue(transfer.ngay_du_kien_tra, referenceDate) && (
            <Badge variant="destructive" className="text-xs h-5">
              Quá hạn
            </Badge>
          )}
        </div>
        </button>

        {/* Actions menu */}
        <div
          onClick={stopActionPropagation}
          onKeyDown={stopActionPropagation}
          data-actions-menu
          role="presentation"
        >
          {actions}
        </div>
      </CardContent>
    </Card>
  )
}

/** Renders a memoized transfer card for kanban columns. */
export const TransfersKanbanCard = React.memo(TransfersKanbanCardComponent)
