/**
 * equipment-actions-menu.tsx
 *
 * Dropdown menu for per-row equipment actions.
 * Includes view details, usage logging, and repair request creation.
 * Handles RBAC-based visibility and disabled states.
 */

"use client"

import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Equipment, UsageLog, SessionUser } from "@/types/database"

export interface EquipmentActionsMenuProps {
  equipment: Equipment
  user: SessionUser | null
  isRegionalLeader: boolean
  activeUsageLogs: UsageLog[] | undefined
  isLoadingActiveUsage: boolean
  onShowDetails: (equipment: Equipment) => void
  onStartUsage: (equipment: Equipment) => void
  onEndUsage: (usageLog: UsageLog) => void
  onCreateRepairRequest: (equipment: Equipment) => void
}

export function EquipmentActionsMenu({
  equipment,
  user,
  isRegionalLeader,
  activeUsageLogs,
  isLoadingActiveUsage,
  onShowDetails,
  onStartUsage,
  onEndUsage,
  onCreateRepairRequest,
}: EquipmentActionsMenuProps) {
  const userId = React.useMemo(() => {
    const uid = user?.id
    const n = typeof uid === 'string' ? Number(uid) : uid
    return Number.isFinite(n) ? (n as number) : null
  }, [user?.id])

  const activeUsageLog = activeUsageLogs?.find(
    (log) => log.thiet_bi_id === equipment.id && log.trang_thai === 'dang_su_dung'
  )

  const isCurrentUserUsing = !!activeUsageLog && userId != null && activeUsageLog.nguoi_su_dung_id === userId
  const startUsageDisabled = isLoadingActiveUsage || !user || !!activeUsageLog || isRegionalLeader

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 w-8 p-0 touch-target-sm md:h-8 md:w-8"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Hành động</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onShowDetails(equipment)}>
          Xem chi tiết
        </DropdownMenuItem>
        {!isCurrentUserUsing && (
          <DropdownMenuItem
            disabled={startUsageDisabled}
            onSelect={() => {
              if (startUsageDisabled) return
              onStartUsage(equipment)
            }}
            title={activeUsageLog ? "Thiết bị đang được sử dụng" : undefined}
          >
            Viết nhật ký SD
          </DropdownMenuItem>
        )}
        {isCurrentUserUsing && (
          <DropdownMenuItem
            onSelect={() => onEndUsage(activeUsageLog as UsageLog)}
          >
            Kết thúc sử dụng
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          disabled={isRegionalLeader}
          onSelect={() => {
            if (isRegionalLeader) return
            onCreateRepairRequest(equipment)
          }}
        >
          Tạo yêu cầu sửa chữa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
