"use client"

import {
  ChevronRight,
  Wrench,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { type Equipment } from "@/types/database"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSession } from "next-auth/react"
import { MobileUsageActions } from "./mobile-usage-actions"
import { ActiveUsageIndicator } from "./active-usage-indicator"
import { cn } from "@/lib/utils"

interface MobileEquipmentListItemProps {
  equipment: Equipment
  onShowDetails: (equipment: Equipment) => void
  onEdit: (equipment: Equipment) => void
}

const getStatusVariant = (status: Equipment["tinh_trang_hien_tai"]) => {
  switch (status) {
    case "Hoạt động":
      return "default"
    case "Chờ bảo trì":
    case "Chờ hiệu chuẩn/kiểm định":
      return "secondary"
    case "Chờ sửa chữa":
      return "destructive"
    case "Ngưng sử dụng":
    case "Chưa có nhu cầu sử dụng":
      return "outline"
    default:
      return "outline"
  }
}

const getClassificationBadgeClasses = (classification: string | null | undefined) => {
  if (!classification) return "variant-outline"
  const trimmed = classification.trim().toUpperCase()
  if (trimmed === 'A' || trimmed === 'LOẠI A') {
    return "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] border-[hsl(var(--primary))] border"
  }
  if (trimmed === 'B' || trimmed === 'LOẠI B') {
    return "bg-[hsl(var(--secondary))]/10 text-[hsl(var(--secondary-foreground))] border-[hsl(var(--secondary))] border"
  }
  if (trimmed === 'C' || trimmed === 'LOẠI C') {
    return "bg-[hsl(var(--muted))]/60 text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] border"
  }
  if (trimmed === 'D' || trimmed === 'LOẠI D') {
    return "bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))] border"
  }
  return "variant-outline"
}

export function MobileEquipmentListItem({
  equipment,
  onShowDetails,
  onEdit,
}: MobileEquipmentListItemProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user as any

  const canEdit = user && (
    user.role === 'global' || user.role === 'admin' ||
    user.role === 'to_qltb' ||
    (user.role === 'qltb_khoa' && user.khoa_phong === equipment.khoa_phong_quan_ly)
  )

  const handleCardClick = () => {
    onShowDetails(equipment)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore keyboard events from child elements (buttons, dropdowns, etc.)
    if (e.currentTarget !== e.target) return
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onShowDetails(equipment)
    }
  }

  return (
    <Card 
      className="rounded-xl overflow-hidden transition-all hover:shadow-md cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Thiết bị: ${equipment.ten_thiet_bi}`}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      {/* Card Header - Status & Classification */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          {equipment.tinh_trang_hien_tai && (
            <Badge 
              variant={getStatusVariant(equipment.tinh_trang_hien_tai)} 
              className="relative pl-6"
            >
              <span className="absolute left-2 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-current" />
              {equipment.tinh_trang_hien_tai}
            </Badge>
          )}
          {equipment.phan_loai_theo_nd98 && (
            <Badge className={cn("text-xs font-semibold", getClassificationBadgeClasses(equipment.phan_loai_theo_nd98))}>
              Loại {equipment.phan_loai_theo_nd98.trim().toUpperCase()}
            </Badge>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-4">
        {/* Equipment Name & Code */}
        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <h3 className="text-base font-bold text-foreground leading-snug flex-1">
              {equipment.ten_thiet_bi}
            </h3>
            <ActiveUsageIndicator equipmentId={equipment.id} />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            📋 {equipment.ma_thiet_bi}
          </p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground font-medium mb-1">Khoa/Phòng</div>
            <div className="text-sm text-foreground font-semibold leading-tight truncate">
              {equipment.khoa_phong_quan_ly || "N/A"}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="text-[11px] text-muted-foreground font-medium mb-1">Vị trí</div>
            <div className="text-sm text-foreground font-semibold leading-tight truncate">
              {equipment.vi_tri_lap_dat || "N/A"}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 col-span-2">
            <div className="text-[11px] text-muted-foreground font-medium mb-1">Người sử dụng</div>
            <div className="text-sm text-foreground font-semibold truncate">
              {equipment.nguoi_dang_truc_tiep_quan_ly || "N/A"}
            </div>
          </div>
          {(equipment.model || equipment.serial) && (
            <>
              {equipment.model && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-[11px] text-muted-foreground font-medium mb-1">Model</div>
                  <div className="text-sm text-foreground font-semibold leading-tight truncate">
                    {equipment.model}
                  </div>
                </div>
              )}
              {equipment.serial && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-[11px] text-muted-foreground font-medium mb-1">Serial</div>
                  <div className="text-sm text-foreground font-semibold leading-tight truncate">
                    {equipment.serial}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions Footer */}
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-10 text-sm"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/repair-requests?equipmentId=${equipment.id}`)
              }}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Báo sửa chữa
            </Button>
            <MobileUsageActions equipment={equipment} className="w-full h-10 text-sm" />
          </div>
        </div>
      </div>
    </Card>
  )
}
