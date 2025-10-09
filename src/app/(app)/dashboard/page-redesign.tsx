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
import { motion } from "framer-motion"

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

// Animation variants for staggered entrance
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 100
    }
  }
}

export default function ModernDashboard() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isRegionalLeader = user?.role === 'regional_leader'

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Welcome Section */}
      <motion.div 
        className="bg-white rounded-2xl p-6 shadow-sm border border-white-400"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Xin chào, {user?.name || 'User'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Đây là tổng quan hoạt động của hệ thống hôm nay
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-white-100 hover:bg-white-200 text-gray-600"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-white-100 hover:bg-white-200 text-gray-600"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Enhanced KPI Cards with Modern Design */}
      <motion.div 
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={itemVariants}
      >
        {/* Total Equipment Card */}
        <Card className="bg-white border-white-400 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <ArrowUpRight className="h-3 w-3" />
                12%
              </span>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 mt-4">
              146
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Tổng số thiết bị
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-400">
              Đang quản lý tích cực
            </div>
          </CardContent>
        </Card>

        {/* Maintenance Required Card */}
        <Card className="bg-white border-white-400 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-full -mr-16 -mt-16" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-yellow-100 rounded-xl">
                <Shield className="h-5 w-5 text-yellow-600" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <TrendingUp className="h-3 w-3" />
                0%
              </span>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 mt-4">
              0
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Cần bảo trì/hiệu chuẩn
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-400">
              Tất cả đã được kiểm tra
            </div>
          </CardContent>
        </Card>

        {/* Repair Requests Card */}
        <Card className="bg-white border-white-400 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-red-100 rounded-xl">
                <ClipboardList className="h-5 w-5 text-red-600" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <ArrowDownRight className="h-3 w-3" />
                100%
              </span>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 mt-4">
              0
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Yêu cầu sửa chữa
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-400">
              Không có yêu cầu mới
            </div>
          </CardContent>
        </Card>

        {/* Plans Card */}
        <Card className="bg-white border-white-400 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16" />
          <CardHeader className="relative pb-2">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-green-100 rounded-xl">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <TrendingUp className="h-3 w-3" />
                0%
              </span>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 mt-4">
              0
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Kế hoạch BT/HC/KĐ
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-xs text-gray-400">
              0 nháp • 0 đã duyệt
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions with Modern Design */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white border-white-400 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Thao tác nhanh
            </CardTitle>
            <CardDescription className="text-sm text-gray-500">
              Truy cập nhanh các chức năng chính của hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {!isRegionalLeader && (
                <>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-24 bg-white hover:bg-blue-50 border-white-400 hover:border-blue-200 group transition-all duration-200"
                    >
                      <Link href="/equipment?action=add" className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                          <Plus className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Thêm thiết bị</span>
                      </Link>
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      asChild
                      variant="outline"
                      className="w-full h-24 bg-white hover:bg-green-50 border-white-400 hover:border-green-200 group transition-all duration-200"
                    >
                      <Link href="/maintenance?action=create" className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                          <ClipboardList className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">Lập kế hoạch</span>
                      </Link>
                    </Button>
                  </motion.div>
                </>
              )}
              
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={isRegionalLeader ? 'md:col-start-2' : ''}
              >
                <Button
                  asChild
                  variant="outline"
                  className="w-full h-24 bg-white hover:bg-purple-50 border-white-400 hover:border-purple-200 group transition-all duration-200"
                >
                  <Link href="/qr-scanner" className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                      <QrCode className="h-5 w-5 text-purple-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">Quét mã QR</span>
                  </Link>
                </Button>
              </motion.div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Two Column Layout for Calendar and Tabs */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calendar Widget with Modern Design */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white border-white-400 shadow-sm h-full">
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
        </motion.div>

        {/* Dashboard Tabs with Modern Design */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white border-white-400 shadow-sm h-full">
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
        </motion.div>
      </div>

      {/* Activity Feed Section */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white border-white-400 shadow-sm">
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
      </motion.div>
    </motion.div>
  )
}