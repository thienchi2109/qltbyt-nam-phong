import * as React from "react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import type { RepairRequestWithEquipment } from "../types"
import { getStatusVariant } from "../utils"
import { DaysRemainingBar } from "./DaysRemainingBar"
import {
  RepairRequestRowActions,
  type RepairRequestColumnOptions,
} from "./RepairRequestsColumns"

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
  /** Shared row action options */
  columnOptions: RepairRequestColumnOptions
}

/**
 * Mobile card view for repair requests.
 * Displays requests in a card layout optimized for mobile screens.
 */
export function RepairRequestsMobileList({
  requests,
  isLoading,
  setRequestToView,
  columnOptions,
}: MobileRequestListProps) {
  const stopActionPropagation = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
      event.stopPropagation()
    },
    [],
  )

  if (isLoading) {
    return (
      <div className="flex justify-center items-center gap-2 py-6">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Đang tải…</span>
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
          className="mobile-repair-card relative hover:bg-muted/50"
        >
          <button
            type="button"
            className="block w-full cursor-pointer rounded-lg bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setRequestToView(request)}
            aria-label={`Xem yêu cầu sửa chữa ${request.thiet_bi?.ten_thiet_bi || 'N/A'}`}
          >
          <CardHeader className="mobile-repair-card-header flex flex-row items-start justify-between">
            <div className="flex-1 min-w-0 pr-12">
              <CardTitle className="mobile-repair-card-title truncate line-clamp-1">
                {request.thiet_bi?.ten_thiet_bi || 'N/A'}
              </CardTitle>
              <CardDescription className="mobile-repair-card-description truncate">
                {request.thiet_bi?.ma_thiet_bi || 'N/A'}
              </CardDescription>
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
                <DaysRemainingBar
                  deadline={request.ngay_mong_muon_hoan_thanh}
                  status={request.trang_thai}
                />
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
          </button>
          <div
            className="absolute right-6 top-6 flex-shrink-0"
            onClick={stopActionPropagation}
            onKeyDown={stopActionPropagation}
            role="presentation"
          >
            <RepairRequestRowActions request={request} options={columnOptions} />
          </div>
        </Card>
      ))}
    </div>
  )
}
