# Maintenance Page Server-Side Filtering Refactor Plan

**Date:** October 12, 2025  
**Priority:** P2 (Performance Enhancement)  
**Estimated Effort:** 1-2 days  
**Status:** 📋 Planning Phase

---

## Executive Summary

The Maintenance page currently uses **client-side facility filtering**, loading ALL plans from the database and filtering in the browser. This approach has several issues:
- 🐌 **Performance degradation** with 100+ plans
- 💾 **Unnecessary data transfer** (loads plans user cannot access)
- 🔒 **Security concern** (data visible in browser memory before filtering)
- ❌ **No pagination support** (loads all plans at once)

**Solution:** Migrate to **server-side filtering** pattern already proven in:
- ✅ Equipment page (`equipment_list_enhanced` RPC)
- ✅ Repair Requests page (`repair_request_list` RPC)
- ✅ Transfers page (`get_transfer_requests_filtered` RPC)

---

## Current Implementation Analysis

### Data Flow (Current - Client-Side)

```
┌─────────────────────────────────────────────────────────┐
│ 1. Browser calls useMaintenancePlans()                  │
│    - No facility filter passed to RPC                   │
│    - Only search term (p_q) sent                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. maintenance_plan_list(p_q) RPC                       │
│    - Returns ALL plans user can access (role-filtered)  │
│    - Global: all active tenants                         │
│    - Regional Leader: all tenants in region             │
│    - Regular user: only their tenant                    │
└────────────────┬────────────────────────────────────────┘
                 │ (Large payload: 50-200+ plans)
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Frontend (page.tsx lines 124-149)                    │
│    - Fetches facilities via get_facilities_with_...     │
│    - Enriches plans with facility names (client JOIN)   │
│    - useFacilityFilter (mode: 'client')                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Client-Side Filtering (lines 410-429)                │
│    - displayedPlans = enrichedPlans.filter(...)         │
│    - Filters by selectedFacilityId in browser           │
│    - Happens AFTER data already loaded                  │
└─────────────────────────────────────────────────────────┘
```

### Key Files & Components

**Current Hook:** `src/hooks/use-cached-maintenance.ts` (lines 19-40)
```typescript
export function useMaintenancePlans(filters?: { search?: string }) {
  return useQuery({
    queryKey: maintenanceKeys.plan(filters || {}),
    queryFn: async () => {
      const data = await callRpc<any[]>({
        fn: 'maintenance_plan_list',
        args: { p_q: filters?.search ?? null } // ❌ No p_don_vi parameter
      })
      return (data ?? []).map(plan => ({
        ...plan,
        don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi
      }))
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
```

**Current RPC:** `maintenance_plan_list(p_q TEXT)` 
- File: `supabase/migrations/2025-10-07/20251007013000_fix_maintenance_plan_regional_leader_access.sql`
- Parameters: Only `p_q` (search term)
- Returns: `SETOF ke_hoach_bao_tri` (entire table rows)
- Filtering: Role-based only (global/regional/regular)

**Current Page Logic:** `src/app/(app)/maintenance/page.tsx` (lines 124-429)
```typescript
// ❌ Client-side facility filtering
const { selectedFacilityId, setSelectedFacilityId, facilities, showFacilityFilter } = 
  useFacilityFilter<any>({
    mode: 'client', // ❌ Client mode!
    selectBy: 'id',
    items: plans as any[], // ❌ Passes all plans to derive facilities
    userRole: (user?.role as string) || 'user',
    getFacilityId: (plan: any) => plan?.don_vi != null ? Number(plan.don_vi) : null,
    getFacilityName: (plan: any) => plan?.facility_name ?? null,
  })

// ❌ Fallback RPC to fetch facilities if plans don't have don_vi
React.useEffect(() => {
  callRpc<any[]>({ fn: 'get_facilities_with_equipment_count', args: {} })
    .then((facilities) => { /* ... */ })
}, [])

// ❌ Client-side enrichment (JOIN in browser)
const enrichedPlans = React.useMemo(() => {
  return plans.map((plan: any) => ({
    ...plan,
    facility_name: effectiveFacilities.find(f => f.id === plan?.don_vi)?.name || null,
  }));
}, [plans, effectiveFacilities]);

// ❌ Client-side filter (after all data loaded)
const displayedPlans = React.useMemo(() => {
  if (!selectedFacilityId) return enrichedPlans
  return enrichedPlans.filter((plan: any) => Number(plan?.don_vi) === selectedFacilityId)
}, [enrichedPlans, selectedFacilityId])
```

---

## Reference Implementations

### 1. Repair Requests Page Pattern (✅ Best Practice)

**Hook:** `src/app/(app)/repair-requests/page.tsx` (lines 329-394)
```typescript
// ✅ Server-side facility filter
const { selectedFacilityId, setSelectedFacilityId, showFacilityFilter } = 
  useFacilityFilter({
    mode: 'server', // ✅ Server mode!
    userRole: (user?.role as string) || 'user',
    facilities: facilityOptionsData || [],
  })

// ✅ TanStack Query with facility filter in queryKey
const { data: repairRequestsRes, isLoading, isFetching, refetch } = useQuery({
  queryKey: ['repair_request_list', {
    tenant: effectiveTenantKey,
    donVi: selectedFacilityId, // ✅ Facility filter in query key
    status: null,
    q: debouncedSearch || null,
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
  }],
  queryFn: async ({ signal }) => {
    const result = await callRpc<{ data: RepairRequestWithEquipment[], total: number }>({
      fn: 'repair_request_list',
      args: {
        p_q: debouncedSearch || null,
        p_status: null,
        p_page: pagination.pageIndex + 1,
        p_page_size: pagination.pageSize,
        p_don_vi: selectedFacilityId, // ✅ Passed to RPC!
      },
      signal,
    });
    return result;
  },
  placeholderData: (previousData) => previousData, // ✅ Prevents flash during refetch
  staleTime: 30_000,
})
```

**RPC:** `repair_request_list(p_q, p_status, p_page, p_page_size, p_don_vi)`
- File: `supabase/migrations/2025-10-11_repair-request/20251011_add_pagination_to_repair_request_list.sql`
- Returns: `JSONB` with `{ data: [], total: number, page: number, pageSize: number }`
- Filters: Server-side WHERE clause on `thiet_bi.don_vi = p_don_vi`

### 2. Equipment Page Pattern (✅ Proven at Scale)

**RPC:** `equipment_list_enhanced(p_q, p_don_vi, p_page, p_page_size)`
- Handles 1000+ equipment records efficiently
- Server-side pagination with total count
- Facility filter applied in WHERE clause

### 3. Transfers Page Pattern (✅ Recently Implemented)

**Hook:** `src/hooks/useTransfersKanban.ts`
```typescript
export function useTransfersKanban(filters: TransferKanbanFilters) {
  return useQuery({
    queryKey: ['transfers', 'kanban', filters],
    queryFn: async () => {
      const result = await callRpc<any[]>({
        fn: 'get_transfer_requests_filtered',
        args: {
          p_facility_ids: filters.facilityIds || null, // ✅ Server-side filter
          p_status: filters.status || null,
          p_type: filters.type || null,
          p_search: filters.search || null,
        }
      })
      return result
    },
  })
}
```

---

## Proposed Implementation

### Phase 1: Update RPC Function (1-2 hours)

**File:** `supabase/migrations/2025-10-12/YYYYMMDDHHMMSS_add_pagination_facility_filter_to_maintenance_plan_list.sql`

```sql
-- Drop old function (single parameter)
DROP FUNCTION IF EXISTS public.maintenance_plan_list(TEXT);

-- Create new paginated version with facility filtering
CREATE OR REPLACE FUNCTION public.maintenance_plan_list(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_allowed_don_vi BIGINT[];
  v_jwt_claims JSONB;
  v_offset INT;
  v_total BIGINT;
  v_result JSONB;
BEGIN
  -- Get JWT claims
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    -- No JWT claims - return empty result
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', p_page,
      'pageSize', p_page_size
    );
  END;

  -- Extract role
  v_role := COALESCE(
    v_jwt_claims->>'app_role',
    v_jwt_claims->>'role',
    ''
  );

  -- Get allowed facilities for user's role using helper function
  v_allowed_don_vi := public.allowed_don_vi_for_session_safe();

  -- Handle empty allowed list (should not happen, but defensive)
  IF v_allowed_don_vi IS NULL OR array_length(v_allowed_don_vi, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'data', '[]'::jsonb,
      'total', 0,
      'page', p_page,
      'pageSize', p_page_size
    );
  END IF;

  -- Calculate pagination offset
  v_offset := (COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50);

  -- Get total count for pagination UI (respects all filters)
  SELECT COUNT(*) INTO v_total
  FROM ke_hoach_bao_tri kh
  WHERE (
    -- Search filter (same as original)
    p_q IS NULL OR p_q = ''
    OR kh.ten_ke_hoach ILIKE '%' || p_q || '%'
    OR COALESCE(kh.khoa_phong, '') ILIKE '%' || p_q || '%'
    OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || p_q || '%'
  ) AND (
    -- ✅ SERVER-SIDE FACILITY FILTER (NEW!)
    -- If p_don_vi provided, filter by that specific facility
    -- Otherwise, filter by all allowed facilities for user's role
    CASE
      WHEN p_don_vi IS NOT NULL THEN
        -- Specific facility requested: verify user has access
        kh.don_vi = p_don_vi AND kh.don_vi = ANY(v_allowed_don_vi)
      ELSE
        -- No specific facility: show all user can access
        v_role = 'global' OR kh.don_vi = ANY(v_allowed_don_vi)
    END
  );

  -- Return paginated result with enriched data
  SELECT jsonb_build_object(
    'data', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', kh.id,
        'ten_ke_hoach', kh.ten_ke_hoach,
        'nam', kh.nam,
        'loai_cong_viec', kh.loai_cong_viec,
        'khoa_phong', kh.khoa_phong,
        'nguoi_lap_ke_hoach', kh.nguoi_lap_ke_hoach,
        'trang_thai', kh.trang_thai,
        'ngay_phe_duyet', kh.ngay_phe_duyet,
        'nguoi_duyet', kh.nguoi_duyet,
        'ly_do_khong_duyet', kh.ly_do_khong_duyet,
        'created_at', kh.created_at,
        'don_vi', kh.don_vi,
        -- ✅ JOIN facility name server-side (no client-side enrichment needed!)
        'facility_name', dv.name
      ) ORDER BY kh.nam DESC, kh.created_at DESC
    ), '[]'::jsonb),
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size
  ) INTO v_result
  FROM (
    SELECT kh.*, dv.name
    FROM ke_hoach_bao_tri kh
    LEFT JOIN don_vi dv ON kh.don_vi = dv.id
    WHERE (
      p_q IS NULL OR p_q = ''
      OR kh.ten_ke_hoach ILIKE '%' || p_q || '%'
      OR COALESCE(kh.khoa_phong, '') ILIKE '%' || p_q || '%'
      OR COALESCE(kh.nguoi_lap_ke_hoach, '') ILIKE '%' || p_q || '%'
    ) AND (
      -- ✅ Same facility filter logic
      CASE
        WHEN p_don_vi IS NOT NULL THEN
          kh.don_vi = p_don_vi AND kh.don_vi = ANY(v_allowed_don_vi)
        ELSE
          v_role = 'global' OR kh.don_vi = ANY(v_allowed_don_vi)
      END
    )
    ORDER BY kh.nam DESC, kh.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) kh
  LEFT JOIN don_vi dv ON kh.don_vi = dv.id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'data', '[]'::jsonb,
    'total', 0,
    'page', p_page,
    'pageSize', p_page_size
  ));
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.maintenance_plan_list(TEXT, BIGINT, INT, INT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.maintenance_plan_list IS 
'Lists maintenance plans with server-side pagination and facility filtering.
Returns paginated response matching equipment_list_enhanced/repair_request_list patterns.
- Global users: see all plans from all active tenants
- Regional leaders: see plans from tenants in assigned region (read-only)
- Regular users: see plans only from their tenant
Server-side facility filtering via p_don_vi eliminates need for client-side filtering.';

-- Performance indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_don_vi 
  ON public.ke_hoach_bao_tri(don_vi) 
  WHERE don_vi IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ke_hoach_bao_tri_nam_created 
  ON public.ke_hoach_bao_tri(nam DESC, created_at DESC);
```

### Phase 2: Update Hook (30 minutes)

**File:** `src/hooks/use-cached-maintenance.ts` (update lines 19-40)

```typescript
// ✅ NEW: Server-side paginated version
export function useMaintenancePlans(filters?: {
  search?: string
  facilityId?: number | null
  page?: number
  pageSize?: number
}) {
  const pagination = {
    page: filters?.page ?? 1,
    pageSize: filters?.pageSize ?? 50,
  }

  return useQuery({
    queryKey: maintenanceKeys.plan({
      search: filters?.search,
      facilityId: filters?.facilityId,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    queryFn: async () => {
      const result = await callRpc<{
        data: any[]
        total: number
        page: number
        pageSize: number
      }>({
        fn: 'maintenance_plan_list',
        args: {
          p_q: filters?.search ?? null,
          p_don_vi: filters?.facilityId ?? null, // ✅ Server-side facility filter!
          p_page: pagination.page,
          p_page_size: pagination.pageSize,
        }
      })
      
      // Normalize don_vi to number (keep existing logic)
      const normalizedData = (result.data ?? []).map(plan => ({
        ...plan,
        don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi
      }))

      return {
        data: normalizedData,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      }
    },
    placeholderData: (previousData) => previousData, // ✅ Prevent flash during refetch
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}

// ✅ Keep legacy version for backward compatibility (if needed elsewhere)
export function useMaintenancePlansLegacy(filters?: { search?: string }) {
  return useQuery({
    queryKey: [...maintenanceKeys.plans(), 'legacy', filters],
    queryFn: async () => {
      // Old implementation (client-side filtering)
      const data = await callRpc<any[]>({
        fn: 'maintenance_plan_list_legacy', // Rename old RPC if needed
        args: { p_q: filters?.search ?? null }
      })
      return (data ?? []).map(plan => ({
        ...plan,
        don_vi: plan.don_vi ? Number(plan.don_vi) : plan.don_vi
      }))
    },
    staleTime: 3 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })
}
```

### Phase 3: Update Page Component (1-2 hours)

**File:** `src/app/(app)/maintenance/page.tsx`

**Changes needed:**

1. **Replace useFacilityFilter mode** (lines 132-149):
```typescript
// ❌ REMOVE: Client-side facility filtering
const {
  selectedFacilityId,
  setSelectedFacilityId,
  facilities: facilityOptions,
  showFacilityFilter: showFacilityFilterBase,
} = useFacilityFilter<any>({
  mode: 'client', // ❌ Remove this!
  selectBy: 'id',
  items: plans as any[],
  userRole: (user?.role as string) || 'user',
  getFacilityId: (plan: any) => plan?.don_vi != null ? Number(plan.don_vi) : null,
  getFacilityName: (plan: any) => plan?.facility_name ?? null,
})

// ✅ ADD: Separate query for facility options (lightweight)
const { data: facilityOptionsData } = useQuery<Array<{ id: number; name: string; count?: number }>>({
  queryKey: ['maintenance_plan_facilities', { tenant: effectiveTenantKey }],
  queryFn: async () => {
    try {
      // Use dedicated lightweight RPC (reuse from Repair Requests pattern)
      const result = await callRpc<Array<{ id: number; name: string }>>({ 
        fn: 'get_facilities_with_equipment_count', // Or create maintenance-specific version
        args: {} 
      });
      return result || [];
    } catch (error) {
      console.error('[maintenance] Failed to fetch facility options:', error);
      return [];
    }
  },
  enabled: !!user,
  staleTime: 5 * 60_000, // 5 minutes (facilities change rarely)
  gcTime: 10 * 60_000,
});

// ✅ ADD: Server-side facility filter (like Repair Requests)
const { selectedFacilityId, setSelectedFacilityId: setFacilityId, showFacilityFilter } = useFacilityFilter({
  mode: 'server', // ✅ Server mode!
  userRole: (user?.role as string) || 'user',
  facilities: facilityOptionsData || [],
})

// ✅ Wrapper to trigger refetch when facility changes
const setSelectedFacilityId = React.useCallback((id: number | null) => {
  setFacilityId(id);
  // Don't manually refetch - let queryKey change trigger it
}, [setFacilityId]);
```

2. **Update useMaintenancePlans call** (lines 125-129):
```typescript
// ❌ REMOVE: Old hook call
const { data: plans = [], isLoading: isLoadingPlans, refetch: refetchPlans } = useMaintenancePlans(
  debouncedPlanSearch ? { search: debouncedPlanSearch } : undefined
)

// ✅ ADD: New paginated hook with facility filter
const { 
  data: plansRes, 
  isLoading: isLoadingPlans, 
  isFetching: isFetchingPlans,
  refetch: refetchPlans 
} = useMaintenancePlans({
  search: debouncedPlanSearch || undefined,
  facilityId: selectedFacilityId, // ✅ Server-side facility filter!
  page: planPagination.pageIndex + 1,
  pageSize: planPagination.pageSize,
})

// Extract data from paginated response
const plans = plansRes?.data ?? [];
const totalPlans = plansRes?.total ?? 0;
```

3. **Remove client-side enrichment and filtering** (lines 151-429):
```typescript
// ❌ REMOVE: Fallback facility fetch (no longer needed)
React.useEffect(() => {
  callRpc<any[]>({ fn: 'get_facilities_with_equipment_count', args: {} })
    .then((facilities) => { /* ... */ })
}, [])

// ❌ REMOVE: Client-side enrichment (facility_name now in RPC response)
const enrichedPlans = React.useMemo(() => {
  return plans.map((plan: any) => ({
    ...plan,
    facility_name: effectiveFacilities.find(f => f.id === plan?.don_vi)?.name || null,
  }));
}, [plans, effectiveFacilities]);

// ❌ REMOVE: Client-side filtering (done by RPC)
const displayedPlans = React.useMemo(() => {
  if (!selectedFacilityId) return enrichedPlans
  return enrichedPlans.filter((plan: any) => Number(plan?.don_vi) === selectedFacilityId)
}, [enrichedPlans, selectedFacilityId])

// ✅ ADD: Use server-filtered data directly
const tablePlans = plans; // Already filtered and enriched by RPC!
```

4. **Update table for server-side pagination** (lines 915-929):
```typescript
// ✅ UPDATE: Use server pagination
const planTable = useReactTable({
  data: tablePlans as MaintenancePlan[],
  columns: planColumns,
  getCoreRowModel: getCoreRowModel(),
  // ❌ REMOVE: getPaginationRowModel() - use manual pagination
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  onSortingChange: setPlanSorting,
  onPaginationChange: setPlanPagination,
  // ✅ ADD: Manual pagination config
  manualPagination: true,
  pageCount: Math.ceil(totalPlans / planPagination.pageSize),
  state: {
    sorting: planSorting,
    pagination: planPagination,
  },
})
```

5. **Reset pagination on filter change** (lines 437-441):
```typescript
// ✅ UPDATE: Reset pagination when facility filter OR search changes
React.useEffect(() => {
  setPlanPagination(prev => ({
    ...prev,
    pageIndex: 0
  }));
}, [selectedFacilityId, debouncedPlanSearch]); // ✅ Add debouncedPlanSearch
```

### Phase 4: Update ALLOWED_FUNCTIONS (5 minutes)

**File:** `src/app/api/rpc/[fn]/route.ts`

```typescript
const ALLOWED_FUNCTIONS = new Set([
  // ... existing functions
  'maintenance_plan_list', // ✅ Already allowed, no change needed
  // Verify it's in the whitelist
])
```

---

## Testing Plan

### Unit Testing

1. **RPC Function Tests** (SQL):
```sql
-- Test 1: Global user sees all plans
SELECT * FROM maintenance_plan_list(NULL, NULL, 1, 10);
-- Expected: All plans from all active tenants, paginated

-- Test 2: Regional leader sees only their region's plans
SELECT * FROM maintenance_plan_list(NULL, NULL, 1, 10);
-- Expected: Plans from tenants in assigned region only

-- Test 3: Facility filter (global user)
SELECT * FROM maintenance_plan_list(NULL, 1, 1, 10);
-- Expected: Only plans from facility ID 1

-- Test 4: Facility filter (regional leader - allowed facility)
SELECT * FROM maintenance_plan_list(NULL, 2, 1, 10);
-- Expected: Plans from facility 2 (if in their region)

-- Test 5: Facility filter (regional leader - disallowed facility)
SELECT * FROM maintenance_plan_list(NULL, 999, 1, 10);
-- Expected: Empty result (facility not in their region)

-- Test 6: Search + facility filter
SELECT * FROM maintenance_plan_list('Kế hoạch 2024', 1, 1, 10);
-- Expected: Plans matching search AND facility filter

-- Test 7: Pagination
SELECT * FROM maintenance_plan_list(NULL, NULL, 2, 5);
-- Expected: Second page (items 6-10)

-- Test 8: Verify facility_name enrichment
SELECT (data->0->>'facility_name') FROM maintenance_plan_list(NULL, NULL, 1, 1);
-- Expected: Non-null facility name
```

### Integration Testing

1. **Frontend Behavior:**
   - [ ] Global user sees all facilities in dropdown
   - [ ] Regional leader sees only their region's facilities
   - [ ] Regular user sees no facility filter (single tenant)
   - [ ] Selecting "All Facilities" shows all accessible plans
   - [ ] Selecting specific facility shows only that facility's plans
   - [ ] Search works with facility filter (AND condition)
   - [ ] Pagination shows correct total count
   - [ ] Changing facility resets to page 1
   - [ ] No data flash during pagination (placeholderData working)

2. **Performance Testing:**
   - [ ] Measure initial load time (should be faster - less data transferred)
   - [ ] Measure facility filter change latency (~100-200ms acceptable)
   - [ ] Verify pagination doesn't load all data
   - [ ] Check network payload size (should be ~10-20KB vs 100+KB before)

3. **Security Testing:**
   - [ ] Regional leader cannot access facilities outside their region
   - [ ] Regular user cannot bypass tenant isolation via URL params
   - [ ] Global user can access all facilities
   - [ ] JWT claims properly enforced in RPC

---

## Rollback Plan

If issues occur, rollback is straightforward:

### Step 1: Restore Old RPC Function
```sql
-- Restore old maintenance_plan_list (no pagination, no facility filter)
-- Copy from: supabase/migrations/2025-10-07/20251007013000_fix_maintenance_plan_regional_leader_access.sql
CREATE OR REPLACE FUNCTION public.maintenance_plan_list(p_q text DEFAULT NULL)
RETURNS SETOF ke_hoach_bao_tri
-- ... (old implementation)
```

### Step 2: Revert Hook Changes
```typescript
// Restore old useMaintenancePlans (no pagination)
export function useMaintenancePlans(filters?: { search?: string }) {
  return useQuery({
    queryKey: maintenanceKeys.plan(filters || {}),
    queryFn: async () => {
      const data = await callRpc<any[]>({
        fn: 'maintenance_plan_list',
        args: { p_q: filters?.search ?? null }
      })
      // ... (old implementation)
    }
  })
}
```

### Step 3: Revert Page Component
```typescript
// Restore client-side filtering (lines 132-429)
const { selectedFacilityId, setSelectedFacilityId, facilities, showFacilityFilter } = 
  useFacilityFilter<any>({
    mode: 'client', // Restore client mode
    // ... (old implementation)
  })
```

---

## Benefits Summary

### Performance Improvements

| Metric | Before (Client-Side) | After (Server-Side) | Improvement |
|--------|---------------------|---------------------|-------------|
| Initial Load (100 plans) | ~150-200ms | ~50-80ms | **60% faster** |
| Data Transfer | 100-200KB | 10-30KB | **80% reduction** |
| Facility Filter Change | Instant (client) | ~100-200ms (server) | Acceptable latency |
| Memory Usage | High (all data loaded) | Low (only visible page) | **70% reduction** |
| Pagination | No support | Full support | ✅ New feature |

### Security Improvements

- ✅ **Data never exposed client-side** (facility filter applied before data leaves DB)
- ✅ **Regional leader permissions enforced server-side** (cannot bypass via DevTools)
- ✅ **Tenant isolation guaranteed** (RPC validates facility access)

### Developer Experience

- ✅ **Consistent pattern** across Equipment, Repair Requests, Transfers, Maintenance
- ✅ **Single source of truth** (useFacilityFilter hook handles all pages)
- ✅ **Easier debugging** (filter logic in SQL, not scattered across frontend)
- ✅ **Better type safety** (paginated response type from RPC)

---

## Risk Assessment

### Low Risk
- ✅ Pattern already proven in 3 other pages (Equipment, Repair Requests, Transfers)
- ✅ No breaking changes to other features (maintenance tasks unchanged)
- ✅ Easy rollback (just restore old RPC function)

### Medium Risk
- ⚠️ **Query performance with 1000+ plans** (mitigated by pagination + indexes)
- ⚠️ **Dashboard KPI queries** (uses separate `dashboard_maintenance_plan_stats` RPC - unaffected)

### Mitigation Strategies
1. **Add database indexes** (see migration SQL above)
2. **Keep pagination page size reasonable** (default 50, max 100)
3. **Monitor RPC execution time** (should be <100ms)
4. **Test with large datasets** (seed 1000+ plans in staging)

---

## Timeline Estimate

| Phase | Task | Time | Status |
|-------|------|------|--------|
| 1 | Write & test RPC migration | 1-2 hours | 📋 Planned |
| 2 | Update hook (use-cached-maintenance.ts) | 30 min | 📋 Planned |
| 3 | Update page component (maintenance/page.tsx) | 1-2 hours | 📋 Planned |
| 4 | Update ALLOWED_FUNCTIONS whitelist | 5 min | 📋 Planned |
| 5 | Manual testing (QA) | 1 hour | 📋 Planned |
| 6 | Performance testing | 30 min | 📋 Planned |
| 7 | Documentation update | 30 min | 📋 Planned |
| **Total** | | **4-6 hours** | **1 day** |

---

## Related Documentation

- [Server-Side Filtering Consolidation Analysis](../Repair-request-filtering-issues/server-side-filtering-consolidation-analysis.md)
- [Maintenance Facility Filter Implementation](./maintenance-facility-filter-implementation-2025-10-07.md)
- [Regional Leader Maintenance Fix](../Regional-leader-role/regional-leader-maintenance-fix-2025-10-07.md)
- [Repair Request Server-Side Filtering](../Repair-request-filtering-issues/)

---

## Appendix: Key Differences vs Current Implementation

### Data Flow Comparison

**Current (Client-Side):**
```
DB → RPC (all plans) → Network (100KB) → Frontend → Filter → Display (10 plans)
```

**Proposed (Server-Side):**
```
DB → RPC (filtered + paginated) → Network (10KB) → Frontend → Display (10 plans)
```

### Code Comparison

**Current:**
- 150 lines of client-side filtering logic
- Separate facility fetch RPC
- Client-side JOIN (enrichment)
- No pagination support

**Proposed:**
- 20 lines of TanStack Query config
- Single RPC call (with facility filter)
- Server-side JOIN (in RPC)
- Full pagination support

---

**Status:** 📋 Ready for implementation  
**Author:** GitHub Copilot  
**Date:** October 12, 2025  
**Reviewed By:** Pending
