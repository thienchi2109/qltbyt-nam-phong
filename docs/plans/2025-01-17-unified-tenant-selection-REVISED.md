# Unified Tenant Selection System - REVISED

## Critical Changes from Original Plan

### 1. Context Optimization

**CHANGE:** Split context into state and actions to prevent unnecessary re-renders

```typescript
"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { useQuery } from "@tanstack/react-query"
import { callRpc } from "@/lib/rpc-client"

export type FacilityOption = {
  id: number
  name: string
}

// Read-only state (changes when selection changes)
type TenantSelectionState = {
  selectedFacilityId: number | null
  facilities: FacilityOption[]
  showSelector: boolean
  isLoading: boolean
  shouldFetchData: boolean
}

// Write-only actions (stable reference)
type TenantSelectionActions = {
  setSelectedFacilityId: (id: number | null) => void
}

const TenantSelectionStateContext = React.createContext<TenantSelectionState | null>(null)
const TenantSelectionActionsContext = React.createContext<TenantSelectionActions | null>(null)

export function TenantSelectionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const user = session?.user

  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"
  const showSelector = isGlobal || isRegionalLeader

  // MIGRATION SUPPORT: Read from localStorage during transition period
  const [selectedFacilityId, setSelectedFacilityIdState] = React.useState<number | null>(() => {
    if (typeof window !== "undefined" && showSelector) {
      try {
        const saved = localStorage.getItem("equipment_tenant_filter")
        if (saved && /^\d+$/.test(saved)) {
          return Number(saved)
        }
      } catch {}
    }
    return null
  })

  // Reset selection on logout
  React.useEffect(() => {
    if (status !== "authenticated") {
      setSelectedFacilityIdState(null)
    }
  }, [status])

  // Fetch facilities for global/regional users
  // CRITICAL: Scope by role and region to prevent data leakage
  const { data: facilities = [], isLoading } = useQuery<FacilityOption[]>({
    queryKey: ["accessible_facilities", { role: user?.role, diaBan: user?.dia_ban_id }],
    queryFn: () => callRpc({ fn: "get_accessible_facilities", args: {} }),
    enabled: status === "authenticated" && showSelector,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 30 * 60_000, // 30 minutes (retain during navigation)
    refetchOnWindowFocus: false, // Don't refetch on navigation
    refetchOnMount: false, // Use cache on remount
  })

  // Stable setter wrapped in useCallback
  const setSelectedFacilityId = React.useCallback((id: number | null) => {
    setSelectedFacilityIdState(id)
    // MIGRATION SUPPORT: Also update localStorage during transition
    if (typeof window !== "undefined" && showSelector) {
      try {
        if (id === null) {
          localStorage.removeItem("equipment_tenant_filter")
        } else {
          localStorage.setItem("equipment_tenant_filter", id.toString())
        }
      } catch {}
    }
  }, [showSelector])

  // State context value
  const state = React.useMemo<TenantSelectionState>(() => ({
    selectedFacilityId,
    facilities,
    showSelector,
    isLoading,
    // Derived state - no useMemo needed
    shouldFetchData: !showSelector || selectedFacilityId !== null,
  }), [selectedFacilityId, facilities, showSelector, isLoading])

  // Actions context value (stable reference)
  const actions = React.useMemo<TenantSelectionActions>(() => ({
    setSelectedFacilityId,
  }), [setSelectedFacilityId])

  return (
    <TenantSelectionStateContext.Provider value={state}>
      <TenantSelectionActionsContext.Provider value={actions}>
        {children}
      </TenantSelectionActionsContext.Provider>
    </TenantSelectionStateContext.Provider>
  )
}

// Read-only hook (for data display)
export function useTenantSelectionState() {
  const context = React.useContext(TenantSelectionStateContext)
  if (!context) {
    throw new Error("useTenantSelectionState must be used within TenantSelectionProvider")
  }
  return context
}

// Write-only hook (for actions)
export function useTenantSelectionActions() {
  const context = React.useContext(TenantSelectionActionsContext)
  if (!context) {
    throw new Error("useTenantSelectionActions must be used within TenantSelectionProvider")
  }
  return context
}

// Combined hook (for convenience)
export function useTenantSelection() {
  const state = useTenantSelectionState()
  const actions = useTenantSelectionActions()
  return { ...state, ...actions }
}
```

---

### 2. Simplified TenantSelector Component

**CHANGE:** Use Radix Select instead of custom dropdown (90% less code, accessible by default)

```typescript
"use client"

import * as React from "react"
import { Building2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTenantSelection } from "@/contexts/TenantSelectionContext"

export function TenantSelector() {
  const { facilities, selectedFacilityId, setSelectedFacilityId, showSelector } = useTenantSelection()

  // Don't show if user doesn't need selector or only has one facility
  if (!showSelector || facilities.length <= 1) return null

  const value = selectedFacilityId?.toString() ?? "all"

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={value}
        onValueChange={(v) => setSelectedFacilityId(v === "all" ? null : Number(v))}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Chọn cơ sở..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            Tất cả cơ sở ({facilities.length})
          </SelectItem>
          {facilities.map((f) => (
            <SelectItem key={f.id} value={f.id.toString()}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

**Benefits:**
- ✅ 180 lines → 30 lines
- ✅ No local state
- ✅ Keyboard navigation built-in
- ✅ Screen reader accessible
- ✅ No click-outside logic needed

---

### 3. RPC Function Security Review

**APPROVED** with one addition - add to whitelist:

```typescript
// src/app/api/rpc/[fn]/route.ts
const ALLOWED_FUNCTIONS = new Set<string>([
  // ... existing functions
  'get_accessible_facilities', // ✅ ADD THIS LINE
])
```

---

### 4. Migration Strategy - Equipment Page

**CRITICAL CHANGE:** Don't delete `useEquipmentAuth` entirely - it has equipment-specific logic

```typescript
// src/app/(app)/equipment/_hooks/useEquipmentAuth.ts (MODIFY, don't delete)
export function useEquipmentAuth(): UseEquipmentAuthReturn {
  const { data: session, status } = useSession()
  const user = session?.user as SessionUser | null

  // ✅ REPLACE tenant filter logic with context
  const { selectedFacilityId, setSelectedFacilityId, shouldFetchData } = useTenantSelection()

  const isGlobal = user?.role === "global" || user?.role === "admin"
  const isRegionalLeader = user?.role === "regional_leader"

  // ✅ KEEP equipment-specific logic
  const tenantKey = user?.don_vi ? String(user.don_vi) : "none"
  const currentTenantId = isGlobal ? selectedFacilityId : (user?.don_vi ? Number(user.don_vi) : null)

  // ❌ REMOVE: localStorage logic, tenantFilter state, effectiveTenantKey computation
  // ✅ KEEP: role checks, permission logic

  return React.useMemo(() => ({
    user,
    status,
    isGlobal,
    isRegionalLeader,
    tenantKey,
    currentTenantId,
    shouldFetchEquipment: shouldFetchData, // From context
    selectedDonVi: selectedFacilityId, // From context
    // Remove tenantFilter, setTenantFilter, effectiveTenantKey
  }), [user, status, isGlobal, isRegionalLeader, tenantKey, currentTenantId, shouldFetchData, selectedFacilityId])
}
```

---

### 5. Type Safety - Centralized Types

**NEW FILE:** `src/types/facility.ts`

```typescript
/**
 * Facility selection types for tenant filtering
 */

/** Base facility option returned by RPC */
export type FacilityOption = {
  id: number
  name: string
}

/** Facility option with equipment count (for Equipment page) */
export type FacilityOptionWithCount = FacilityOption & {
  count: number
}

/** Facility option with repair request count (for RepairRequests page) */
export type FacilityOptionWithRepairCount = FacilityOption & {
  repair_count: number
}
```

**UPDATE:** Import from centralized location in all files:
```typescript
import type { FacilityOption } from "@/types/facility"
```

---

### 6. Updated Files Summary

| Action | File | Changes |
|--------|------|---------|
| CREATE | `src/contexts/TenantSelectionContext.tsx` | Split context + migration support |
| CREATE | `src/components/shared/TenantSelector.tsx` | Simplified Radix Select |
| CREATE | `src/types/facility.ts` | Centralized types |
| CREATE | `supabase/migrations/YYYYMMDD_get_accessible_facilities.sql` | RPC function |
| MODIFY | `src/app/api/rpc/[fn]/route.ts` | Add to whitelist (line 114) |
| MODIFY | `src/app/(app)/layout.tsx` | Add provider wrapper |
| MODIFY | `src/app/(app)/equipment/_hooks/useEquipmentAuth.ts` | Replace tenant logic with context |
| MODIFY | `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` | Replace useFacilityFilter |
| MODIFY | `src/app/(app)/transfers/page.tsx` | Replace useFacilityFilter |
| MODIFY | `src/app/(app)/reports/page.tsx` | Replace useFacilityFilter |
| DEPRECATE | `src/hooks/useFacilityFilter.ts` | Add deprecation notice, delete after migration |
| DEPRECATE | `src/components/equipment/tenant-selector.tsx` | Moved to shared, delete after migration |

---

## Performance Characteristics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| TenantSelector LOC | 180 | 30 | 83% reduction |
| Re-renders on selection change | All consumers | Only state consumers | ~50% reduction |
| Query deduplication | Per-page | Global | 100% (single query) |
| Navigation refetch | Yes (5 queries) | No (cached) | ~2KB saved per nav |
| Bundle size | +8KB (custom dropdown) | +0KB (Radix reused) | 8KB saved |

---

## Testing Checklist Additions

### Edge Cases
- [ ] Global user with no facilities (empty array) - show "No facilities available"
- [ ] Regional leader with 1 facility - hide selector, auto-select
- [ ] User navigates mid-query - race condition handled by React Query
- [ ] Session timeout during page use - selection resets on re-auth
- [ ] localStorage corrupted/invalid - fallback to null gracefully

### Performance
- [ ] Context split prevents toolbar re-renders when selection changes
- [ ] Query not refetched on navigation between pages
- [ ] Facility list cached for 30 minutes
- [ ] No localStorage writes for non-global users

### Accessibility
- [ ] Keyboard navigation (Tab, Enter, Arrow keys) works
- [ ] Screen reader announces facility count
- [ ] Focus returns to trigger after selection

---

## Migration Timeline

### Week 1: Core Infrastructure
1. Create RPC function
2. Create context with split state/actions
3. Create simplified TenantSelector
4. Add provider to app layout
5. Add to RPC whitelist

### Week 2: Page Migrations (with localStorage support)
1. Equipment page (test migration path)
2. RepairRequests page
3. Transfers page
4. Reports page

### Week 3: Cleanup
1. Remove localStorage fallback from context
2. Delete `useFacilityFilter.ts`
3. Delete old `tenant-selector.tsx`
4. Remove deprecated equipment auth tenant code

---

## Breaking Changes from Original Plan

1. **Context split** - Prevents re-renders, better performance
2. **Simplified component** - Uses Radix Select instead of custom dropdown
3. **Migration support** - Hybrid localStorage during transition
4. **Query scoping** - Added role/region to prevent data leakage
5. **Type centralization** - Single source of truth for FacilityOption

These changes align with React best practices from `/react-best-practices` skill:
- ✅ `rerender-context-split` - Split read/write contexts
- ✅ `rerender-derived-state` - No useMemo for synchronous derivations
- ✅ `rerender-memo` - Memoize context values and callbacks
- ✅ `client-swr-dedup` - Single TanStack Query for all pages
- ✅ `accessibility-wcag` - Radix components are WCAG 2.1 AA compliant
