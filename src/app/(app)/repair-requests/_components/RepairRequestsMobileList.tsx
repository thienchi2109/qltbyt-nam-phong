import * as React from "react"
import { format, parseISO } from "date-fns"
import { vi } from "date-fns/locale"
import { Loader2 } from "lucide-react"

import { MobileCompactCard } from "@/components/shared/MobileCompactCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isEquipmentManagerRole } from "@/lib/rbac"

import type { RepairRequestWithEquipment } from "../types"
import { getStatusVariant } from "../utils"
import { RepairRequestRowActions, type RepairRequestColumnOptions } from "./RepairRequestsColumns"

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

function RepairRequestCardField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-x-4 gap-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium leading-snug">{value}</span>
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
  columnOptions: RepairRequestColumnOptions
) {
  const { handleApproveRequest, handleCompletion, onGenerateSheet, user, isRegionalLeader } =
    columnOptions

  if (!user || isRegionalLeader) return null

  const canManage = isEquipmentManagerRole(user.role)
  const buttonClassName = "h-12 flex-1 rounded-lg text-sm font-semibold"

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
    return <div className="text-center py-6 text-muted-foreground text-sm">Không có kết quả.</div>
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const requester = request.nguoi_yeu_cau || request.thiet_bi?.khoa_phong_quan_ly || "N/A"

        return (
          <div key={request.id} data-testid={`repair-mobile-card-${request.id}`}>
            <MobileCompactCard
              title={request.thiet_bi?.ten_thiet_bi || "N/A"}
              subtitle={request.thiet_bi?.ma_thiet_bi || "N/A"}
              TopRightComponent={RepairRequestStatusBadge}
              topRightProps={{ status: request.trang_thai }}
              activationLabel={`Xem yêu cầu sửa chữa ${request.thiet_bi?.ten_thiet_bi || "N/A"}`}
              onActivate={() => setRequestToView(request)}
              primaryAction={getRepairRequestPrimaryAction(request, columnOptions)}
              actions={
                shouldShowRowActions ? (
                  <RepairRequestRowActions request={request} options={columnOptions} />
                ) : undefined
              }
              className="rounded-2xl border bg-card shadow-sm hover:shadow-sm"
            >
              <div className="space-y-3">
                <div className="grid gap-y-3">
                  <RepairRequestCardField label="Người yêu cầu" value={requester} />
                  <RepairRequestCardField
                    label="Ngày yêu cầu"
                    value={format(parseISO(request.ngay_yeu_cau), "dd/MM/yyyy", { locale: vi })}
                  />
                </div>

                <div className="rounded-lg border bg-muted/40 p-3">
                  <span className="text-xs text-muted-foreground">Mô tả sự cố:</span>
                  <p className="mt-1 line-clamp-3 text-left text-sm font-medium leading-relaxed">
                    {request.mo_ta_su_co}
                  </p>
                </div>
              </div>
            </MobileCompactCard>
          </div>
        )
      })}
    </div>
  )
}
