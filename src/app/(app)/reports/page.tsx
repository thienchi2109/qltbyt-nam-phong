"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { TenantSelectionTip } from "./components/tenant-selection-tip"
import { useToast } from "@/hooks/use-toast"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

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
  const router = useRouter()
  const { data: session, status } = useSession()
  const user = session?.user as { role?: string; don_vi?: number; dia_ban_id?: number } | undefined
  const { toast } = useToast()

  // Get facility selection from shared context
  const {
    selectedFacilityId,
    showSelector,
    shouldFetchData,
  } = useTenantSelection()

  // Redirect if not authenticated (same pattern as Equipment page)
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  // State
  const [activeTab, setActiveTab] = React.useState("inventory")
  
  // Map selectedFacilityId to legacy string-based tenantFilter for child components
  // undefined = 'unset', null = 'all', number = String(number)
  const tenantFilter = React.useMemo(() => {
    if (selectedFacilityId === undefined) return 'unset'
    if (selectedFacilityId === null) return 'all'
    return String(selectedFacilityId)
  }, [selectedFacilityId])

  // selectedDonVi for child components (number | null)
  // undefined becomes null (child components expect null for "not selected")
  const selectedDonVi = selectedFacilityId ?? null

  // Effective tenant key for query cache scoping
  const effectiveTenantKey = React.useMemo(() => {
    if (selectedFacilityId !== undefined) {
      return selectedFacilityId === null ? 'all' : String(selectedFacilityId)
    }
    return user?.don_vi ? String(user.don_vi) : 'none'
  }, [selectedFacilityId, user?.don_vi])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
    <div className="flex flex-wrap items-center gap-4">
      <h2 className="text-3xl font-bold tracking-tight">Báo cáo</h2>

      {/* Tenant selector for global/regional_leader users */}
      {showSelector && (
        <TenantSelector className="min-w-[280px] sm:min-w-[360px]" />
      )}
    </div>
      
      {/* Show tip when no tenant selected (same pattern as Equipment page) */}
      {showSelector && !shouldFetchData && (
        <TenantSelectionTip />
      )}
      
      {/* Report tabs - only render when should fetch */}
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
        
        {/* Only show content when shouldFetchData is true */}
        {shouldFetchData ? (
          <>
            <TabsContent value="inventory" className="space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <InventoryReportTab 
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                  isGlobalOrRegionalLeader={showSelector}
                />
              </React.Suspense>
            </TabsContent>
            
            <TabsContent value="maintenance" className="space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <MaintenanceReportTab 
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                />
              </React.Suspense>
            </TabsContent>
            
            <TabsContent value="utilization" className="space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <UsageAnalyticsDashboard 
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                />
              </React.Suspense>
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  )
}
