"use client"

import * as React from "react"
import type { Session } from "next-auth"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { TenantSelector } from "@/components/shared/TenantSelector"
import { AuthenticatedPageBoundary } from "@/app/(app)/_components/AuthenticatedPageBoundary"
import { AuthenticatedPageSkeletonFallback } from "@/app/(app)/_components/AuthenticatedPageFallbacks"
import { TenantSelectionTip } from "./components/tenant-selection-tip"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"
import { EquipmentSearchReportTab } from "./components/equipment-search-report-tab"
import { canUseEquipmentAggregateSearch } from "./hooks/use-equipment-aggregate-search"

// Lazy load components to improve initial load time
const InventoryReportTab = React.lazy(() =>
  import("./components/inventory-report-tab").then((module) => ({
    default: module.InventoryReportTab,
  }))
)
const MaintenanceReportTab = React.lazy(() =>
  import("./components/maintenance-report-tab").then((module) => ({
    default: module.MaintenanceReportTab,
  }))
)
const UsageAnalyticsDashboard = React.lazy(() =>
  import("@/components/usage-analytics-dashboard").then((module) => ({
    default: module.UsageAnalyticsDashboard,
  }))
)

function normalizeUserRegionId(value: Session["user"]["dia_ban_id"]): number | string | null {
  return value ?? null
}

function buildReportsUrl(pathname: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function isReportsTab(value: string | null, canUseEquipmentSearch: boolean): boolean {
  return (
    value === "inventory" ||
    value === "maintenance" ||
    value === "utilization" ||
    (canUseEquipmentSearch && value === "equipment-search")
  )
}

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
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-4" />
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

/** Renders the authenticated Reports workspace. */
export default function ReportsPage() {
  return (
    <AuthenticatedPageBoundary fallback={<AuthenticatedPageSkeletonFallback />}>
      {(user) => <ReportsPageContent user={user} />}
    </AuthenticatedPageBoundary>
  )
}

interface ReportsPageContentProps {
  user: Session["user"]
}

function ReportsPageContent({ user }: ReportsPageContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Get facility selection from shared context
  const { selectedFacilityId, showSelector, shouldFetchData } = useTenantSelection()

  const userRole = user.role
  const canUseEquipmentSearch = canUseEquipmentAggregateSearch(userRole)
  const urlTab = searchParams.get("tab")
  const urlQuery = searchParams.get("q") ?? ""
  const activeTab = isReportsTab(urlTab, canUseEquipmentSearch) ? urlTab! : "inventory"

  const updateReportsQuery = React.useCallback(
    (updates: Record<string, string | null>) => {
      const nextParams = new URLSearchParams(searchParams.toString())

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          nextParams.delete(key)
        } else {
          nextParams.set(key, value)
        }
      }

      router.replace(buildReportsUrl(pathname, nextParams), { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const handleTabChange = React.useCallback(
    (value: string) => {
      if (value === "inventory") {
        updateReportsQuery({ tab: null })
      } else if (value === "equipment-search") {
        updateReportsQuery({ tab: "equipment-search" })
      } else {
        updateReportsQuery({ tab: value })
      }
    },
    [updateReportsQuery]
  )

  const handleEquipmentQueryCommit = React.useCallback(
    (query: string) => {
      updateReportsQuery({
        tab: "equipment-search",
        q: query.trim(),
      })
    },
    [updateReportsQuery]
  )

  // Map selectedFacilityId to legacy string-based tenantFilter for child components
  // undefined = 'unset', null = 'all', number = String(number)
  const tenantFilter = React.useMemo(() => {
    if (selectedFacilityId === undefined) return "unset"
    if (selectedFacilityId === null) return "all"
    return String(selectedFacilityId)
  }, [selectedFacilityId])

  // selectedDonVi for child components (number | null)
  // undefined becomes null (child components expect null for "not selected")
  const selectedDonVi = selectedFacilityId ?? null

  // Effective tenant key for query cache scoping
  const effectiveTenantKey = React.useMemo(() => {
    if (selectedFacilityId !== undefined) {
      return selectedFacilityId === null ? "all" : String(selectedFacilityId)
    }
    return user.don_vi ? String(user.don_vi) : "none"
  }, [selectedFacilityId, user.don_vi])

  return (
    <div data-testid="reports-page-content" className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-3xl font-semibold tracking-tight">Báo cáo</h2>

        {/* Tenant selector for global/regional_leader users */}
        {showSelector && <TenantSelector className="min-w-[280px] sm:min-w-[360px]" />}
      </div>

      {/* Show tip when no tenant selected (same pattern as Equipment page) */}
      {showSelector && !shouldFetchData && <TenantSelectionTip />}

      {/* Report tabs - only render when should fetch */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="min-w-0 space-y-4">
        <div data-testid="reports-tabs-scroll-container" className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-max">
            <TabsTrigger value="inventory">Xuất-Nhập-Tồn</TabsTrigger>
            <TabsTrigger value="maintenance">Bảo trì / Sửa chữa</TabsTrigger>
            <TabsTrigger value="utilization">Sử dụng thiết bị</TabsTrigger>
            {canUseEquipmentSearch ? (
              <TabsTrigger value="equipment-search">Tìm kiếm thiết bị</TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        {/* Only show content when shouldFetchData is true */}
        {shouldFetchData ? (
          <>
            <TabsContent value="inventory" className="min-w-0 space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <InventoryReportTab
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                  isGlobalOrRegionalLeader={showSelector}
                />
              </React.Suspense>
            </TabsContent>

            <TabsContent value="maintenance" className="min-w-0 space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <MaintenanceReportTab
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                />
              </React.Suspense>
            </TabsContent>

            <TabsContent value="utilization" className="min-w-0 space-y-4">
              <React.Suspense fallback={<TabSkeleton />}>
                <UsageAnalyticsDashboard
                  tenantFilter={tenantFilter}
                  selectedDonVi={selectedDonVi}
                  effectiveTenantKey={effectiveTenantKey}
                />
              </React.Suspense>
            </TabsContent>
            {canUseEquipmentSearch ? (
              <TabsContent value="equipment-search" className="min-w-0 space-y-4">
                <EquipmentSearchReportTab
                  key={`${userRole}:${user.dia_ban_id ?? ""}:${urlQuery}`}
                  initialQuery={urlQuery}
                  onQueryCommit={handleEquipmentQueryCommit}
                  userRegionId={normalizeUserRegionId(user.dia_ban_id)}
                  userRole={userRole}
                />
              </TabsContent>
            ) : null}
          </>
        ) : null}
      </Tabs>
    </div>
  )
}
