"use client"

import Link from "next/link"
import { Plus, QrCode, ClipboardList, Sparkles } from "lucide-react"
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
  const user = session?.user as any
  
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
      <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-cyan-50 via-teal-50/80 to-blue-50">
        <CardContent className="p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                  {getGreeting()}, {user?.full_name || user?.username}!
                </h1>
              </div>
              <p className="text-slate-600 text-sm md:text-base">
                Chào mừng bạn đến với Hệ thống Quản lý Thiết bị Y tế
              </p>
            </div>
            <div className="hidden md:block">
              <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="h-10 w-10 text-yellow-200" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* KPI Cards */}
      <div className="mt-6 md:mt-8">
        <KPICards />
      </div>

      {/* Quick Actions Section - Elegant Cards */}
      <div className="md:mt-6 md:space-y-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Thao tác nhanh</h2>
          <p className="text-sm text-muted-foreground">Truy cập nhanh các chức năng chính của hệ thống</p>
        </div>
        <div className={cn(
          "grid gap-4 md:gap-6",
          isRegionalLeader ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-3"
        )}>
          {/* Quick Actions: Restricted for regional leaders */}
          {!isRegionalLeader && (
            <>
              {/* Add Equipment Card */}
              <Link href="/equipment?action=add" className="group">
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-none bg-gradient-to-br from-blue-100 via-blue-50 to-white overflow-hidden">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-3">
                      <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Plus className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1 sm:flex-none text-left sm:text-center">
                        <h3 className="font-semibold text-blue-900 mb-1">Thêm thiết bị</h3>
                        <p className="text-xs text-blue-600/70">Đăng ký thiết bị mới</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* Create Maintenance Plan Card */}
              <Link href="/maintenance?action=create" className="group">
                <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-none bg-gradient-to-br from-emerald-100 via-emerald-50 to-white overflow-hidden">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-3">
                      <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <ClipboardList className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex-1 sm:flex-none text-left sm:text-center">
                        <h3 className="font-semibold text-emerald-900 mb-1">Lập kế hoạch</h3>
                        <p className="text-xs text-emerald-600/70">Kế hoạch bảo trì mới</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
          
          {/* QR Scanner Card: Always available */}
          <Link href="/qr-scanner" className={cn("group", isRegionalLeader && "sm:col-start-2")}>
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-none bg-gradient-to-br from-sky-100 via-sky-50 to-white overflow-hidden">
              <CardContent className="p-5 sm:p-6">
                <div className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-3">
                  <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <QrCode className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1 sm:flex-none text-left sm:text-center">
                    <h3 className="font-semibold text-sky-900 mb-1">Quét mã QR</h3>
                    <p className="text-xs text-sky-600/70">Tra cứu thiết bị nhanh</p>
                  </div>
                </div>
              </CardContent>
            </Card>
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
