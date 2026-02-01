# Device Quota Dashboard Context - Usage Guide

## Files Created

### 1. Context Provider
**File**: `D:\qltbyt-nam-phong\src\app\(app)\device-quota\dashboard\_components\DeviceQuotaDashboardContext.tsx`

Provides shared state and data fetching for the Device Quota Dashboard.

**Features:**
- TanStack Query v5 integration with request deduplication
- Auto-fetches active decision compliance summary
- Memoized context value to prevent re-renders
- Type-safe with explicit interfaces
- 30-second stale time for optimal caching

### 2. Consumer Hook
**File**: `D:\qltbyt-nam-phong\src\app\(app)\device-quota\dashboard\_hooks\useDeviceQuotaDashboardContext.ts`

Simple consumer hook with safety check.

---

## Usage Examples

### Basic Setup (Page Level)

```typescript
// src/app/(app)/device-quota/dashboard/page.tsx
import { DeviceQuotaDashboardProvider } from "./_components/DeviceQuotaDashboardContext"
import { DashboardPageClient } from "./_components/DashboardPageClient"

export default function DeviceQuotaDashboardPage() {
  return (
    <DeviceQuotaDashboardProvider>
      <DashboardPageClient />
    </DeviceQuotaDashboardProvider>
  )
}
```

### Using Data in Components

```typescript
// src/app/(app)/device-quota/dashboard/_components/DashboardPageClient.tsx
"use client"

import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"

export function DashboardPageClient() {
  const { complianceSummary, isLoading, isError } = useDeviceQuotaDashboardContext()

  if (isLoading) {
    return <div>Loading compliance data...</div>
  }

  if (isError) {
    return <div>Error loading compliance data</div>
  }

  if (!complianceSummary?.quyet_dinh_id) {
    return <div>No active quota decision found</div>
  }

  return (
    <div>
      <h1>Quota Decision: {complianceSummary.so_quyet_dinh}</h1>
      <div>Total Categories: {complianceSummary.total_categories}</div>
      <div>Compliant: {complianceSummary.dat_count}</div>
      <div>Under Quota: {complianceSummary.thieu_count}</div>
      <div>Over Quota: {complianceSummary.vuot_count}</div>
      <div>Unassigned Equipment: {complianceSummary.unassigned_equipment}</div>
    </div>
  )
}
```

### Creating Stats Cards

```typescript
// src/app/(app)/device-quota/dashboard/_components/DashboardStatsCards.tsx
"use client"

import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function DashboardStatsCards() {
  const { complianceSummary, isLoading } = useDeviceQuotaDashboardContext()

  if (isLoading || !complianceSummary) {
    return <div>Loading...</div>
  }

  const stats = [
    {
      title: "Total Categories",
      value: complianceSummary.total_categories,
      className: "bg-blue-50"
    },
    {
      title: "Compliant",
      value: complianceSummary.dat_count,
      className: "bg-green-50"
    },
    {
      title: "Under Quota",
      value: complianceSummary.thieu_count,
      className: "bg-orange-50"
    },
    {
      title: "Over Quota",
      value: complianceSummary.vuot_count,
      className: "bg-red-50"
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className={stat.className}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### Manual Refetch Example

```typescript
"use client"

import { useDeviceQuotaDashboardContext } from "../_hooks/useDeviceQuotaDashboardContext"
import { Button } from "@/components/ui/button"

export function RefreshButton() {
  const { refetch, isLoading } = useDeviceQuotaDashboardContext()

  return (
    <Button
      onClick={() => refetch()}
      disabled={isLoading}
    >
      Refresh Data
    </Button>
  )
}
```

---

## API Reference

### DeviceQuotaDashboardContextValue

```typescript
interface DeviceQuotaDashboardContextValue {
  // User/Auth
  user: AuthUser | null
  donViId: number | null

  // Data
  complianceSummary: ComplianceSummary | null

  // Loading states
  isLoading: boolean
  isError: boolean

  // Refetch
  refetch: () => void
}
```

### ComplianceSummary

```typescript
interface ComplianceSummary {
  quyet_dinh_id: number | null       // Active decision ID
  so_quyet_dinh: string | null       // Decision number
  total_categories: number           // Total quota categories
  dat_count: number                  // Categories meeting quota
  thieu_count: number                // Categories under quota
  vuot_count: number                 // Categories over quota
  unassigned_equipment: number       // Equipment with no category
}
```

---

## React Best Practices Applied

### 1. Request Deduplication (`client-swr-dedup`)
- Uses TanStack Query with proper `queryKey`
- Multiple components can call the same hook without duplicate requests

### 2. Memoization (`rerender-memo`)
- Context value is memoized with `useMemo`
- Only re-renders when dependencies change
- Prevents cascade re-renders in children

### 3. Direct Imports (`bundle-barrel-imports`)
- No barrel file exports
- Direct imports from specific files
- Better tree-shaking for optimal bundle size

### 4. Proper Error Boundaries
- Hook throws error if used outside provider
- Clear error messages for debugging

### 5. Optimal Cache Strategy
- `staleTime: 30000` (30s) - data stays fresh
- `gcTime: 5 * 60 * 1000` (5min) - cache kept in memory
- Balances freshness with performance

---

## RPC Integration

The context uses the whitelisted RPC function:
- **Function**: `dinh_muc_compliance_summary`
- **Security**: JWT-based tenant isolation
- **Auto-detection**: Finds active decision automatically when `p_quyet_dinh_id` is null

---

## Next Steps

1. Create `DashboardPageClient.tsx` - Smart container component
2. Create `DashboardStatsCards.tsx` - Presentational stats display
3. Create `DashboardComplianceChart.tsx` - Visual compliance breakdown
4. Add the provider to the dashboard page

---

## Notes

- Context is **read-only** - no mutations needed for dashboard
- If you need compliance details (per-category), create a separate query using `dinh_muc_compliance_detail` RPC
- Pattern follows RepairRequestsContext exactly for consistency
- All types are inline to avoid circular dependencies
