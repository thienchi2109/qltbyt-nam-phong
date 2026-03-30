"use client"

import { Wrench, MapPin, Eye, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { type Equipment } from "@/types/database"
import { Card } from "@/components/ui/card"
import { MobileUsageActions } from "./mobile-usage-actions"
import { isEquipmentManagerRole } from "@/lib/rbac"

interface MobileEquipmentListItemProps {
  equipment: Equipment
  onShowDetails: (equipment: Equipment) => void
  onEdit: (equipment: Equipment) => void
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

export function MobileEquipmentListItem({
  equipment,
  onShowDetails,
  onEdit,
}: MobileEquipmentListItemProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user as any

  const canEdit = !!user && (
    isEquipmentManagerRole(user.role) ||
    (user.role === 'qltb_khoa' && user.khoa_phong === equipment.khoa_phong_quan_ly)
  )

  const status = equipment.tinh_trang_hien_tai
  const statusStyle = getStatusStyle(status)
  const outOfService = isOutOfService(status)

  const handleCardClick = () => {
    onShowDetails(equipment)
  }

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
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${statusStyle.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-tight ${statusStyle.text}`}>
                {status}
              </span>
            </div>
          )}
        </div>

        {/* Row 2: Equipment Name */}
        <h3 className="text-[15px] font-bold text-foreground leading-tight">
          {equipment.ten_thiet_bi}
        </h3>

        {/* Row 3: Department + Location */}
        <div className="flex items-center text-xs text-muted-foreground gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {equipment.khoa_phong_quan_ly || "N/A"}
            {equipment.vi_tri_lap_dat && ` • ${equipment.vi_tri_lap_dat}`}
          </span>
        </div>

        {/* Row 4: Action Buttons */}
        <div className="flex gap-2 pt-0.5" onClick={(e) => e.stopPropagation()}>
          {renderActionButtons(equipment, status, outOfService, router, onShowDetails)}
        </div>
      </div>
    </Card>
  )
}

/**
 * Renders context-aware action buttons based on equipment status:
 * - Hoạt động: "Báo sửa chữa" + "Sử dụng"
 * - Chờ sửa chữa: "Chi tiết sự cố" (prominent) + disabled play
 * - Chờ bảo trì / Chờ hiệu chuẩn: "Lịch sử" + "Sử dụng"
 * - Ngưng sử dụng / Chưa có nhu cầu: "Xem chi tiết" only
 */
function renderActionButtons(
  equipment: Equipment,
  status: Equipment["tinh_trang_hien_tai"],
  outOfService: boolean,
  router: ReturnType<typeof useRouter>,
  onShowDetails: (equipment: Equipment) => void,
) {
  const buttonBase = "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all active:scale-95 duration-150"
  const ghostBtn = `${buttonBase} bg-muted/60 hover:bg-muted text-muted-foreground`
  const primaryBtn = `${buttonBase} bg-primary text-primary-foreground hover:opacity-90 shadow-sm`

  // Ngưng sử dụng → "Xem chi tiết" only
  if (outOfService) {
    return (
      <button
        className={ghostBtn}
        onClick={() => onShowDetails(equipment)}
      >
        <Eye className="h-3.5 w-3.5" />
        Xem chi tiết
      </button>
    )
  }

  // Chờ sửa chữa → "Chi tiết sự cố" (red) + disabled play
  if (status === "Chờ sửa chữa") {
    return (
      <>
        <button
          className={`${buttonBase} flex-[2] bg-destructive text-destructive-foreground hover:opacity-90`}
          onClick={() => router.push(`/repair-requests?equipmentId=${equipment.id}`)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Chi tiết sự cố
        </button>
        <MobileUsageActions equipment={equipment} className="flex-1 h-auto py-2 text-[11px]" />
      </>
    )
  }

  // Chờ bảo trì / Chờ hiệu chuẩn → "Lịch sử" + "Sử dụng"
  if (status === "Chờ bảo trì" || status === "Chờ hiệu chuẩn/kiểm định") {
    return (
      <>
        <button
          className={ghostBtn}
          onClick={() => onShowDetails(equipment)}
        >
          <Eye className="h-3.5 w-3.5" />
          Xem chi tiết
        </button>
        <MobileUsageActions equipment={equipment} className="flex-1 h-auto py-2 text-[11px]" />
      </>
    )
  }

  // Default (Hoạt động) → "Báo sửa chữa" + "Sử dụng"
  return (
    <>
      <button
        className={ghostBtn}
        onClick={() => router.push(`/repair-requests?equipmentId=${equipment.id}`)}
      >
        <Wrench className="h-3.5 w-3.5" />
        Báo sửa chữa
      </button>
      <MobileUsageActions equipment={equipment} className="flex-1 h-auto py-2 text-[11px]" />
    </>
  )
}
