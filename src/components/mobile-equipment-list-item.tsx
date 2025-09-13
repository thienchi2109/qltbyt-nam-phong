"use client"

import {
  MoreHorizontal,
  Eye,
  Edit,
  Wrench,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { type Equipment } from "@/lib/data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "next-auth/react"
import { MobileUsageActions } from "./mobile-usage-actions"
import { ActiveUsageIndicator } from "./active-usage-indicator"

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

export function MobileEquipmentListItem({
  equipment,
  onShowDetails,
  onEdit,
}: MobileEquipmentListItemProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const user = session?.user as any

  const canEdit = user && (
    user.role === 'admin' ||
    user.role === 'to_qltb' ||
    (user.role === 'qltb_khoa' && user.khoa_phong === equipment.khoa_phong_quan_ly)
  )

  return (
    <Card className="w-full transition-all hover:bg-muted/50">
      <CardContent className="p-0">
        <div 
          className="flex items-start justify-between p-3 cursor-pointer"
          onClick={() => onShowDetails(equipment)}
        >
          <div className="flex-1 space-y-1.5 truncate">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate text-sm">{equipment.ten_thiet_bi}</p>
              <ActiveUsageIndicator equipmentId={equipment.id} />
            </div>
            <p className="text-xs text-muted-foreground">{equipment.ma_thiet_bi}</p>
            <p className="text-xs text-muted-foreground">{equipment.khoa_phong_quan_ly || "N/A"}</p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {equipment.tinh_trang_hien_tai && (
              <Badge variant={getStatusVariant(equipment.tinh_trang_hien_tai)} className="text-xs text-center">
                {equipment.tinh_trang_hien_tai}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Mở menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onShowDetails(equipment)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Xem chi tiết
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onSelect={() => onEdit(equipment)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Sửa thông tin
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => router.push(`/repair-requests?equipmentId=${equipment.id}`)}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Báo sửa chữa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div 
          className="px-3 pb-3"
          onClick={(e) => e.stopPropagation()}
        >
          <MobileUsageActions equipment={equipment} />
        </div>
      </CardContent>
    </Card>
  )
}