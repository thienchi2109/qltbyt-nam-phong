"use client"

import * as React from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Activity, Plus, QrCode, ClipboardList, Wrench } from "lucide-react"
import { useSession } from "next-auth/react"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import { CalendarWidget } from "@/components/ui/calendar-widget"
import { RecentActivitiesCard } from "@/components/dashboard/RecentActivitiesCard"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs"
import { QRScannerErrorBoundary } from "@/components/qr-scanner-error-boundary"
import { useToast } from "@/hooks/use-toast"
import { buildRepairRequestCreateIntentHref } from "@/lib/repair-request-deep-link"
import { cn } from "@/lib/utils"
import { isRegionalLeaderRole } from "@/lib/rbac"
import type { Equipment } from "@/lib/data"
// import { useDashboardRealtimeSync } from "@/hooks/use-realtime-sync"

// Dynamic imports for QR scanner components (avoid SSR issues)
const QRScannerCamera = dynamic(
  () => import("@/components/qr-scanner-camera").then(mod => ({ default: mod.QRScannerCamera })),
  {
    ssr: false,
    loading: () => <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center text-white">Đang tải camera…</div>
  }
)

const QRActionSheet = dynamic(
  () => import("@/components/qr-action-sheet").then(mod => ({ default: mod.QRActionSheet })),
  { ssr: false }
)


/**
 * Renders the authenticated dashboard overview, quick actions, and QR scan entry points.
 */
export default function Dashboard() {
  // useDashboardRealtimeSync()
  const { push } = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const user = session?.user

  // QR Scanner state
  const [isCameraActive, setIsCameraActive] = React.useState(false)
  const [scannedCode, setScannedCode] = React.useState<string>("")
  const [showActionSheet, setShowActionSheet] = React.useState(false)


  // Check if user is regional leader
  const isRegionalLeader = isRegionalLeaderRole(user?.role)
  const todayLabel = React.useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    []
  )

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
          push(`/equipment?highlight=${equipment.id}&tab=usage`)
        }
        break

      case 'view-details':
      case 'update-status':
        if (equipment) {
          push(`/equipment?highlight=${equipment.id}`)
        }
        break

      case 'view-history':
        if (equipment) {
          push(`/equipment?highlight=${equipment.id}&tab=history`)
        }
        break

      case 'create-repair':
        if (equipment) {
          push(buildRepairRequestCreateIntentHref(equipment.id))
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


      {/* Welcome Banner */}
      <Card
        data-tour="welcome-banner"
        className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-gradient-to-br from-cyan-50 via-white to-teal-50 shadow-[0_18px_45px_rgba(15,118,110,0.14)]"
      >
        <CardContent className="relative min-h-[168px] p-6 md:min-h-[190px] md:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute -left-8 -top-10 size-40 rounded-full bg-cyan-200/35 blur-3xl" />
            <div className="absolute bottom-2 right-8 size-24 rounded-full bg-teal-200/40 blur-2xl" />
            <div className="absolute right-0 top-8 hidden h-24 w-72 rounded-l-full bg-white/45 md:block" />
          </div>
          <div className="relative flex h-full flex-col justify-between gap-8 md:flex-row md:items-center">
            <div className="space-y-3">
              <div className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/10">
                MediAsset Pro
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold leading-tight tracking-normal text-slate-950 md:text-4xl">
                  {getGreeting()},
                  <span className="block text-primary">{user?.full_name || user?.username}</span>
                </h1>
                <p className="text-base font-medium text-slate-700 md:text-lg">
                  {user?.khoa_phong || "Chưa có khoa/phòng"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-6 md:flex-col md:items-end">
              <p className="text-sm font-medium capitalize text-slate-700 md:text-base">
                {todayLabel}
              </p>
              <div className="flex items-center gap-3 text-primary/60">
                <div className="hidden h-px w-20 bg-primary/30 md:block" />
                <Activity className="size-12 md:size-16" strokeWidth={1.5} />
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
      <div
        data-tour="quick-actions"
        className="rounded-[1.75rem] border border-white/75 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] md:mt-6 md:p-6"
      >
        <div className="mb-5 px-1">
          <h2 className="text-xl font-semibold tracking-normal text-slate-950 md:text-2xl">Thao tác nhanh</h2>
        </div>
        <div className={cn(
          "grid gap-x-8 gap-y-6 md:gap-6",
          isRegionalLeader ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 sm:grid-cols-4"
        )}>
          {/* Quick Actions: Restricted for regional leaders */}
          {!isRegionalLeader && (
            <>
              {/* Báo sửa chữa (New) */}
              <Link href={buildRepairRequestCreateIntentHref()} className="group">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex size-[72px] items-center justify-center rounded-3xl bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/70 transition-transform group-active:scale-95 md:size-[88px]">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-red-50 md:size-14">
                      <Wrench className="size-[26px] md:size-8 text-red-600" />
                    </div>
                  </div>
                  <span className="text-center text-sm font-semibold leading-tight text-slate-800">Báo sửa chữa</span>
                </div>
              </Link>

              {/* Add Equipment Card */}
              <Link href="/equipment?action=add" className="group">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex size-[72px] items-center justify-center rounded-3xl bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/70 transition-transform group-active:scale-95 md:size-[88px]">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 md:size-14">
                      <Plus className="size-[26px] md:size-8 text-blue-600" />
                    </div>
                  </div>
                  <span className="text-center text-sm font-semibold leading-tight text-slate-800">Thêm thiết bị</span>
                </div>
              </Link>

              {/* Create Maintenance Plan Card */}
              <Link href="/maintenance?action=create" className="group">
                <div className="flex flex-col items-center gap-3">
                  <div className="flex size-[72px] items-center justify-center rounded-3xl bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/70 transition-transform group-active:scale-95 md:size-[88px]">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 md:size-14">
                      <ClipboardList className="size-[26px] md:size-8 text-emerald-600" />
                    </div>
                  </div>
                  <span className="text-center text-sm font-semibold leading-tight text-slate-800">Lập kế hoạch</span>
                </div>
              </Link>
            </>
          )}

          {/* QR Scanner Card: Always available - opens scanner directly */}
          <button type="button" data-tour="qr-scanner" onClick={handleStartScanning} className="group">
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-[72px] items-center justify-center rounded-3xl bg-white shadow-[0_12px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-200/70 transition-transform group-active:scale-95 md:size-[88px]">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 md:size-14">
                  <QrCode className="size-[26px] md:size-8 text-sky-600" />
                </div>
              </div>
              <span className="text-center text-sm font-semibold leading-tight text-slate-800">Quét mã QR</span>
            </div>
          </button>
        </div>
      </div>

      {/* Calendar + Recent Activities */}
      <div data-tour="calendar-widget" className="grid gap-4 md:gap-8 md:mt-8 xl:grid-cols-2">
        <CalendarWidget />
        <RecentActivitiesCard />
      </div>

      {/* Unified Tabbed Dashboard Cards */}
      <div data-tour="dashboard-tabs" className="grid gap-4 md:gap-8 md:mt-8">
        <DashboardTabs />
      </div>
    </>
  )
}
