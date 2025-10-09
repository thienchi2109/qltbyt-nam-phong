"use client"

import Link from "next/link"
import { 
  Plus, 
  QrCode, 
  ClipboardList,
  Activity,
  TrendingUp,
  Users,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  Bell
} from "lucide-react"
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

export default function Dashboard() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isRegionalLeader = user?.role === 'regional_leader'

  return (
    <div className="space-y-6">
      {/* Welcome Section with Gradient Background */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 rounded-2xl p-8 shadow-lg">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-3xl" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-400/20 rounded-full blur-3xl" />
        
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Xin chào, {user?.name || 'User'} 👋
            </h1>
            <p className="mt-2 text-blue-100">
              Đây là tổng quan hoạt động của hệ thống hôm nay
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/20"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-white/20 backdrop-blur-md hover:bg-white/30 text-white border border-white/20"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Enhanced KPI Cards with Vibrant Gradients */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Equipment Card */}
        <Card className="group bg-gradient-to-br from-blue-500 to-cyan-400 border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/20">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-white bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">
                <ArrowUpRight className="h-3 w-3" />
                +12%
              </span>
            </div>
            <CardTitle className="text-3xl font-bold text-white mt-4">
              146
            </CardTitle>
            <CardDescription className="text-sm text-blue-50 font-medium">
              Tổng số thiết bị
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-blue-100">
              Đang quản lý tích cực ✨
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Required Card */}
        <Card className="group bg-gradient-to-br from-amber-500 to-orange-400 border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/20">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-white bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">
                <TrendingUp className="h-3 w-3" />
                0%
              </span>
            </div>
            <CardTitle className="text-3xl font-bold text-white mt-4">
              0
            </CardTitle>
            <CardDescription className="text-sm text-amber-50 font-medium">
              Cần bảo trì/hiệu chuẩn
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-amber-100">
              Tất cả đã được kiểm tra ✅
            </div>
          </CardContent>
        </Card>

        {/* Repair Requests Card */}
        <Card className="group bg-gradient-to-br from-rose-500 to-pink-500 border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/20">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-white bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">
                <ArrowDownRight className="h-3 w-3" />
                -100%
              </span>
            </div>
            <CardTitle className="text-3xl font-bold text-white mt-4">
              0
            </CardTitle>
            <CardDescription className="text-sm text-rose-50 font-medium">
              Yêu cầu sửa chữa
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-rose-100">
              Không có yêu cầu mới 🎉
            </div>
          </CardContent>
        </Card>

        {/* Plans Card */}
        <Card className="group bg-gradient-to-br from-emerald-500 to-teal-500 border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/10" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/20 rounded-full blur-2xl" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl border border-white/20">
                <Users className="h-6 w-6 text-white" />
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-white bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">
                <TrendingUp className="h-3 w-3" />
                0%
              </span>
            </div>
            <CardTitle className="text-3xl font-bold text-white mt-4">
              0
            </CardTitle>
            <CardDescription className="text-sm text-emerald-50 font-medium">
              Kế hoạch BT/HC/KĐ
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-emerald-100">
              0 nháp • 0 đã duyệt 📅
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions with Modern Integrated Design */}
      <Card className="bg-white border border-gray-200 shadow-md hover:shadow-lg transition-shadow">
        <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-white">
          <CardTitle className="text-xl font-bold text-gray-800">
            Thao tác nhanh
          </CardTitle>
          <CardDescription className="text-sm text-gray-600">
            Truy cập nhanh các chức năng chính của hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {!isRegionalLeader && (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="group relative w-full h-24 bg-gradient-to-br from-blue-50 to-blue-100/30 border border-blue-200 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200/30 transition-all duration-200 hover:shadow-md overflow-hidden"
                >
                  <Link href="/equipment?action=add" className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-all">
                      <Plus className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Thêm thiết bị</span>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="group relative w-full h-24 bg-gradient-to-br from-emerald-50 to-emerald-100/30 border border-emerald-200 hover:border-emerald-400 hover:bg-gradient-to-br hover:from-emerald-100 hover:to-emerald-200/30 transition-all duration-200 hover:shadow-md overflow-hidden"
                >
                  <Link href="/maintenance?action=create" className="flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-all">
                      <ClipboardList className="h-5 w-5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Lập kế hoạch</span>
                  </Link>
                </Button>
              </>
            )}
            
            <Button
              asChild
              variant="outline"
              className={`group relative w-full h-24 bg-gradient-to-br from-purple-50 to-purple-100/30 border border-purple-200 hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-100 hover:to-purple-200/30 transition-all duration-200 hover:shadow-md overflow-hidden ${isRegionalLeader ? 'md:col-start-2' : ''}`}
            >
              <Link href="/qr-scanner" className="flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-all">
                  <QrCode className="h-5 w-5 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Quét mã QR</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout for Calendar and Tabs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar Widget with Modern Design */}
        <Card className="bg-white border-white-400 shadow-card h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Lịch công việc
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Bảo trì, Hiệu chuẩn và Kiểm định thiết bị
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarWidget />
          </CardContent>
        </Card>

        {/* Dashboard Tabs with Modern Design */}
        <Card className="bg-white border-white-400 shadow-card h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">
              Thông tin chi tiết
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Thiết bị và kế hoạch cần theo dõi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardTabs />
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Section */}
      <Card className="bg-white border-white-400 shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Hoạt động gần đây
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Cập nhật mới nhất từ hệ thống
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
              Xem tất cả
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="p-2 bg-white rounded-lg">
                <Activity className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Hệ thống hoạt động ổn định</p>
                <p className="text-xs text-gray-500">2 phút trước</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="p-2 bg-white rounded-lg">
                <Shield className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Bảo trì định kỳ đã hoàn thành</p>
                <p className="text-xs text-gray-500">1 giờ trước</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
              <div className="p-2 bg-white rounded-lg">
                <Users className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Người dùng mới đã được thêm</p>
                <p className="text-xs text-gray-500">3 giờ trước</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
