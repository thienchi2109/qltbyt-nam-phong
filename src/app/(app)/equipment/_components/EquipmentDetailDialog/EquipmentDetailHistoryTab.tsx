/**
 * History tab component for EquipmentDetailDialog
 * Displays equipment maintenance, repair, and transfer history in a timeline
 * @module equipment/_components/EquipmentDetailDialog/EquipmentDetailHistoryTab
 */

import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import type { HistoryItem } from "@/app/(app)/equipment/types"
import { getHistoryIcon } from "./EquipmentDetailTypes"

/**
 * Formats transfer type code to display label
 */
function formatTransferType(loaiHinh: string): string {
  switch (loaiHinh) {
    case "noi_bo":
      return "Nội bộ"
    case "ben_ngoai":
      return "Bên ngoài"
    default:
      return "Thanh lý"
  }
}

interface EquipmentDetailHistoryTabProps {
  history: HistoryItem[]
  isLoading: boolean
}

export function EquipmentDetailHistoryTab({
  history,
  isLoading,
}: EquipmentDetailHistoryTabProps) {
  if (isLoading) {
    return (
      <ScrollArea className="h-full pr-4 py-4">
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </ScrollArea>
    )
  }

  if (history.length === 0) {
    return (
      <ScrollArea className="h-full pr-4 py-4">
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
          <p className="font-semibold">Chưa có lịch sử</p>
          <p className="text-sm">Mọi hoạt động sửa chữa, bảo trì sẽ được ghi lại tại đây.</p>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-full pr-4 py-4">
      <div className="relative pl-6">
        {/* Timeline line */}
        <div className="absolute left-0 top-0 h-full w-0.5 bg-border -translate-x-1/2 ml-3"></div>

        {history.map((item) => (
          <div key={item.id} className="relative mb-8 last:mb-0">
            {/* Timeline dot */}
            <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-primary ring-4 ring-background -translate-x-1/2 ml-3"></div>

            <div className="pl-2">
              {/* Event header with icon */}
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                  {getHistoryIcon(item.loai_su_kien)}
                </div>
                <div>
                  <p className="font-semibold">{item.loai_su_kien}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(item.ngay_thuc_hien), "dd/MM/yyyy HH:mm", { locale: vi })}
                  </p>
                </div>
              </div>

              {/* Event details */}
              <div className="mt-2 ml-10 p-3 rounded-md bg-muted/50 border">
                <p className="text-sm font-medium">{item.mo_ta}</p>

                {/* Repair details */}
                {item.chi_tiet?.mo_ta_su_co && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Sự cố: {item.chi_tiet.mo_ta_su_co}
                  </p>
                )}
                {item.chi_tiet?.hang_muc_sua_chua && (
                  <p className="text-sm text-muted-foreground">
                    Hạng mục: {item.chi_tiet.hang_muc_sua_chua}
                  </p>
                )}
                {item.chi_tiet?.nguoi_yeu_cau && (
                  <p className="text-sm text-muted-foreground">
                    Người yêu cầu: {item.chi_tiet.nguoi_yeu_cau}
                  </p>
                )}

                {/* Maintenance details */}
                {item.chi_tiet?.ten_ke_hoach && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Kế hoạch: {item.chi_tiet.ten_ke_hoach}
                  </p>
                )}
                {item.chi_tiet?.thang && item.chi_tiet?.nam && (
                  <p className="text-sm text-muted-foreground">
                    Tháng: {item.chi_tiet.thang}/{item.chi_tiet.nam}
                  </p>
                )}

                {/* Transfer details */}
                {item.chi_tiet?.ma_yeu_cau && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Mã yêu cầu: {item.chi_tiet.ma_yeu_cau}
                  </p>
                )}
                {item.chi_tiet?.loai_hinh && (
                  <p className="text-sm text-muted-foreground">
                    Loại hình: {formatTransferType(item.chi_tiet.loai_hinh)}
                  </p>
                )}
                {item.chi_tiet?.khoa_phong_hien_tai && item.chi_tiet?.khoa_phong_nhan && (
                  <p className="text-sm text-muted-foreground">
                    Từ: {item.chi_tiet.khoa_phong_hien_tai} → {item.chi_tiet.khoa_phong_nhan}
                  </p>
                )}
                {item.chi_tiet?.don_vi_nhan && (
                  <p className="text-sm text-muted-foreground">
                    Đơn vị nhận: {item.chi_tiet.don_vi_nhan}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
