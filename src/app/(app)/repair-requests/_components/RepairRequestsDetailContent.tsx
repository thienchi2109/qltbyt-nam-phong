"use client"

import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import type { RepairRequestWithEquipment } from "../types"
import { getStatusVariant } from "../utils"

interface RepairRequestsDetailContentProps {
  request: RepairRequestWithEquipment
}

export function RepairRequestsDetailContent({ request }: RepairRequestsDetailContentProps) {
  return (
    <div className="space-y-6 py-4">
      {/* Equipment Information */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground border-b pb-2">
          Thông tin thiết bị
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Tên thiết bị</Label>
            <div className="text-sm font-medium">{request.thiet_bi?.ten_thiet_bi || 'N/A'}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Mã thiết bị</Label>
            <div className="text-sm">{request.thiet_bi?.ma_thiet_bi || 'N/A'}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Model</Label>
            <div className="text-sm">{request.thiet_bi?.model || 'N/A'}</div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Serial</Label>
            <div className="text-sm">{request.thiet_bi?.serial || 'N/A'}</div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">Khoa/Phòng quản lý</Label>
            <div className="text-sm">{request.thiet_bi?.khoa_phong_quan_ly || 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Request Information */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground border-b pb-2">
          Thông tin yêu cầu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Trạng thái</Label>
            <Badge variant={getStatusVariant(request.trang_thai)} className="w-fit">
              {request.trang_thai}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Ngày yêu cầu</Label>
            <div className="text-sm">
              {format(parseISO(request.ngay_yeu_cau), 'dd/MM/yyyy HH:mm', { locale: vi })}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Người yêu cầu</Label>
            <div className="text-sm">{request.nguoi_yeu_cau || 'N/A'}</div>
          </div>
          {request.ngay_mong_muon_hoan_thanh && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Ngày mong muốn hoàn thành</Label>
              <div className="text-sm">
                {format(parseISO(request.ngay_mong_muon_hoan_thanh), 'dd/MM/yyyy', { locale: vi })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Mô tả sự cố</Label>
          <div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap break-words">
            {request.mo_ta_su_co}
          </div>
        </div>

        {request.hang_muc_sua_chua && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Hạng mục sửa chữa</Label>
            <div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap break-words">
              {request.hang_muc_sua_chua}
            </div>
          </div>
        )}
      </div>

      {/* Execution Information */}
      {(request.don_vi_thuc_hien || request.ten_don_vi_thue) && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground border-b pb-2">
            Thông tin thực hiện
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {request.don_vi_thuc_hien && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Đơn vị thực hiện</Label>
                <Badge variant="outline" className="w-fit">
                  {request.don_vi_thuc_hien === 'noi_bo' ? 'Nội bộ' : 'Thuê ngoài'}
                </Badge>
              </div>
            )}
            {request.ten_don_vi_thue && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Tên đơn vị thuê</Label>
                <div className="text-sm break-words">{request.ten_don_vi_thue}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Information */}
      {(request.ngay_duyet || request.nguoi_duyet) && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground border-b pb-2">
            Thông tin phê duyệt
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {request.nguoi_duyet && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Người duyệt</Label>
                <div className="text-sm break-words">{request.nguoi_duyet}</div>
              </div>
            )}
            {request.ngay_duyet && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Ngày duyệt</Label>
                <div className="text-sm">
                  {format(parseISO(request.ngay_duyet), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Completion Information */}
      {(request.ngay_hoan_thanh || request.ket_qua_sua_chua || request.ly_do_khong_hoan_thanh || request.nguoi_xac_nhan) && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-foreground border-b pb-2">
            Thông tin hoàn thành
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {request.nguoi_xac_nhan && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Người xác nhận</Label>
                <div className="text-sm break-words">{request.nguoi_xac_nhan}</div>
              </div>
            )}
            {request.ngay_hoan_thanh && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Ngày hoàn thành</Label>
                <div className="text-sm">
                  {format(parseISO(request.ngay_hoan_thanh), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
              </div>
            )}
          </div>

          {request.ket_qua_sua_chua && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Kết quả sửa chữa</Label>
              <div className="text-sm bg-green-50 border border-green-200 p-3 rounded-md whitespace-pre-wrap break-words">
                {request.ket_qua_sua_chua}
              </div>
            </div>
          )}

          {request.ly_do_khong_hoan_thanh && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Lý do không hoàn thành</Label>
              <div className="text-sm bg-red-50 border border-red-200 p-3 rounded-md whitespace-pre-wrap break-words">
                {request.ly_do_khong_hoan_thanh}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
