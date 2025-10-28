"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { BarChart3 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DynamicBarChart } from "@/components/dynamic-chart"
import { callRpc } from "@/lib/rpc-client"
import { InteractiveEquipmentChart } from "@/components/interactive-equipment-chart"

interface UnifiedInventoryChartProps {
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
  isGlobalOrRegionalLeader?: boolean
}

interface FacilityRow {
  id: number
  name: string
  code?: string
  equipment_count: number
}

export function UnifiedInventoryChart({
  tenantFilter,
  selectedDonVi,
  effectiveTenantKey,
  isGlobalOrRegionalLeader,
}: UnifiedInventoryChartProps) {
  const { data: session } = useSession()
  const rawRole = (session as any)?.user?.role ?? ''
  const role = String(rawRole).toLowerCase()
  const isGlobal = role === 'global' || role === 'admin'
  const isRegionalLeader = role === 'regional_leader'

  // Only render for RL / Global per spec
  if (!isGlobalOrRegionalLeader) return null

  const isAllMode = tenantFilter === 'all'

  // All-facilities view: fetch facilities with counts
  const { data: facilities, isLoading, error } = useQuery<FacilityRow[]>({
    queryKey: ['unified-inventory-chart', 'facilities', role],
    queryFn: async () => {
      const res = await callRpc<any>({ fn: 'get_facilities_with_equipment_count', args: {} })
      const list = Array.isArray(res) ? res as FacilityRow[] : []
      return list
    },
    enabled: isAllMode,
    staleTime: 5 * 60_000,
  })

  const [showAll, setShowAll] = React.useState(false)
  const sortedData = React.useMemo(() => {
    if (!facilities || facilities.length === 0) return [] as { name: string; value: number }[]
    const items = facilities
      .map((f) => ({
        name: f.code ? `${f.name} (${f.code})` : f.name,
        value: Number(f.equipment_count) || 0,
      }))
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value
        return a.name.localeCompare(b.name, 'vi')
      })
    return items
  }, [facilities])

  const visibleData = React.useMemo(() => {
    if (showAll) return sortedData
    return sortedData.slice(0, 10)
  }, [sortedData, showAll])

  // Telemetry (lightweight)
  React.useEffect(() => {
    if (isAllMode) {
      try { console.debug('unified_chart_viewed', { mode: 'all', role, facility_count: facilities?.length ?? 0 }) } catch {}
    } else {
      try { console.debug('unified_chart_viewed', { mode: 'single', role }) } catch {}
    }
  }, [isAllMode, role, facilities?.length])

  if (!isAllMode) {
    // Single-facility: reuse existing interactive chart
    return (
      <InteractiveEquipmentChart
        tenantFilter={tenantFilter}
        selectedDonVi={selectedDonVi}
        effectiveTenantKey={effectiveTenantKey}
      />
    )
  }

  // All-facilities mode UI
  const message = isGlobal
    ? 'Đang hiển thị phân bố số lượng thiết bị theo cơ sở trên toàn hệ thống. Mặc định hiển thị Top 10; chọn “Hiển thị tất cả” để xem toàn bộ.'
    : isRegionalLeader
    ? 'Đang hiển thị phân bố số lượng thiết bị theo cơ sở trong phạm vi của bạn. Mặc định hiển thị Top 10; chọn “Hiển thị tất cả” để xem toàn bộ.'
    : ''

  return (
    <Card aria-label="Biểu đồ phân bố thiết bị theo cơ sở">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Phân bố thiết bị theo cơ sở
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
          {sortedData.length > 10 && (
            <Button variant="secondary" size="sm" onClick={() => {
              setShowAll((prev) => {
                try { console.debug('show_all_toggled', { from: prev }) } catch {}
                return !prev
              })
            }}>
              {showAll ? 'Thu gọn' : 'Hiển thị tất cả'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[400px] w-full" />
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>
              Không thể tải danh sách cơ sở. Vui lòng thử lại sau.
            </AlertDescription>
          </Alert>
        ) : sortedData.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground">
            Không có dữ liệu tồn kho theo cơ sở trong phạm vi của bạn.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div style={{ width: `${Math.max(visibleData.length * 80, 720)}px` }}>
              <DynamicBarChart
                data={visibleData}
                height={400}
                xAxisKey="name"
                bars={[{ key: 'value', color: '#0088FE', name: 'Số lượng thiết bị' }]}
                showGrid={true}
                showTooltip={true}
                showLegend={false}
                xAxisAngle={-45}
                margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}