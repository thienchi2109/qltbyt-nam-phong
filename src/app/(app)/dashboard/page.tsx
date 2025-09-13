"use client"

import Link from "next/link"
import {
  Plus,
  QrCode,
  ClipboardList,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CalendarWidget } from "@/components/ui/calendar-widget"
import { MonthlyMaintenanceSummary } from "@/components/monthly-maintenance-summary"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { EquipmentAttentionTable } from "@/components/dashboard/equipment-attention-table"
import { MaintenancePlansTable } from "@/components/dashboard/maintenance-plans-table"
import { useDashboardRealtimeSync } from "@/hooks/use-realtime-sync"

export default function Dashboard() {
  // Temporarily disable useRealtimeSync to avoid conflict with RealtimeProvider
  // useDashboardRealtimeSync()

  return (
    <>
      {/* KPI Cards */}
      <KPICards />

      {/* Quick Actions Section */}
      <div className="grid gap-4 md:gap-8">
  <Card>
    <CardHeader className="p-4 md:p-6">
      <CardTitle className="text-base md:text-lg">Thao tác nhanh</CardTitle>
      <CardDescription className="text-sm">
        Truy cập nhanh các chức năng chính của hệ thống.
      </CardDescription>
    </CardHeader>
    <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
      <div className="grid gap-3 grid-cols-3 md:grid-cols-2 lg:grid-cols-3 md:gap-4">
        <Button asChild size="lg" variant="outline" className="mobile-quick-action">
          <Link href="/equipment?action=add">
            <Plus className="mobile-quick-action-icon" />
            <div className="mobile-quick-action-text">
              <div className="mobile-quick-action-title">Thêm thiết bị</div>
              <div className="mobile-quick-action-desc">Đăng ký thiết bị mới vào hệ thống</div>
            </div>
          </Link>
        </Button>

        <Button asChild size="lg" variant="outline" className="mobile-quick-action">
          <Link href="/maintenance?action=create">
            <ClipboardList className="mobile-quick-action-icon" />
            <div className="mobile-quick-action-text">
              <div className="mobile-quick-action-title">Lập kế hoạch</div>
              <div className="mobile-quick-action-desc">Tạo kế hoạch bảo trì, hiệu chuẩn, kiểm định</div>
            </div>
          </Link>
        </Button>

        <Button asChild size="lg" variant="outline" className="mobile-quick-action">
          <Link href="/qr-scanner">
            <QrCode className="mobile-quick-action-icon" />
            <div className="mobile-quick-action-text">
              <div className="mobile-quick-action-title">Quét mã QR</div>
              <div className="mobile-quick-action-desc">Quét mã QR thiết bị nhanh chóng</div>
            </div>
          </Link>
        </Button>
      </div>
    </CardContent>
  </Card>
      </div>

      {/* Calendar Widget */}
      <div className="grid gap-4 md:gap-8">
        <CalendarWidget />
      </div>

      {/* Monthly Summary and Main Content */}
      <div className="grid gap-4 md:gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid gap-4 md:gap-8 lg:grid-cols-2">
            <EquipmentAttentionTable />
            <MaintenancePlansTable />
          </div>
        </div>

        {/* Monthly Maintenance Summary */}
        <MonthlyMaintenanceSummary />
      </div>
    </>
  )
}
