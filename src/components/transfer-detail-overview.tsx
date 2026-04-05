"use client"

import * as React from "react"
import { Building, Calendar, Clock, MapPin, Package, Phone, User } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  TRANSFER_PURPOSES,
  TRANSFER_STATUSES,
  TRANSFER_TYPES,
  type TransferRequest,
} from "@/types/database"

interface TransferDetailOverviewProps {
  transfer: TransferRequest
}

function getStatusVariant(status: string) {
  switch (status) {
    case "cho_duyet":
      return "secondary"
    case "da_duyet":
      return "default"
    case "dang_luan_chuyen":
      return "destructive"
    case "hoan_thanh":
      return "default"
    default:
      return "secondary"
  }
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return "Chưa có"
  return new Date(dateString).toLocaleString("vi-VN")
}

export function TransferDetailOverview({ transfer }: TransferDetailOverviewProps) {
  return (
    <div className="space-y-6 pr-4">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Thông tin cơ bản</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Thiết bị:</span>
            </div>
            <div className="ml-6">
              <p className="font-medium">{transfer.thiet_bi?.ten_thiet_bi}</p>
              <p className="text-sm text-muted-foreground">
                {transfer.thiet_bi?.ma_thiet_bi}
                {transfer.thiet_bi?.model && ` • Model: ${transfer.thiet_bi.model}`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={transfer.loai_hinh === "noi_bo" ? "default" : "secondary"}>
                {TRANSFER_TYPES[transfer.loai_hinh]}
              </Badge>
              <Badge variant={getStatusVariant(transfer.trang_thai)}>
                {TRANSFER_STATUSES[transfer.trang_thai]}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Chi tiết luân chuyển</h3>

        {transfer.loai_hinh === "noi_bo" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Từ khoa/phòng:</span>
              </div>
              <p className="ml-6">{transfer.khoa_phong_hien_tai}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Đến khoa/phòng:</span>
              </div>
              <p className="ml-6">{transfer.khoa_phong_nhan}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <span className="font-medium">Mục đích:</span>
                <p className="text-sm">
                  {transfer.muc_dich ? TRANSFER_PURPOSES[transfer.muc_dich] : "Chưa xác định"}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Đơn vị nhận:</span>
                </div>
                <p className="ml-6">{transfer.don_vi_nhan}</p>
              </div>
            </div>

            {transfer.dia_chi_don_vi ? (
              <div className="space-y-2">
                <span className="font-medium">Địa chỉ:</span>
                <p className="text-sm">{transfer.dia_chi_don_vi}</p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {transfer.nguoi_lien_he ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Người liên hệ:</span>
                  </div>
                  <p className="ml-6">{transfer.nguoi_lien_he}</p>
                </div>
              ) : null}
              {transfer.so_dien_thoai ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Số điện thoại:</span>
                  </div>
                  <p className="ml-6">{transfer.so_dien_thoai}</p>
                </div>
              ) : null}
            </div>

            {transfer.ngay_du_kien_tra ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Ngày dự kiến trả về:</span>
                </div>
                <p className="ml-6">
                  {new Date(transfer.ngay_du_kien_tra).toLocaleDateString("vi-VN")}
                </p>
              </div>
            ) : null}
          </div>
        )}

        <div className="space-y-2">
          <span className="font-medium">Lý do luân chuyển:</span>
          <p className="rounded-md bg-muted p-3 text-sm">{transfer.ly_do_luan_chuyen}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Thời gian thực hiện</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Ngày tạo:</span>
            </div>
            <p className="ml-6">{formatDateTime(transfer.created_at)}</p>
          </div>

          {transfer.ngay_duyet ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Ngày duyệt:</span>
              </div>
              <p className="ml-6">{formatDateTime(transfer.ngay_duyet)}</p>
            </div>
          ) : null}

          {transfer.ngay_ban_giao ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Ngày bàn giao:</span>
              </div>
              <p className="ml-6">{formatDateTime(transfer.ngay_ban_giao)}</p>
            </div>
          ) : null}

          {transfer.ngay_hoan_thanh ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Ngày hoàn thành:</span>
              </div>
              <p className="ml-6">{formatDateTime(transfer.ngay_hoan_thanh)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Người liên quan</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {transfer.nguoi_yeu_cau ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Người yêu cầu:</span>
              </div>
              <p className="ml-6">{transfer.nguoi_yeu_cau.full_name}</p>
            </div>
          ) : null}

          {transfer.nguoi_duyet ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Người duyệt:</span>
              </div>
              <p className="ml-6">{transfer.nguoi_duyet.full_name}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
