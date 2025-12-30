"use client"

import Link from "next/link"
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
import { cn } from "@/lib/utils"
// import { useDashboardRealtimeSync } from "@/hooks/use-realtime-sync"


export default function Dashboard() {
  // useDashboardRealtimeSync()
  const { data: session } = useSession()
  const user = session?.user

  // Check if user is regional leader
  const isRegionalLeader = user?.role === 'regional_leader'

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Chào buổi sáng"
    if (hour < 18) return "Chào buổi chiều"
    return "Chào buổi tối"
  }

  return (
    <>
      {/* Welcome Banner */}
      <Card className="overflow-hidden border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] bg-white rounded-3xl">
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
      <div className="mt-6 md:mt-8">
        <KPICards />
      </div>


      {/* Quick Actions Section - Native App Style */}
      <div className="md:mt-6 md:space-y-5">
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

          {/* QR Scanner Card: Always available */}
          <Link href="/qr-scanner" className="group">
            <div className="flex flex-col items-center gap-3">
              <div className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform group-active:scale-95">
                <div className="h-11 w-11 md:h-14 md:w-14 rounded-xl bg-sky-50 flex items-center justify-center">
                  <QrCode className="h-[26px] w-[26px] md:h-8 md:w-8 text-sky-600" />
                </div>
              </div>
              <span className="text-xs md:text-sm font-medium text-slate-700 text-center">Quét mã QR</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Calendar Widget */}
      <div className="grid gap-4 md:gap-8 md:mt-8">
        <CalendarWidget />
      </div>

      {/* Unified Tabbed Dashboard Cards */}
      <div className="grid gap-4 md:gap-8 md:mt-8">
        <DashboardTabs />
      </div>
    </>
  )
}
