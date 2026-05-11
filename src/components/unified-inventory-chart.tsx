"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { PieChart } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { DynamicPieChart } from "@/components/dynamic-chart"
import { callRpc } from "@/lib/rpc-client"
import { InteractiveEquipmentChart } from "@/components/interactive-equipment-chart"
import { isGlobalRole, isRegionalLeaderRole } from "@/lib/rbac"

const FACILITY_DONUT_LIMIT = 10
const FACILITY_DONUT_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#4f46e5",
  "#059669",
  "#64748b",
]

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

interface SessionWithRole {
  user?: {
    role?: string | null
  } | null
}

interface UnifiedInventoryChartContentProps {
  tenantFilter?: string
  selectedDonVi?: number | null
  effectiveTenantKey?: string
  role: string
  isGlobal: boolean
  isRegionalLeader: boolean
}

interface FacilitiesRpcRow {
  id: number
  name: string
  code?: string
  equipment_count: number
}

interface FacilityDonutDatum {
  [key: string]: unknown
  key: string
  name: string
  value: number
  color: string
}

interface FacilityDonutSourceItem {
  key: string
  name: string
  value: number
}

function buildFacilityDonutData(items: FacilityDonutSourceItem[]): FacilityDonutDatum[] {
  const chartableItems = items.some((item) => item.value > 0)
    ? items.filter((item) => item.value > 0)
    : items
  const topItems = chartableItems.slice(0, FACILITY_DONUT_LIMIT)
  const otherValue = chartableItems
    .slice(FACILITY_DONUT_LIMIT)
    .reduce((sum, item) => sum + item.value, 0)
  const donutItems = otherValue > 0
    ? [...topItems, { key: "other", name: "Khác", value: otherValue }]
    : topItems

  return donutItems.map((item, index) => ({
    ...item,
    color: FACILITY_DONUT_COLORS[index % FACILITY_DONUT_COLORS.length],
  }))
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) return "0%"
  return `${((value / total) * 100).toFixed(1).replace(/\.0$/, "")}%`
}

export function UnifiedInventoryChart({
  tenantFilter,
  selectedDonVi,
  effectiveTenantKey,
  isGlobalOrRegionalLeader,
}: UnifiedInventoryChartProps) {
  const { data: session } = useSession()
  const rawRole = (session as SessionWithRole | null | undefined)?.user?.role ?? ''
  const role = String(rawRole).toLowerCase()
  const isGlobal = isGlobalRole(rawRole)
  const isRegionalLeader = isRegionalLeaderRole(rawRole)

  // Only render for RL / Global per spec
  if (!isGlobalOrRegionalLeader || (!isGlobal && !isRegionalLeader)) return null

  return (
    <UnifiedInventoryChartContent
      tenantFilter={tenantFilter}
      selectedDonVi={selectedDonVi}
      effectiveTenantKey={effectiveTenantKey}
      role={role}
      isGlobal={isGlobal}
      isRegionalLeader={isRegionalLeader}
    />
  )
}

function UnifiedInventoryChartContent({
  tenantFilter,
  selectedDonVi,
  effectiveTenantKey,
  role,
  isGlobal,
  isRegionalLeader,
}: UnifiedInventoryChartContentProps) {
  const isAllMode = tenantFilter === 'all'

  // All-facilities view: fetch facilities with counts
  const { data: facilities, isLoading, error } = useQuery<FacilityRow[]>({
    queryKey: ['unified-inventory-chart', 'facilities', role],
    queryFn: async () => {
      const res = await callRpc<FacilitiesRpcRow[]>({ fn: 'get_facilities_with_equipment_count', args: {} })
      return Array.isArray(res) ? res : []
    },
    enabled: isAllMode,
    staleTime: 5 * 60_000,
  })

  const sortedData = React.useMemo(() => {
    if (!facilities || facilities.length === 0) return [] as FacilityDonutSourceItem[]
    const items = facilities
      .map((f) => ({
        key: `facility-${f.id}`,
        name: f.code ? `${f.name} (${f.code})` : f.name,
        value: Number(f.equipment_count) || 0,
      }))
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value
        return a.name.localeCompare(b.name, 'vi')
      })
    return items
  }, [facilities])

  const donutData = React.useMemo(() => buildFacilityDonutData(sortedData), [sortedData])
  const donutTotal = React.useMemo(
    () => donutData.reduce((sum, item) => sum + item.value, 0),
    [donutData],
  )

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
    ? 'Đang hiển thị tỷ trọng thiết bị theo cơ sở trên toàn hệ thống. Donut hiển thị Top 10 cơ sở và gộp phần còn lại vào “Khác”.'
    : isRegionalLeader
    ? 'Đang hiển thị tỷ trọng thiết bị theo cơ sở trong phạm vi của bạn. Donut hiển thị Top 10 cơ sở và gộp phần còn lại vào “Khác”.'
    : ''

  return (
    <Card aria-label="Biểu đồ phân bố thiết bị theo cơ sở">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="size-5" />
              Phân bố thiết bị theo cơ sở
            </CardTitle>
            <CardDescription>{message}</CardDescription>
          </div>
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
          <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1.1fr)]">
            <div className="relative min-h-[320px]">
              <DynamicPieChart
                data={donutData}
                height={320}
                dataKey="value"
                nameKey="name"
                colors={FACILITY_DONUT_COLORS}
                innerRadius={72}
                outerRadius={112}
                showLabels={false}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold tracking-normal">{donutTotal}</div>
                  <div className="text-xs text-muted-foreground">thiết bị</div>
                </div>
              </div>
            </div>
            <div data-testid="facility-donut-legend" className="grid content-center gap-2">
              {donutData.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-background/60 px-3 py-2"
                >
                  <div className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{formatPercent(item.value, donutTotal)}</div>
                  </div>
                  <div className="text-right text-sm font-semibold">{item.value} thiết bị</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
