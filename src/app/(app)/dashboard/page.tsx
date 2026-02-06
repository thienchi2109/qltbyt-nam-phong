"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Plus, QrCode, ClipboardList, Sparkles, Wrench } from "lucide-react"
import { useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalendarWidget } from "@/components/ui/calendar-widget"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs"
import { QRScannerErrorBoundary } from "@/components/qr-scanner-error-boundary"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { isRegionalLeaderRole } from "@/lib/rbac"
import type { Equipment } from "@/lib/data"
// import { useDashboardRealtimeSync } from "@/hooks/use-realtime-sync"

// Dynamic imports for QR scanner components (avoid SSR issues)
const QRScannerCamera = dynamic(
  () => import("@/components/qr-scanner-camera").then(mod => ({ default: mod.QRScannerCamera })),
  { 
    ssr: false,
    loading: () => <div className="fixed inset-0 z-50 bg-black flex items-center justify-center text-white">Đang tải camera...</div>
  }
)

const QRActionSheet = dynamic(
  () => import("@/components/qr-action-sheet").then(mod => ({ default: mod.QRActionSheet })),
  { ssr: false }
)

const EditEquipmentDialog = dynamic(
  () => import("@/components/edit-equipment-dialog").then(mod => ({ default: mod.EditEquipmentDialog })),
  { ssr: false }
)

export default function Dashboard() {
  // useDashboardRealtimeSync()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user

  // QR Scanner state
  const [isCameraActive, setIsCameraActive] = React.useState(false)
  const [scannedCode, setScannedCode] = React.useState<string>("")
  const [showActionSheet, setShowActionSheet] = React.useState(false)
  const [editingEquipment, setEditingEquipment] = React.useState<Equipment | null>(null)

  // Check if user is regional leader
  const isRegionalLeader = isRegionalLeaderRole(user?.role)

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Chào buổi sáng"
    if (hour < 18) return "Chào buổi chiều"
    return "Chào buổi tối"
  }

  // QR Scanner handlers
  const handleStartScanning = () => {
    if (typeof window === "undefined") {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Chức năng này chỉ hoạt động trên trình duyệt."
      })
      return
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: "destructive",
        title: "Camera không được hỗ trợ",
        description: "Trình duyệt của bạn không hỗ trợ chức năng camera."
      })
      return
    }

    setIsCameraActive(true)
  }

  const handleScanSuccess = (result: string) => {
    setScannedCode(result)
    setIsCameraActive(false)
    setShowActionSheet(true)
    
    toast({
      title: "Quét thành công!",
      description: `Đã quét mã: ${result}`,
      duration: 3000,
    })
  }

  const handleCloseCamera = () => {
    setIsCameraActive(false)
  }

  const handleAction = (action: string, equipment?: Equipment) => {
    setShowActionSheet(false)

    switch (action) {
      case 'usage-log':
        if (equipment) {
          router.push(`/equipment?highlight=${equipment.id}&tab=usage`)
        }
        break
        
      case 'view-details':
        if (equipment) {
          router.push(`/equipment?highlight=${equipment.id}`)
        }
        break
        
      case 'view-history':
        if (equipment) {
          router.push(`/equipment?highlight=${equipment.id}&tab=history`)
        }
        break
        
      case 'create-repair':
        if (equipment) {
          router.push(`/repair-requests?action=create&equipmentId=${equipment.id}`)
        }
        break
        
      case 'update-status':
        if (equipment) {
          setEditingEquipment(equipment)
        }
        break
        
      default:
        toast({
          variant: "destructive",
          title: "Hành động không hợp lệ",
          description: "Vui lòng thử lại."
        })
    }
  }

  const handleCloseActionSheet = () => {
    setShowActionSheet(false)
    setScannedCode("")
  }

  return (
    <>
      {/* QR Camera Scanner */}
      {isCameraActive && (
        <QRScannerErrorBoundary onReset={() => setIsCameraActive(false)}>
          <QRScannerCamera
            onScanSuccess={handleScanSuccess}
            onClose={handleCloseCamera}
            isActive={isCameraActive}
          />
        </QRScannerErrorBoundary>
      )}

      {/* QR Action Sheet */}
      {showActionSheet && scannedCode && (
        <QRActionSheet
          qrCode={scannedCode}
          onClose={handleCloseActionSheet}
          onAction={handleAction}
        />
      )}

      {/* Edit Equipment Dialog */}
      {editingEquipment && (
        <EditEquipmentDialog
          open={!!editingEquipment}
          onOpenChange={(open) => {
            if (!open) {
              setEditingEquipment(null)
            }
          }}
          onSuccess={() => {
            setEditingEquipment(null)
            toast({
              title: "Thành công",
              description: "Đã cập nhật thông tin thiết bị."
            })
          }}
          equipment={editingEquipment}
        />
      )}

      {/* Welcome Banner */}
      <Card data-tour="welcome-banner" className="overflow-hidden border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] bg-white rounded-3xl">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                  {getGreeting()}, {user?.full_name || user?.username}!
                </h1>
              </div>
              <p className="text-slate-500 text-sm md:text-base">
                Chào mừng bạn đến với Hệ thống Quản lý Thiết bị Y tế
              </p>
            </div>
            <div className="hidden md:block">
              <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-primary/40" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div data-tour="kpi-cards" className="mt-6 md:mt-8">
        <KPICards />
      </div>


      {/* Quick Actions Section - Native App Style */}
      <div data-tour="quick-actions" className="md:mt-6 md:space-y-5">
        <div className="mb-4 px-1">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Thao tác nhanh</h2>
        </div>
        <div className={cn(
          "grid gap-4 md:gap-6",
          isRegionalLeader ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"
        )}>
          {/* Quick Actions: Restricted for regional leaders */}
          {!isRegionalLeader && (
            <>
              {/* Báo sửa chữa (New) */}
              <Link href="/repair-requests?action=create" className="group">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform group-active:scale-95">
                    <div className="h-11 w-11 md:h-14 md:w-14 rounded-xl bg-red-50 flex items-center justify-center">
                      <Wrench className="h-[26px] w-[26px] md:h-8 md:w-8 text-red-600" />
                    </div>
                  </div>
                  <span className="text-xs md:text-sm font-medium text-slate-700 text-center">Báo sửa chữa</span>
                </div>
              </Link>

              {/* Add Equipment Card */}
              <Link href="/equipment?action=add" className="group">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform group-active:scale-95">
                    <div className="h-11 w-11 md:h-14 md:w-14 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Plus className="h-[26px] w-[26px] md:h-8 md:w-8 text-blue-600" />
                    </div>
                  </div>
                  <span className="text-xs md:text-sm font-medium text-slate-700 text-center">Thêm thiết bị</span>
                </div>
              </Link>

              {/* Create Maintenance Plan Card */}
              <Link href="/maintenance?action=create" className="group">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform group-active:scale-95">
                    <div className="h-11 w-11 md:h-14 md:w-14 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <ClipboardList className="h-[26px] w-[26px] md:h-8 md:w-8 text-emerald-600" />
                    </div>
                  </div>
                  <span className="text-xs md:text-sm font-medium text-slate-700 text-center">Lập kế hoạch</span>
                </div>
              </Link>
            </>
          )}

          {/* QR Scanner Card: Always available - opens scanner directly */}
          <button data-tour="qr-scanner" onClick={handleStartScanning} className="group">
            <div className="flex flex-col items-center gap-3">
              <div className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform group-active:scale-95">
                <div className="h-11 w-11 md:h-14 md:w-14 rounded-xl bg-sky-50 flex items-center justify-center">
                  <QrCode className="h-[26px] w-[26px] md:h-8 md:w-8 text-sky-600" />
                </div>
              </div>
              <span className="text-xs md:text-sm font-medium text-slate-700 text-center">Quét mã QR</span>
            </div>
          </button>
        </div>
      </div>

      {/* Calendar Widget */}
      <div data-tour="calendar-widget" className="grid gap-4 md:gap-8 md:mt-8">
        <CalendarWidget />
      </div>

      {/* Unified Tabbed Dashboard Cards */}
      <div data-tour="dashboard-tabs" className="grid gap-4 md:gap-8 md:mt-8">
        <DashboardTabs />
      </div>
    </>
  )
}
