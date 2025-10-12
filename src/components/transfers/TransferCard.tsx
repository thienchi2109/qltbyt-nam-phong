"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { DensityMode } from "./DensityToggle"
import type { TransferData } from "@/lib/transfer-normalizer"
import { normalizeTransferData } from "@/lib/transfer-normalizer"

const TRANSFER_TYPES = {
  noi_bo: 'Nội bộ',
  thanh_ly: 'Thanh lý',
  ben_ngoai: 'Bên ngoài'
}

interface TransferCardProps {
  transfer: TransferData
  density: DensityMode
  onClick: () => void
  statusActions?: React.ReactNode[]
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
  canDelete?: boolean
}

function getTypeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case 'noi_bo':
      return 'default'
    case 'thanh_ly':
      return 'destructive'
    case 'ben_ngoai':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function TransferCard({
  transfer: rawTransfer,
  density,
  onClick,
  statusActions = [],
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false
}: TransferCardProps) {
  // Normalize data to consistent shape (handles both old and new API)
  const transfer = normalizeTransferData(rawTransfer)
  
  const isOverdue = 
    transfer.ngay_du_kien_tra && 
    (transfer.trang_thai === 'da_ban_giao' || transfer.trang_thai === 'dang_luan_chuyen') &&
    new Date(transfer.ngay_du_kien_tra) < new Date()

  if (density === 'compact') {
    return (
      <Card 
        className="mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <p className="text-sm font-medium leading-none truncate">
                  {transfer.ma_yeu_cau}
                </p>
                <Badge variant={getTypeVariant(transfer.loai_hinh)} className="text-xs shrink-0">
                  {TRANSFER_TYPES[transfer.loai_hinh as keyof typeof TRANSFER_TYPES]}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs px-1 py-0 shrink-0">
                    Quá hạn
                  </Badge>
                )}
              </div>
            </div>

            {/* Equipment Info */}
            <div className="truncate">
              <p className="text-sm font-medium truncate">
                {transfer.thiet_bi?.ma_thiet_bi} - {transfer.thiet_bi?.ten_thiet_bi}
              </p>
            </div>

            {/* Footer Row */}
            <div className="flex items-center justify-between pt-1 border-t">
              <p className="text-xs text-muted-foreground">
                {new Date(transfer.created_at).toLocaleDateString('vi-VN')}
              </p>
              <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                {statusActions}
                {canEdit && onEdit && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onEdit}>
                    Sửa
                  </Button>
                )}
                {canDelete && onDelete && (
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={onDelete}>
                    Xóa
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Rich mode - full details
  return (
    <Card 
      className="mb-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-none">
                {transfer.ma_yeu_cau}
              </p>
              <Badge variant={getTypeVariant(transfer.loai_hinh)}>
                {TRANSFER_TYPES[transfer.loai_hinh as keyof typeof TRANSFER_TYPES]}
              </Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Thiết bị</p>
              <p className="text-sm font-medium">
                {transfer.thiet_bi?.ma_thiet_bi} - {transfer.thiet_bi?.ten_thiet_bi}
              </p>
            </div>
            
            {transfer.loai_hinh === 'noi_bo' ? (
              <div>
                <p className="text-xs text-muted-foreground">Từ → Đến</p>
                <p className="text-sm">
                  {transfer.khoa_phong_hien_tai} → {transfer.khoa_phong_nhan}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div>
                  <p className="text-xs text-muted-foreground">Đơn vị nhận</p>
                  <p className="text-sm">{transfer.don_vi_nhan}</p>
                </div>
                {transfer.ngay_du_kien_tra && (
                  <div>
                    <p className="text-xs text-muted-foreground">Dự kiến hoàn trả</p>
                    <div className="flex items-center gap-1">
                      <p className="text-sm">
                        {new Date(transfer.ngay_du_kien_tra).toLocaleDateString('vi-VN')}
                      </p>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          Quá hạn
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div>
              <p className="text-xs text-muted-foreground">Lý do</p>
              <p className="text-sm line-clamp-2">{transfer.ly_do_luan_chuyen}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              {new Date(transfer.created_at).toLocaleDateString('vi-VN')}
            </p>
            <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {statusActions}
              {canEdit && onEdit && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onEdit}>
                  Sửa
                </Button>
              )}
              {canDelete && onDelete && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={onDelete}>
                  Xóa
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
