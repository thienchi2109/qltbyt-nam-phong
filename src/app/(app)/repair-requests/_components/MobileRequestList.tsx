import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import type { RepairRequestWithEquipment } from "../types"
import { calculateDaysRemaining, getStatusVariant } from "../utils"

/**
 * Props for the MobileRequestList component.
 */
export interface MobileRequestListProps {
  /** Array of repair requests to display */
  requests: RepairRequestWithEquipment[]
  /** Whether data is currently loading */
  isLoading: boolean
  /** Callback to view request details */
  setRequestToView: (req: RepairRequestWithEquipment | null) => void
  /** Render function for actions dropdown */
  renderActions: (req: RepairRequestWithEquipment) => React.ReactNode
}

/**
 * Mobile card view for repair requests.
 * Displays requests in a card layout optimized for mobile screens.
 */
export function MobileRequestList({
  requests,
  isLoading,
  setRequestToView,
  renderActions
}: MobileRequestListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center gap-2 py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Đang tải...</span>
      </div>
    )
  }

  if (!requests.length) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        Không có kết quả.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <Card
          key={request.id}
          className="mobile-repair-card cursor-pointer hover:bg-muted/50"
          onClick={() => setRequestToView(request)}
        >
          <CardHeader className="mobile-repair-card-header flex flex-row items-start justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <CardTitle className="mobile-repair-card-title truncate line-clamp-1">
                {request.thiet_bi?.ten_thiet_bi || 'N/A'}
              </CardTitle>
              <CardDescription className="mobile-repair-card-description truncate">
                {request.thiet_bi?.ma_thiet_bi || 'N/A'}
              </CardDescription>
            </div>
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {renderActions(request)}
            </div>
          </CardHeader>
          <CardContent className="mobile-repair-card-content">
            {/* Người yêu cầu */}
            {request.nguoi_yeu_cau && (
              <div className="mobile-repair-card-field">
                <span className="mobile-repair-card-label">Người yêu cầu</span>
                <span className="mobile-repair-card-value">{request.nguoi_yeu_cau}</span>
              </div>
            )}

            {/* Ngày yêu cầu */}
            <div className="mobile-repair-card-field">
              <span className="mobile-repair-card-label">Ngày yêu cầu</span>
              <span className="mobile-repair-card-value">
                {format(parseISO(request.ngay_yeu_cau), 'dd/MM/yyyy', { locale: vi })}
              </span>
            </div>

            {/* Ngày mong muốn hoàn thành */}
            {request.ngay_mong_muon_hoan_thanh && (
              <div className="space-y-2">
                <div className="mobile-repair-card-field">
                  <span className="mobile-repair-card-label">Ngày mong muốn HT</span>
                  <span className="mobile-repair-card-value">
                    {format(parseISO(request.ngay_mong_muon_hoan_thanh), 'dd/MM/yyyy', { locale: vi })}
                  </span>
                </div>
                {(() => {
                  // Chỉ hiển thị progress bar cho yêu cầu chưa hoàn thành
                  const isCompleted = request.trang_thai === 'Hoàn thành' || request.trang_thai === 'Không HT';
                  const daysInfo = !isCompleted ? calculateDaysRemaining(request.ngay_mong_muon_hoan_thanh) : null;
                  return daysInfo && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${daysInfo.color} transition-all duration-300`}
                          style={{
                            width: daysInfo.days > 0
                              ? `${Math.min(100, Math.max(10, (daysInfo.days / 14) * 100))}%`
                              : '100%'
                          }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${daysInfo.status === 'success' ? 'text-green-600' :
                        daysInfo.status === 'warning' ? 'text-orange-600' : 'text-red-600'
                        }`}>
                        {daysInfo.text}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Trạng thái */}
            <div className="mobile-repair-card-field">
              <span className="mobile-repair-card-label">Trạng thái</span>
              <Badge variant={getStatusVariant(request.trang_thai)} className="text-xs">
                {request.trang_thai}
              </Badge>
            </div>

            {/* Mô tả sự cố */}
            <div className="space-y-1">
              <span className="mobile-repair-card-label">Mô tả sự cố:</span>
              <p className="mobile-repair-card-value text-left text-xs leading-relaxed line-clamp-2">{request.mo_ta_su_co}</p>
            </div>

            {/* Hạng mục sửa chữa (optional) */}
            {request.hang_muc_sua_chua && (
              <div className="space-y-1">
                <span className="mobile-repair-card-label">Hạng mục sửa chữa:</span>
                <p className="mobile-repair-card-value text-left text-xs leading-relaxed line-clamp-2">{request.hang_muc_sua_chua}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
