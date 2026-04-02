"use client"

import * as React from "react"
import { Calendar, Clock, User, Package, MapPin, Phone, Building } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTransferDetailDialogData } from "@/components/transfer-detail-dialog.data"
import { TransferStatusProgress } from "@/components/transfers/TransferStatusProgress"
import { 
  TRANSFER_TYPES, 
  TRANSFER_STATUSES,
  TRANSFER_PURPOSES,
  type TransferRequest
} from "@/types/database"

interface TransferDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferRequest | null
}

export function TransferDetailDialog({ open, onOpenChange, transfer }: TransferDetailDialogProps) {
  const { history, isLoadingHistory, resolvedTransfer, transferId } = useTransferDetailDialogData({
    open,
    transfer,
  })

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'cho_duyet': return 'secondary'
      case 'da_duyet': return 'default'
      case 'dang_luan_chuyen': return 'destructive'
      case 'hoan_thanh': return 'default'
      default: return 'secondary'
    }
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Chưa có'
    return new Date(dateString).toLocaleString('vi-VN')
  }

  const displayTransfer = resolvedTransfer?.id === transferId ? resolvedTransfer : transfer

  if (!displayTransfer) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Chi tiết yêu cầu luân chuyển - {displayTransfer.ma_yeu_cau}
          </DialogTitle>
          <DialogDescription>
            Thông tin chi tiết và lịch sử của yêu cầu luân chuyển thiết bị
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] mt-4">
          <div className="space-y-6 pr-4">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Thiết bị:</span>
                  </div>
                  <div className="ml-6">
                    <p className="font-medium">{displayTransfer.thiet_bi?.ten_thiet_bi}</p>
                    <p className="text-sm text-muted-foreground">
                      {displayTransfer.thiet_bi?.ma_thiet_bi}
                      {displayTransfer.thiet_bi?.model && ` • Model: ${displayTransfer.thiet_bi.model}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={displayTransfer.loai_hinh === 'noi_bo' ? 'default' : 'secondary'}>
                      {TRANSFER_TYPES[displayTransfer.loai_hinh]}
                    </Badge>
                    <Badge variant={getStatusVariant(displayTransfer.trang_thai)}>
                      {TRANSFER_STATUSES[displayTransfer.trang_thai]}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Transfer Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Chi tiết luân chuyển</h3>
              
              {displayTransfer.loai_hinh === 'noi_bo' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Từ khoa/phòng:</span>
                    </div>
                    <p className="ml-6">{displayTransfer.khoa_phong_hien_tai}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Đến khoa/phòng:</span>
                    </div>
                    <p className="ml-6">{displayTransfer.khoa_phong_nhan}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="font-medium">Mục đích:</span>
                      <p className="text-sm">{displayTransfer.muc_dich ? TRANSFER_PURPOSES[displayTransfer.muc_dich] : 'Chưa xác định'}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Đơn vị nhận:</span>
                      </div>
                      <p className="ml-6">{displayTransfer.don_vi_nhan}</p>
                    </div>
                  </div>
                  
                  {displayTransfer.dia_chi_don_vi && (
                    <div className="space-y-2">
                      <span className="font-medium">Địa chỉ:</span>
                      <p className="text-sm">{displayTransfer.dia_chi_don_vi}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayTransfer.nguoi_lien_he && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Người liên hệ:</span>
                        </div>
                        <p className="ml-6">{displayTransfer.nguoi_lien_he}</p>
                      </div>
                    )}
                    {displayTransfer.so_dien_thoai && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">Số điện thoại:</span>
                        </div>
                        <p className="ml-6">{displayTransfer.so_dien_thoai}</p>
                      </div>
                    )}
                  </div>
                  
                  {displayTransfer.ngay_du_kien_tra && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Ngày dự kiến trả về:</span>
                      </div>
                      <p className="ml-6">{new Date(displayTransfer.ngay_du_kien_tra).toLocaleDateString('vi-VN')}</p>
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <span className="font-medium">Lý do luân chuyển:</span>
                <p className="text-sm bg-muted p-3 rounded-md">{displayTransfer.ly_do_luan_chuyen}</p>
              </div>
            </div>

            <Separator />

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Thời gian thực hiện</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Ngày tạo:</span>
                  </div>
                  <p className="ml-6">{formatDateTime(displayTransfer.created_at)}</p>
                </div>
                
                {displayTransfer.ngay_duyet && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Ngày duyệt:</span>
                    </div>
                    <p className="ml-6">{formatDateTime(displayTransfer.ngay_duyet)}</p>
                  </div>
                )}
                
                {displayTransfer.ngay_ban_giao && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Ngày bàn giao:</span>
                    </div>
                    <p className="ml-6">{formatDateTime(displayTransfer.ngay_ban_giao)}</p>
                  </div>
                )}
                
                {displayTransfer.ngay_hoan_thanh && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Ngày hoàn thành:</span>
                    </div>
                    <p className="ml-6">{formatDateTime(displayTransfer.ngay_hoan_thanh)}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* People Involved */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Người liên quan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {displayTransfer.nguoi_yeu_cau && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Người yêu cầu:</span>
                    </div>
                    <p className="ml-6">{displayTransfer.nguoi_yeu_cau.full_name}</p>
                  </div>
                )}
                
                {displayTransfer.nguoi_duyet && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Người duyệt:</span>
                    </div>
                    <p className="ml-6">{displayTransfer.nguoi_duyet.full_name}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* History */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Lịch sử thay đổi</h3>
              {isLoadingHistory ? (
                <p className="text-sm text-muted-foreground">Đang tải lịch sử...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có lịch sử thay đổi</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-muted rounded-md">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2"></div>
                      <div className="flex-grow space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{item.hanh_dong}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(item.thoi_gian)}
                          </span>
                        </div>
                        {item.mo_ta && (
                          <p className="text-sm text-muted-foreground">{item.mo_ta}</p>
                        )}
                        {item.nguoi_thuc_hien && (
                          <p className="text-xs text-muted-foreground">
                            Thực hiện bởi: {item.nguoi_thuc_hien.full_name}
                          </p>
                        )}
                        {item.trang_thai_cu && item.trang_thai_moi && (
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline" className="text-xs">
                              {TRANSFER_STATUSES[item.trang_thai_cu as keyof typeof TRANSFER_STATUSES]}
                            </Badge>
                            <span>→</span>
                            <Badge variant="outline" className="text-xs">
                              {TRANSFER_STATUSES[item.trang_thai_moi as keyof typeof TRANSFER_STATUSES]}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Status Progress */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Tiến trình xử lý</h3>
              <TransferStatusProgress
                type={displayTransfer.loai_hinh}
                currentStatus={displayTransfer.trang_thai}
                className="py-2"
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
