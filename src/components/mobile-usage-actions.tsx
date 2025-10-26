"use client"

import React from "react"
import { Play, Square, Clock, User } from "lucide-react"
import { format, differenceInMinutes } from "date-fns"
import { vi } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useActiveUsageLogs } from "@/hooks/use-usage-logs"
import { useSession } from "next-auth/react"
import { StartUsageDialog } from "./start-usage-dialog"
import { EndUsageDialog } from "./end-usage-dialog"

interface EquipmentSlim {
  id: number
  ten_thiet_bi: string
  ma_thiet_bi: string
  tinh_trang_hien_tai?: string | null
  khoa_phong_quan_ly?: string | null
}

interface MobileUsageActionsProps {
  equipment: EquipmentSlim
  className?: string
}

export function MobileUsageActions({ equipment, className = "" }: MobileUsageActionsProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const isRegionalLeader = user?.role === 'regional_leader'
  const userId = React.useMemo(() => {
    const uid = (user?.id as any)
    const n = typeof uid === 'string' ? Number(uid) : uid
    return Number.isFinite(n) ? (n as number) : null
  }, [user?.id])
  const { data: activeUsageLogs } = useActiveUsageLogs()
  const [isStartDialogOpen, setIsStartDialogOpen] = React.useState(false)
  const [isEndDialogOpen, setIsEndDialogOpen] = React.useState(false)
  const [isSheetOpen, setIsSheetOpen] = React.useState(false)

  // Find active usage session for this equipment
  const activeSession = activeUsageLogs?.find(
    log => log.thiet_bi_id === equipment.id && log.trang_thai === 'dang_su_dung'
  )

  // Check if current user is using this equipment
  const isCurrentUserUsing = !!activeSession && (userId != null && activeSession.nguoi_su_dung_id === userId)
  
  // Check if equipment is in use by someone else
  const isInUseByOther = activeSession && !isCurrentUserUsing

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const usageDuration = activeSession 
    ? differenceInMinutes(new Date(), new Date(activeSession.thoi_gian_bat_dau))
    : 0

  const handleStartUsage = () => {
    if (isRegionalLeader) return
    setIsSheetOpen(false)
    setIsStartDialogOpen(true)
  }

  const handleEndUsage = () => {
    if (isRegionalLeader) return
    setIsSheetOpen(false)
    setIsEndDialogOpen(true)
  }

  // Don't show anything if no active session and user can't start
  if (!activeSession && !user) {
    return null
  }

  return (
    <>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant={activeSession ? "default" : "outline"}
            size="sm"
            className={`gap-2 ${className}`}
          >
            {activeSession ? (
              <>
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Đang sử dụng
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Sử dụng
              </>
            )}
          </Button>
        </SheetTrigger>
        
        <SheetContent side="bottom" className="h-auto max-h-[80vh]">
          <SheetHeader>
            <SheetTitle className="text-left">
              {equipment.ten_thiet_bi}
            </SheetTitle>
            <SheetDescription className="text-left">
              Mã thiết bị: {equipment.ma_thiet_bi}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {activeSession ? (
              <div className="space-y-4">
                {/* Active Session Info */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium text-green-800">Đang được sử dụng</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">
                        {activeSession.nguoi_su_dung?.full_name || 'Không xác định'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="text-green-700">
                        Bắt đầu: {format(new Date(activeSession.thoi_gian_bat_dau), "HH:mm dd/MM/yyyy", { locale: vi })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="text-green-700 font-medium">
                        Thời gian: {formatDuration(usageDuration)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {isCurrentUserUsing ? (
                    <Button
                      onClick={handleEndUsage}
                      className="w-full gap-2"
                      size="lg"
                      disabled={isRegionalLeader}
                    >
                      <Square className="h-5 w-5" />
                      Kết thúc sử dụng
                    </Button>
                  ) : (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800 text-center">
                        Thiết bị đang được sử dụng bởi người khác
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Equipment Status */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Tình trạng hiện tại: </span>
                      <span className="font-medium">{equipment.tinh_trang_hien_tai || 'Chưa xác định'}</span>
                    </div>
                    
                    {equipment.khoa_phong_quan_ly && (
                      <div>
                        <span className="text-muted-foreground">Khoa/Phòng: </span>
                        <span>{equipment.khoa_phong_quan_ly}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Start Usage Button */}
                <Button
                  onClick={handleStartUsage}
                  className="w-full gap-2"
                  size="lg"
                  disabled={isRegionalLeader}
                >
                  <Play className="h-5 w-5" />
                  Bắt đầu sử dụng thiết bị
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      <StartUsageDialog
        open={isStartDialogOpen}
        onOpenChange={setIsStartDialogOpen}
        equipment={{
          id: equipment.id,
          ten_thiet_bi: equipment.ten_thiet_bi,
          ma_thiet_bi: equipment.ma_thiet_bi,
          tinh_trang_hien_tai: equipment.tinh_trang_hien_tai ?? undefined,
        }}
      />
      
      <EndUsageDialog
        open={isEndDialogOpen}
        onOpenChange={setIsEndDialogOpen}
        usageLog={activeSession ?? null}
      />
    </>
  )
}
