import * as React from "react"
import { format, parseISO } from "date-fns"
import { vi } from 'date-fns/locale'
import { Loader2 } from "lucide-react"

import { MobileCompactCard } from "@/components/shared/MobileCompactCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isEquipmentManagerRole } from "@/lib/rbac"

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

function RepairRequestCardField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-xs font-medium">{value}</span>
    </div>
  )
}

function RepairRequestStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={getStatusVariant(status)} className="text-xs">
      {status}
    </Badge>
  )
}

function getRepairRequestPrimaryAction(
  request: RepairRequestWithEquipment,
  columnOptions: RepairRequestColumnOptions,
) {
  const {
    handleApproveRequest,
    handleCompletion,
    onGenerateSheet,
    user,
    isRegionalLeader,
  } = columnOptions

  if (!user || isRegionalLeader) return null

  const canManage = isEquipmentManagerRole(user.role)
  const buttonClassName = "h-8 flex-1 rounded-lg text-xs font-semibold"

  if (canManage && request.trang_thai === "Chờ xử lý") {
    return (
      <Button
        type="button"
        size="sm"
        className={buttonClassName}
        onClick={() => handleApproveRequest(request)}
      >
        Duyệt
      </Button>
    )
  }

  if (canManage && request.trang_thai === "Đã duyệt") {
    return (
      <Button
        type="button"
        size="sm"
        className={buttonClassName}
        onClick={() => handleCompletion(request, "Hoàn thành")}
      >
        Hoàn thành
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={buttonClassName}
      onClick={() => onGenerateSheet(request)}
    >
      Xem phiếu
    </Button>
  )
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
  const shouldShowRowActions = Boolean(columnOptions.user) && !columnOptions.isRegionalLeader

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
        <MobileCompactCard
          key={request.id}
          title={request.thiet_bi?.ten_thiet_bi || "N/A"}
          subtitle={request.thiet_bi?.ma_thiet_bi || "N/A"}
          TopRightComponent={RepairRequestStatusBadge}
          topRightProps={{ status: request.trang_thai }}
          activationLabel={`Xem yêu cầu sửa chữa ${request.thiet_bi?.ten_thiet_bi || "N/A"}`}
          onActivate={() => setRequestToView(request)}
          primaryAction={getRepairRequestPrimaryAction(request, columnOptions)}
          actions={
            shouldShowRowActions
              ? <RepairRequestRowActions request={request} options={columnOptions} />
              : undefined
          }
        >
          {request.nguoi_yeu_cau && (
            <RepairRequestCardField label="Người yêu cầu" value={request.nguoi_yeu_cau} />
          )}

          <RepairRequestCardField
            label="Ngày yêu cầu"
            value={format(parseISO(request.ngay_yeu_cau), "dd/MM/yyyy", { locale: vi })}
          />

          {request.ngay_mong_muon_hoan_thanh && (
            <div className="space-y-2">
              <RepairRequestCardField
                label="Ngày mong muốn HT"
                value={format(parseISO(request.ngay_mong_muon_hoan_thanh), "dd/MM/yyyy", { locale: vi })}
              />
              <DaysRemainingBar
                deadline={request.ngay_mong_muon_hoan_thanh}
                status={request.trang_thai}
              />
            </div>
          )}

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Mô tả sự cố:</span>
            <p className="line-clamp-2 text-left text-xs font-medium leading-relaxed">
              {request.mo_ta_su_co}
            </p>
          </div>

          {request.hang_muc_sua_chua && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Hạng mục sửa chữa:</span>
              <p className="line-clamp-2 text-left text-xs font-medium leading-relaxed">
                {request.hang_muc_sua_chua}
              </p>
            </div>
          )}
        </MobileCompactCard>
      ))}
    </div>
  )
}
