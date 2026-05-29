"use client"

import * as React from "react"
import { Wrench, MapPin, Eye, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

import { type Equipment } from "@/types/database"
import { LinkedRequestRowIndicator } from "@/components/equipment-linked-request"
import { Card } from "@/components/ui/card"
import {
  buildRepairRequestCreateIntentHref,
  buildRepairRequestsByEquipmentHref,
} from "@/lib/repair-request-deep-link"
import { MobileUsageActions } from "./mobile-usage-actions"

interface MobileEquipmentListItemProps {
  equipment: Equipment
  onShowDetails: (equipment: Equipment) => void
}

interface MobileEquipmentActionButtonsProps {
  equipment: Equipment
  status: Equipment["tinh_trang_hien_tai"]
  outOfService: boolean
  onCreateRepairRequest: (equipmentId: number) => void
  onViewRepairDetails: (equipmentId: number) => void
  onShowDetails: (equipment: Equipment) => void
}

/**
 * Maps equipment status to a color scheme for the compact status indicator.
 * Returns { dot, text, bg } classes for the status pill.
 */
const getStatusStyle = (status: Equipment["tinh_trang_hien_tai"]) => {
  switch (status) {
    case "Hoạt động":
      return { dot: "bg-green-600", text: "text-green-700", bg: "bg-green-50" }
    case "Chờ bảo trì":
    case "Chờ hiệu chuẩn/kiểm định":
      return { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" }
    case "Chờ sửa chữa":
      return { dot: "bg-red-600", text: "text-red-700", bg: "bg-red-50" }
    case "Ngưng sử dụng":
    case "Chưa có nhu cầu sử dụng":
      return { dot: "bg-gray-400", text: "text-gray-500", bg: "bg-gray-100" }
    default:
      return { dot: "bg-gray-400", text: "text-gray-500", bg: "bg-gray-100" }
  }
}

/**
 * Determines whether the equipment is in a non-operational state.
 * Used to render muted card styling and restrict available actions.
 */
const isOutOfService = (status: Equipment["tinh_trang_hien_tai"]) =>
  status === "Ngưng sử dụng" || status === "Chưa có nhu cầu sử dụng"

/** Renders a compact mobile equipment card with status-aware actions. */
export function MobileEquipmentListItem({
  equipment,
  onShowDetails,
}: MobileEquipmentListItemProps) {
  const { push } = useRouter()

  const status = equipment.tinh_trang_hien_tai
  const statusStyle = getStatusStyle(status)
  const outOfService = isOutOfService(status)

  const handleCardClick = (event: React.MouseEvent) => {
    if (event.target instanceof Element && event.target.closest("[data-mobile-equipment-actions]")) {
      return
    }
    onShowDetails(equipment)
  }

  const handleCreateRepairRequest = React.useCallback(
    (equipmentId: number) => {
      push(buildRepairRequestCreateIntentHref(equipmentId))
    },
    [push],
  )

  const handleViewRepairDetails = React.useCallback(
    (equipmentId: number) => {
      push(buildRepairRequestsByEquipmentHref(equipmentId))
    },
    [push],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.currentTarget !== e.target) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onShowDetails(equipment)
    }
  }

  return (
    <Card
      className={`rounded-xl overflow-hidden transition-all hover:shadow-md cursor-pointer ${outOfService ? "opacity-70" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Thiết bị: ${equipment.ten_thiet_bi}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="p-3 space-y-2">
        {/* Row 1: Equipment Code + Status */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
            {equipment.ma_thiet_bi}
          </span>
          {status && (
            <div className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
                <span className={`size-1.5 rounded-full ${statusStyle.dot}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-tight ${statusStyle.text}`}>
                  {status}
                </span>
              </div>
              <LinkedRequestRowIndicator equipment={equipment} />
            </div>
          )}
        </div>

        {/* Row 2: Equipment Name */}
        <h3 className="text-[15px] font-semibold text-foreground leading-tight">
          {equipment.ten_thiet_bi}
        </h3>

        {/* Row 3: Department + Location */}
        <div className="flex items-center text-xs text-muted-foreground gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {equipment.khoa_phong_quan_ly || "N/A"}
            {equipment.vi_tri_lap_dat && ` • ${equipment.vi_tri_lap_dat}`}
          </span>
        </div>

        {/* Row 4: Action Buttons */}
        <MobileEquipmentActionButtons
          equipment={equipment}
          status={status}
          outOfService={outOfService}
          onCreateRepairRequest={handleCreateRepairRequest}
          onViewRepairDetails={handleViewRepairDetails}
          onShowDetails={onShowDetails}
        />
      </div>
    </Card>
  )
}

/**
 * Renders context-aware action buttons based on equipment status:
 * - Hoạt động: "Báo sửa chữa" + "Sử dụng"
 * - Chờ sửa chữa: "Chi tiết sự cố" (prominent) + usage action
 * - Chờ bảo trì / Chờ hiệu chuẩn: "Xem chi tiết" + "Sử dụng"
 * - Ngưng sử dụng / Chưa có nhu cầu: "Xem chi tiết" only
 */
function MobileEquipmentActionButtons({
  equipment,
  status,
  outOfService,
  onCreateRepairRequest,
  onViewRepairDetails,
  onShowDetails,
}: MobileEquipmentActionButtonsProps) {
  const buttonBase = "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95 duration-150"
  const ghostBtn = `${buttonBase} bg-muted/60 hover:bg-muted text-muted-foreground`
  const handleCreateRepairRequestClick = () => {
    onCreateRepairRequest(equipment.id)
  }

  const handleViewRepairDetailsClick = () => {
    onViewRepairDetails(equipment.id)
  }

  // Ngưng sử dụng → "Xem chi tiết" only
  if (outOfService) {
    return (
      <fieldset
        data-mobile-equipment-actions
        className="flex min-w-0 gap-2 border-0 p-0 pt-0.5"
      >
        <legend className="sr-only">{`Hành động cho ${equipment.ten_thiet_bi}`}</legend>
        <button
          type="button"
          className={ghostBtn}
          onClick={() => onShowDetails(equipment)}
        >
          <Eye className="size-3.5" />
          Xem chi tiết
        </button>
      </fieldset>
    )
  }

  // Chờ sửa chữa → "Chi tiết sự cố" (red) + disabled play
  if (status === "Chờ sửa chữa") {
    return (
      <fieldset
        data-mobile-equipment-actions
        className="flex min-w-0 gap-2 border-0 p-0 pt-0.5"
      >
        <legend className="sr-only">{`Hành động cho ${equipment.ten_thiet_bi}`}</legend>
        <button
          type="button"
          className={`${buttonBase} flex-[2] bg-destructive text-destructive-foreground hover:opacity-90`}
          onClick={handleViewRepairDetailsClick}
        >
          <AlertTriangle className="size-3.5" />
          Chi tiết sự cố
        </button>
        <MobileUsageActions equipment={equipment} className="flex-1 h-auto py-2 text-[11px]" />
      </fieldset>
    )
  }

  // Chờ bảo trì / Chờ hiệu chuẩn → "Xem chi tiết" + "Sử dụng"
  if (status === "Chờ bảo trì" || status === "Chờ hiệu chuẩn/kiểm định") {
    return (
      <fieldset
        data-mobile-equipment-actions
        className="flex min-w-0 gap-2 border-0 p-0 pt-0.5"
      >
        <legend className="sr-only">{`Hành động cho ${equipment.ten_thiet_bi}`}</legend>
        <button
          type="button"
          className={ghostBtn}
          onClick={() => onShowDetails(equipment)}
        >
          <Eye className="size-3.5" />
          Xem chi tiết
        </button>
        <MobileUsageActions equipment={equipment} className="flex-1 h-auto py-2 text-[11px]" />
      </fieldset>
    )
  }

  // Default (Hoạt động) → "Báo sửa chữa" + "Sử dụng"
  return (
    <fieldset
      data-mobile-equipment-actions
      className="flex min-w-0 gap-2 border-0 p-0 pt-0.5"
    >
      <legend className="sr-only">{`Hành động cho ${equipment.ten_thiet_bi}`}</legend>
      <button
        type="button"
        className={ghostBtn}
        onClick={handleCreateRepairRequestClick}
      >
        <Wrench className="size-3.5" />
        Báo sửa chữa
      </button>
      <MobileUsageActions equipment={equipment} className="flex-1 h-auto py-2 text-[11px]" />
    </fieldset>
  )
}
