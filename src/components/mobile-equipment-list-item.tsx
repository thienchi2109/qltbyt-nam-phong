"use client"

import * as React from "react"
import { Wrench, MapPin, Eye, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

import { type Equipment } from "@/types/database"
import { LinkedRequestRowIndicator } from "@/components/equipment-linked-request"
import { MobileCompactCard } from "@/components/shared/MobileCompactCard"
import {
  buildRepairRequestCreateIntentHref,
  buildRepairRequestsByEquipmentHref,
} from "@/lib/repair-request-deep-link"
import { MobileUsageActions } from "./mobile-usage-actions"
import { getEquipmentStatusMetadata, type EquipmentStatusRow } from "@/lib/equipment-status"

interface MobileEquipmentListItemProps {
  equipment: Equipment
  onShowDetails: (equipment: Equipment) => void
  statusCatalog: {
    data?: readonly EquipmentStatusRow[]
    isSuccess: boolean
    fetchStatus: string
    refetch: () => unknown
  }
}

interface MobileEquipmentActionButtonsProps {
  equipment: Equipment
  status: Equipment["tinh_trang_hien_tai"]
  outOfService: boolean
  startDisabled: boolean
  onCreateRepairRequest: (equipmentId: number) => void
  onViewRepairDetails: (equipmentId: number) => void
  onShowDetails: (equipment: Equipment) => void
  onOpenLogbook: (equipmentId: number) => void
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
    case "Thanh lý nội bộ":
      return { dot: "bg-white", text: "text-white", bg: "bg-gray-800" }
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

interface EquipmentCardMetaProps {
  equipment: Equipment
}

function EquipmentCardMeta({ equipment }: EquipmentCardMetaProps) {
  return (
    <div className="flex items-center gap-1.5">
      <MapPin className="size-3.5 shrink-0" />
      <span className="truncate">
        {equipment.khoa_phong_quan_ly || "N/A"}
        {equipment.vi_tri_lap_dat && ` • ${equipment.vi_tri_lap_dat}`}
      </span>
    </div>
  )
}

interface EquipmentCardStatusProps {
  equipment: Equipment
  status: Equipment["tinh_trang_hien_tai"]
  statusStyle: ReturnType<typeof getStatusStyle>
}

function EquipmentCardStatus({ equipment, status, statusStyle }: EquipmentCardStatusProps) {
  if (!status) return null

  return (
    <>
      <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 ${statusStyle.bg}`}>
        <span className={`size-1.5 rounded-full ${statusStyle.dot}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-tight ${statusStyle.text}`}>
          {status}
        </span>
      </div>
      <LinkedRequestRowIndicator equipment={equipment} />
    </>
  )
}

/** Renders a compact mobile equipment card with status-aware actions. */
export function MobileEquipmentListItem({
  equipment,
  onShowDetails,
  statusCatalog,
}: MobileEquipmentListItemProps) {
  const { push } = useRouter()

  const status = equipment.tinh_trang_hien_tai
  const statusStyle = getStatusStyle(status)
  const outOfService = isOutOfService(status)
  const metadataReady =
    statusCatalog.isSuccess && statusCatalog.fetchStatus === "idle" && !!statusCatalog.data
  const startDisabled =
    !metadataReady ||
    !!getEquipmentStatusMetadata(statusCatalog.data ?? [], status ?? "")?.blocks_operational_actions

  const handleCreateRepairRequest = React.useCallback(
    (equipmentId: number) => {
      if (startDisabled) return
      push(buildRepairRequestCreateIntentHref(equipmentId))
    },
    [push, startDisabled]
  )

  const handleViewRepairDetails = React.useCallback(
    (equipmentId: number) => {
      push(buildRepairRequestsByEquipmentHref(equipmentId))
    },
    [push]
  )

  return (
    <MobileCompactCard
      eyebrow={equipment.ma_thiet_bi}
      title={equipment.ten_thiet_bi}
      MetaComponent={EquipmentCardMeta}
      metaProps={{ equipment }}
      TopRightComponent={EquipmentCardStatus}
      topRightProps={{ equipment, status, statusStyle }}
      activationLabel={`Thiết bị: ${equipment.ten_thiet_bi}`}
      onActivate={() => onShowDetails(equipment)}
      className={outOfService ? "opacity-70" : undefined}
      actions={
        <>
          {!metadataReady && (
            <div className="text-sm text-muted-foreground">
              Chưa tải được danh mục tình trạng.
              <button type="button" onClick={() => void statusCatalog.refetch()}>
                Thử lại
              </button>
            </div>
          )}
          <MobileEquipmentActionButtons
            equipment={equipment}
            status={status}
            outOfService={outOfService}
            startDisabled={startDisabled}
            onCreateRepairRequest={handleCreateRepairRequest}
            onViewRepairDetails={handleViewRepairDetails}
            onOpenLogbook={(id) => push(`/temperature-monitoring?equipment=${id}`)}
            onShowDetails={onShowDetails}
          />
        </>
      }
    />
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
  startDisabled,
  onCreateRepairRequest,
  onViewRepairDetails,
  onShowDetails,
  onOpenLogbook,
}: MobileEquipmentActionButtonsProps) {
  const compact = equipment.temperature_monitoring_enabled === true
  const repair = status === "Chờ sửa chữa"
  const details = outOfService || status === "Chờ bảo trì" || status === "Chờ hiệu chuẩn/kiểm định"
  let actionLabel = compact ? "Sửa chữa" : "Báo sửa chữa"
  let ActionIcon = Wrench
  const onPrimaryAction = () => {
    if (repair) onViewRepairDetails(equipment.id)
    else if (details) onShowDetails(equipment)
    else onCreateRepairRequest(equipment.id)
  }
  if (repair) {
    actionLabel = "Chi tiết sự cố"
    ActionIcon = AlertTriangle
  } else if (details) {
    actionLabel = "Xem chi tiết"
    ActionIcon = Eye
  }
  const buttonBase = `flex-1 flex min-w-0 items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95 duration-150 ${compact ? "min-h-11 px-1 whitespace-normal" : ""}`
  return (
    <fieldset data-mobile-equipment-actions className="flex min-w-0 flex-1 gap-2 border-0 p-0">
      <legend className="sr-only">{`Hành động cho ${equipment.ten_thiet_bi}`}</legend>
      <button
        type="button"
        className={`${buttonBase} ${repair ? `${!compact ? "flex-[2] " : ""}bg-destructive text-destructive-foreground hover:opacity-90` : "bg-muted/60 hover:bg-muted text-muted-foreground"}`}
        aria-label={!repair && !details ? "Báo sửa chữa" : undefined}
        disabled={!repair && !details && startDisabled}
        onClick={onPrimaryAction}
      >
        {!compact && <ActionIcon className="size-3.5" />}
        {actionLabel}
      </button>
      {!outOfService && (
        <MobileUsageActions
          equipment={equipment}
          startDisabled={startDisabled}
          className={
            compact
              ? "flex-auto min-w-0 min-h-11 h-auto px-1 py-2 text-[11px] whitespace-normal [&_svg]:hidden [&_.animate-pulse]:hidden"
              : "flex-1 h-auto py-2 text-[11px]"
          }
        />
      )}
      {compact && (
        <button
          type="button"
          className={`${buttonBase} bg-muted/60 hover:bg-muted text-muted-foreground`}
          onClick={() => onOpenLogbook(equipment.id)}
        >
          Sổ nhiệt độ
        </button>
      )}
    </fieldset>
  )
}
