"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TenantFilterDropdown } from "./components/tenant-filter-dropdown"
import { TenantSelectionTip } from "./components/tenant-selection-tip"
import { useToast } from "@/hooks/use-toast"
import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"

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
  const user = session?.user as any
  const { toast } = useToast()
  
  // Global/admin/regional_leader role check computed early so hooks below can depend on it safely
  const isGlobalOrRegionalLeader = user?.role === 'global' || user?.role === 'admin' || user?.role === 'regional_leader'

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
  
  // Tenant filtering logic (EXACT same pattern as Equipment page)
  const tenantKey = user?.don_vi ? String(user.don_vi) : 'none'
  const [tenantFilter, setTenantFilter] = React.useState<string>(() => {
    if (!isGlobalOrRegionalLeader) return tenantKey
    
    // For global/regional_leader users, try to restore from localStorage first
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('reports_tenant_filter')
        if (saved && (saved === 'unset' || saved === 'all' || /^\d+$/.test(saved))) {
          return saved
        }
      } catch {}
    }
    return 'unset'
  })

  // Load allowed facilities for validation (prevents stale saved IDs causing 403)
  const { data: allowedFacilities } = useQuery<{ id: number; name: string }[]>({
    queryKey: ['reports-facilities-validate', user?.role, user?.don_vi],
    queryFn: async () => {
      if (isGlobalOrRegionalLeader) {
        const result = await callRpc<any>({ fn: 'get_facilities_with_equipment_count', args: {} })
        const list = Array.isArray(result) ? result : []
        return list.map((t: any) => ({ id: Number(t.id), name: t.name }))
      }
      return []
    },
    enabled: isGlobalOrRegionalLeader,
    staleTime: 5 * 60_000,
  })

  // Validate persisted selection against allowed list
  const [tenantValidated, setTenantValidated] = React.useState<boolean>(!isGlobalOrRegionalLeader)
  React.useEffect(() => {
    if (!isGlobalOrRegionalLeader) {
      setTenantValidated(true)
      return
    }
    if (!allowedFacilities) return

    if (tenantFilter === 'unset' || tenantFilter === 'all') {
      setTenantValidated(tenantFilter === 'all')
      return
    }

    if (/^\d+$/.test(tenantFilter)) {
      const n = parseInt(tenantFilter, 10)
      const valid = allowedFacilities.some((f) => f.id === n)
      if (!valid) {
        // Reset to unset to force user selection; prevents unauthorized RPC calls
        setTenantFilter('unset')
        setTenantValidated(false)
      } else {
        setTenantValidated(true)
      }
    } else {
      setTenantValidated(false)
    }
  }, [isGlobalOrRegionalLeader, allowedFacilities, tenantFilter])
  
  // Compute gating logic with validation to avoid 403 on first load
  const shouldFetchReports = React.useMemo(() => {
    if (!isGlobalOrRegionalLeader) return true
    if (tenantFilter === 'all') return true
    return tenantValidated && /^\d+$/.test(tenantFilter)
  }, [isGlobalOrRegionalLeader, tenantFilter, tenantValidated])

  const selectedDonVi = React.useMemo(() => {
    if (!isGlobalOrRegionalLeader) return null
    if (tenantFilter === 'all') return null
    const v = parseInt(tenantFilter, 10)
    return Number.isFinite(v) ? v : null
  }, [isGlobalOrRegionalLeader, tenantFilter])

  const effectiveTenantKey = isGlobalOrRegionalLeader ? (shouldFetchReports ? tenantFilter : 'unset') : tenantKey

  // Persist tenant selection for global/admin/regional_leader users (same as Equipment page)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (isGlobalOrRegionalLeader) {
      try { localStorage.setItem('reports_tenant_filter', tenantFilter) } catch {}
    } else {
      try { localStorage.removeItem('reports_tenant_filter') } catch {}
    }
  }, [isGlobalOrRegionalLeader, tenantFilter])

  // No separate restoration effect needed - handled in useState initializer above

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
    <div className="flex flex-wrap items-center gap-4">
      <h2 className="text-3xl font-bold tracking-tight">Báo cáo</h2>

      {/* Tenant selector for global/regional_leader users */}
      {isGlobalOrRegionalLeader && (
        <TenantFilterDropdown 
          value={tenantFilter}
          onChange={setTenantFilter}
          className="min-w-[360px] sm:min-w-[480px] lg:min-w-[600px]"
        />
      )}
    </div>
      
      {/* Show tip when no tenant selected (same pattern as Equipment page) */}
      {isGlobalOrRegionalLeader && !shouldFetchReports && (
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
        
        {/* Only show content when shouldFetchReports is true */}
        {shouldFetchReports ? (
          <>
            <TabsContent value="inventory" className="space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <InventoryReportTab 
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                  isGlobalOrRegionalLeader={isGlobalOrRegionalLeader}
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
        ) : (
          <div></div>
        )}
      </Tabs>
    </div>
  )
} 
