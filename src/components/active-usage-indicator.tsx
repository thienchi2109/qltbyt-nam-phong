"use client"

import React from "react"
import { format, differenceInMinutes } from "date-fns"
import { vi } from "date-fns/locale"
import { Clock, User, Play } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { type UsageLog } from "@/types/database"

interface ActiveUsageIndicatorProps {
  equipmentId: number
  className?: string
  showDetails?: boolean
}

export function ActiveUsageIndicator({ 
  equipmentId, 
  className = "",
  showDetails = false 
}: ActiveUsageIndicatorProps) {
  const { data: activeUsageLogs } = useActiveUsageLogs()
  
  const activeSession = activeUsageLogs?.find(
    log => log.thiet_bi_id === equipmentId && log.trang_thai === 'dang_su_dung'
  )

  if (!activeSession) {
    return null
  }

  const usageDuration = differenceInMinutes(new Date(), new Date(activeSession.thoi_gian_bat_dau))
  
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  if (showDetails) {
    return (
      <div className={`flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg ${className}`}>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <Play className="h-4 w-4 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-3 w-3 text-green-600" />
            <span className="font-medium text-green-800 truncate">
              {activeSession.nguoi_su_dung?.full_name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-600">
            <Clock className="h-3 w-3" />
            <span>
              {format(new Date(activeSession.thoi_gian_bat_dau), "HH:mm", { locale: vi })} 
              ({formatDuration(usageDuration)})
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="default" 
            className={`bg-green-500 hover:bg-green-600 gap-1 ${className}`}
          >
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Đang sử dụng
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-3 w-3" />
              <span className="font-medium">{activeSession.nguoi_su_dung?.full_name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3 w-3" />
              <span>
                Bắt đầu: {format(new Date(activeSession.thoi_gian_bat_dau), "HH:mm dd/MM", { locale: vi })}
              </span>
            </div>
            <div className="text-xs">
              Thời gian: {formatDuration(usageDuration)}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Component for quick usage actions in equipment cards
interface QuickUsageActionsProps {
  equipmentId: number
  onStartUsage?: () => void
  onEndUsage?: () => void
  className?: string
}

export function QuickUsageActions({ 
  equipmentId, 
  onStartUsage, 
  onEndUsage,
  className = "" 
}: QuickUsageActionsProps) {
  const { data: activeUsageLogs } = useActiveUsageLogs()
  
  const activeSession = activeUsageLogs?.find(
    log => log.thiet_bi_id === equipmentId && log.trang_thai === 'dang_su_dung'
  )

  const isInUse = !!activeSession

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {isInUse ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onEndUsage}
          className="h-7 px-2 text-xs gap-1"
        >
          <Play className="h-3 w-3" />
          Kết thúc
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={onStartUsage}
          className="h-7 px-2 text-xs gap-1"
        >
          <Play className="h-3 w-3" />
          Sử dụng
        </Button>
      )}
    </div>
  )
}
