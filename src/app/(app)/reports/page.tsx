"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy load components to improve initial load time
const InventoryReportTab = React.lazy(() => import("./components/inventory-report-tab").then(module => ({ default: module.InventoryReportTab })))
const MaintenanceReportTab = React.lazy(() => import("./components/maintenance-report-tab").then(module => ({ default: module.MaintenanceReportTab })))
const UsageAnalyticsDashboard = React.lazy(() => import("@/components/usage-analytics-dashboard").then(module => ({ default: module.UsageAnalyticsDashboard })))

// Loading skeleton for tabs
function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-48" />
          </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = React.useState("inventory")

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Báo cáo</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">Xuất-Nhập-Tồn</TabsTrigger>
          <TabsTrigger value="maintenance">
            Bảo trì / Sửa chữa
          </TabsTrigger>
          <TabsTrigger value="utilization">
            Sử dụng thiết bị
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="inventory" className="space-y-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <InventoryReportTab />
          </React.Suspense>
        </TabsContent>
        
        <TabsContent value="maintenance" className="space-y-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <MaintenanceReportTab />
          </React.Suspense>
        </TabsContent>
        
        <TabsContent value="utilization" className="space-y-4">
          <React.Suspense fallback={<TabSkeleton />}>
            <UsageAnalyticsDashboard />
          </React.Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
} 