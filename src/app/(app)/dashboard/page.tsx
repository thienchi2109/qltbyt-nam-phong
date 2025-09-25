"use client"

import Link from "next/link"
import { Plus, QrCode, ClipboardList } from "lucide-react"

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
// import { useDashboardRealtimeSync } from "@/hooks/use-realtime-sync"

export default function Dashboard() {
  // useDashboardRealtimeSync()

  return (
    <>
      {/* KPI Cards */}
      <KPICards />

      {/* Quick Actions Section */}
      <div className="md:mt-6 md:space-y-5">
        <div className="grid gap-4 md:gap-8">
        <Card>
          <CardHeader className="p-4 md:p-8">
            <CardTitle className="text-base font-semibold leading-tight md:text-lg md:font-bold">
              Thao tác nhanh
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Truy cập nhanh các chức năng chính của hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-8 md:pt-0">
            <div className="grid grid-cols-3 gap-3 md:grid-cols-3 md:gap-6">
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="mobile-quick-action bg-gradient-to-br from-primary/20 via-primary/10 to-white text-primary-700 hover:shadow-md focus-visible:ring-primary/40"
              >
                <Link href="/equipment?action=add" aria-label="Thêm thiết bị">
                  <Plus className="mobile-quick-action-icon" aria-hidden="true" />
                  <div className="mobile-quick-action-text">
                    <div className="mobile-quick-action-title">Thêm thiết bị</div>
                  </div>
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="ghost"
                className="mobile-quick-action bg-gradient-to-br from-emerald-200/80 via-emerald-100 to-white text-emerald-700 hover:shadow-md focus-visible:ring-emerald-400/60"
              >
                <Link href="/maintenance?action=create" aria-label="Lập kế hoạch bảo trì">
                  <ClipboardList className="mobile-quick-action-icon" aria-hidden="true" />
                  <div className="mobile-quick-action-text">
                    <div className="mobile-quick-action-title">Lập kế hoạch</div>
                  </div>
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="ghost"
                className="mobile-quick-action bg-gradient-to-br from-sky-200/80 via-sky-100 to-white text-sky-700 hover:shadow-md focus-visible:ring-sky-400/60"
              >
                <Link href="/qr-scanner" aria-label="Quét mã QR thiết bị">
                  <QrCode className="mobile-quick-action-icon" aria-hidden="true" />
                  <div className="mobile-quick-action-text">
                    <div className="mobile-quick-action-title">Quét mã QR</div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Calendar Widget */}
      <div className="grid gap-4 md:gap-8 md:mt-8">
        <CalendarWidget />
      </div>

      {/* Monthly Summary and Main Content */}
      <div className="grid gap-4 md:gap-8 md:mt-8 lg:grid-cols-3">
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
