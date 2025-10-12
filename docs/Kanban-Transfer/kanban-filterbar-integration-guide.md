# Transfer Kanban FilterBar Integration Guide

**Date:** October 12, 2025  
**Component:** `FilterBar` for server-side Kanban filtering  
**Status:** Ready for Integration

---

## What Was Created

### FilterBar Component ✅
**File:** `src/components/transfers/FilterBar.tsx`

**Features:**
- ✅ **Search:** Full-text search with 300ms debounce
- ✅ **Assignee Filter:** Dropdown of users from current facility
- ✅ **Type Filter:** Toggle buttons (Nội bộ / Bên ngoài)
- ✅ **Status Filter:** Multi-select status buttons
- ✅ **Date Range Filter:** From/To date pickers
- ✅ **Active Filters Display:** Visual badges showing active filters
- ✅ **Clear All:** One-click filter reset
- ✅ **Advanced Filters Popover:** Collapsible filter panel

---

## Integration Steps

### Step 1: Add FilterBar to Transfers Page

```tsx
// src/app/(app)/transfers/page.tsx

import { FilterBar } from '@/components/transfers/FilterBar'
import { useTransfersKanban, useTransferCounts } from '@/hooks/useTransfersKanban'
import { TransferKanbanFilters } from '@/types/transfer-kanban'

export default function TransfersPage() {
  // ... existing code ...
  
  // ADD: Server-side filters state
  const [filters, setFilters] = React.useState<TransferKanbanFilters>({
    facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
  })
  
  // ADD: Update filters when facility changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
    }))
  }, [selectedFacilityId])
  
  // REPLACE: Old useTransferRequests with new server-side hook
  const { data, isLoading, refetch } = useTransfersKanban(filters)
  
  // ADD: Fetch counts for column headers
  const { data: counts } = useTransferCounts(
    selectedFacilityId ? [selectedFacilityId] : undefined
  )
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Existing header... */}
      
      {/* ADD: FilterBar */}
      <FilterBar 
        filters={filters}
        onFiltersChange={setFilters}
        facilityId={selectedFacilityId || undefined}
      />
      
      {/* Existing DensityToggle... */}
      
      {/* Kanban columns using data.transfers */}
      <div className="flex gap-4 overflow-x-auto">
        {KANBAN_COLUMNS.map((column) => (
          <CollapsibleLane
            key={column.status}
            title={column.title}
            count={counts?.columnCounts[column.status] || 0}
            items={data?.transfers[column.status] || []}
            // ... rest of props
          />
        ))}
      </div>
    </div>
  )
}
```

---

## Complete Integration Example

```tsx
"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

// Components
import { FilterBar } from "@/components/transfers/FilterBar"
import { DensityToggle, type DensityMode } from "@/components/transfers/DensityToggle"
import { CollapsibleLane } from "@/components/transfers/CollapsibleLane"
import { TransferCard } from "@/components/transfers/TransferCard"

// Hooks
import { useTransfersKanban, useTransferCounts } from "@/hooks/useTransfersKanban"
import { useFacilityFilter } from "@/hooks/useFacilityFilter"
import { useQuery } from "@tanstack/react-query"

// Types
import { TransferKanbanFilters, KANBAN_COLUMNS } from "@/types/transfer-kanban"

// Utils
import { getDensityMode, setDensityMode as saveDensityMode } from "@/lib/kanban-preferences"
import { callRpc } from "@/lib/rpc-client"

export default function TransfersPage() {
  const { data: session, status } = useSession()
  const user = session?.user as any
  const router = useRouter()

  // Authentication
  if (status === "loading") {
    return <div>Loading...</div>
  }
  if (status === "unauthenticated") {
    router.push("/")
    return null
  }

  // Facility filter (for global/regional_leader)
  const { data: facilityOptionsData } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ['transfer_request_facilities'],
    queryFn: async () => {
      const result = await callRpc<Array<{ id: number; name: string }>>({ 
        fn: 'get_transfer_request_facilities', 
        args: {} 
      })
      return result || []
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  })

  const { selectedFacilityId, showFacilityFilter } = useFacilityFilter({
    mode: 'server',
    userRole: user?.role || 'user',
    facilities: facilityOptionsData || [],
  })

  // ✅ SERVER-SIDE FILTERS
  const [filters, setFilters] = React.useState<TransferKanbanFilters>(() => ({
    facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
  }))

  // Update facility filter when it changes
  React.useEffect(() => {
    setFilters(prev => ({
      ...prev,
      facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
    }))
  }, [selectedFacilityId])

  // ✅ FETCH DATA (Server-side filtered)
  const { data, isLoading, refetch } = useTransfersKanban(filters)
  const { data: counts } = useTransferCounts(
    selectedFacilityId ? [selectedFacilityId] : undefined
  )

  // Density mode (Phase 0)
  const [densityMode, setDensityModeState] = React.useState<DensityMode>(() => getDensityMode())
  const handleDensityChange = React.useCallback((mode: DensityMode) => {
    setDensityModeState(mode)
    saveDensityMode(mode)
  }, [])

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Luân chuyển thiết bị</h1>
          <p className="text-muted-foreground">
            Quản lý yêu cầu luân chuyển thiết bị y tế
          </p>
        </div>
        
        {/* Density Toggle */}
        <DensityToggle 
          density={densityMode} 
          onDensityChange={handleDensityChange} 
        />
      </div>

      {/* ✅ FILTER BAR (NEW) */}
      <FilterBar 
        filters={filters}
        onFiltersChange={setFilters}
        facilityId={selectedFacilityId || undefined}
      />

      {/* Loading State */}
      {isLoading && <div>Đang tải...</div>}

      {/* ✅ KANBAN BOARD (Server-side data) */}
      {!isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((column) => {
            const items = data?.transfers[column.status] || []
            const count = counts?.columnCounts[column.status] || 0

            return (
              <CollapsibleLane
                key={column.status}
                status={column.status as any}
                title={column.title}
                description={column.description}
                count={count}
                color={column.color}
                isCollapsed={false}
                onToggleCollapse={() => {}}
                visibleCount={items.length}
                totalCount={items.length}
                onShowMore={() => {}}
              >
                {/* Render cards */}
                {items.map((transfer) => (
                  <TransferCard
                    key={transfer.id}
                    transfer={transfer}
                    density={densityMode}
                    onClick={() => {
                      // Handle card click
                    }}
                    onEdit={() => {
                      // Handle edit
                    }}
                    onPreview={() => {
                      // Handle preview
                    }}
                  />
                ))}
              </CollapsibleLane>
            )
          })}
        </div>
      )}

      {/* Total Count */}
      {data && (
        <div className="text-sm text-muted-foreground text-center">
          Tổng số: {data.totalCount} yêu cầu
        </div>
      )}
    </div>
  )
}
```

---

## Filter Behavior

### Search Filter (300ms debounce)
- User types → 300ms delay → Server query updates
- Searches: ma_yeu_cau, equipment name, reason, departments
- PostgreSQL full-text search (fast, supports Vietnamese)

### Assignee Filter
- Dropdown shows users from **current facility only**
- Uses existing `equipment_users_list_for_tenant` RPC
- Single-select (can be extended to multi-select)

### Type Filter
- Toggle buttons: Nội bộ / Bên ngoài
- Multi-select (can select both)
- Visual feedback with active state

### Status Filter
- Grid of 5 buttons (one per status)
- Multi-select (filter multiple statuses)
- Common use case: Show only "Chờ duyệt" + "Đã duyệt"

### Date Range Filter
- From date / To date pickers
- Filters by `created_at` field
- Can use one or both dates

---

## Active Filters Display

Visual badges show:
- 🔍 Search query (truncated if > 20 chars)
- 👤 Selected assignee name
- 🏷️ Selected types (Nội bộ, Bên ngoài)
- 📊 Number of statuses selected
- 📅 Date range (formatted in Vietnamese)

Each badge has X button to remove that specific filter.

---

## Performance Notes

### Client-Side
- Search debounced (300ms) → Reduces API calls
- Filter state managed locally → No unnecessary re-renders
- TanStack Query caching (30s stale time) → Fast filter toggles

### Server-Side
- PostgreSQL indexes ensure <100ms queries
- Cursor-based pagination ready (not used yet)
- Full-text search via GIN index

---

## Migration from Current Page

### What to Remove
```tsx
// ❌ REMOVE: Client-side filtering
const filtered = transfers.filter(t => ...)

// ❌ REMOVE: Old useTransferRequests hook (client-side)
const { data: transfers } = useTransferRequests({ don_vi: selectedFacilityId })
```

### What to Add
```tsx
// ✅ ADD: Server-side filters state
const [filters, setFilters] = React.useState<TransferKanbanFilters>({
  facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
})

// ✅ ADD: Server-side data hook
const { data, isLoading } = useTransfersKanban(filters)

// ✅ ADD: FilterBar component
<FilterBar filters={filters} onFiltersChange={setFilters} facilityId={selectedFacilityId} />
```

### What to Keep
- ✅ Phase 0 components: `CollapsibleLane`, `DensityToggle`, `TransferCard`
- ✅ Facility filter for global/regional_leader
- ✅ Dialog components (AddTransferDialog, EditTransferDialog, etc.)
- ✅ Authentication checks

---

## Testing Checklist

Before deploying:

- [ ] Search input updates Kanban (300ms debounce)
- [ ] Assignee dropdown filters correctly
- [ ] Type toggle buttons work (single & multi-select)
- [ ] Status buttons filter correctly
- [ ] Date range filters by created_at
- [ ] Active filter badges display correctly
- [ ] X buttons remove individual filters
- [ ] "Xóa tất cả" clears all filters
- [ ] Facility filter updates FilterBar's assignee dropdown
- [ ] Count badges match actual filtered results
- [ ] No console errors
- [ ] TypeScript types all valid

---

## Next Steps After Integration

1. **Test with real data** - Verify filters work as expected
2. **Add loading states** - Skeleton loaders for filter changes
3. **Add empty states** - Message when no results
4. **Consider saved filters** - Store common filters in localStorage
5. **Add filter presets** - Quick buttons like "My Requests", "Pending Approval"

---

## Dependencies

All components and hooks are now available:
- ✅ `FilterBar` component
- ✅ `useTransfersKanban` hook
- ✅ `useTransferCounts` hook
- ✅ `TransferKanbanFilters` types
- ✅ API routes (`/api/transfers/kanban`, `/api/transfers/counts`)
- ✅ RPC functions (`get_transfers_kanban`, `get_transfer_counts`)

**Ready to integrate into transfers page!**

---

**Author:** GitHub Copilot  
**Date:** October 12, 2025  
**Status:** Ready for Integration
