# Transfers Kanban: Current State Analysis

**Date:** October 11, 2025  
**Branch:** feat/rpc-enhancement  
**Status:** Pre-implementation analysis  

---

## Executive Summary

The Transfers page currently uses **CLIENT-SIDE facility filtering only**, unlike the Repair Requests page which has **SERVER-SIDE filtering with pagination**. Before implementing Phase 0 of the Kanban scalability improvements, we need to decide whether to migrate to server-side filtering first.

---

## Current Architecture Comparison

### Repair Requests Page (SERVER-SIDE) ✅

**RPC Function:** `repair_request_list`
- **Accepts:** `p_don_vi` parameter for server-side facility filtering
- **Returns:** Paginated results with total count
- **Page Size:** Configurable (default 20, max 100)
- **Migration:** `20251011_add_pagination_to_repair_request_list.sql`

**Frontend Pattern:**
```typescript
// Server-side filtering via RPC parameter
const { selectedFacilityId, showFacilityFilter } = useFacilityFilter({
  mode: 'server',
  userRole: user?.role || 'user',
  facilities: facilityOptionsData || [],
})

// Query includes facility filter in args
queryKey: ['repair_request_list', {
  donVi: selectedFacilityId,  // ← Sent to server
  page: pagination.pageIndex + 1,
  pageSize: pagination.pageSize,
}]

// RPC call passes facility filter
await callRpc({
  fn: 'repair_request_list',
  args: {
    p_don_vi: selectedFacilityId,  // ← Server filters here
    p_page: pagination.pageIndex + 1,
    p_page_size: pagination.pageSize,
  }
})
```

**Performance:**
- ✅ Only fetches filtered subset (e.g., 20 records)
- ✅ Server-side pagination reduces payload
- ✅ Fast initial render
- ✅ Scales to 10,000+ records

---

### Transfers Page (CLIENT-SIDE) ⚠️

**RPC Function:** `transfer_request_list_enhanced`
- **Accepts:** `p_don_vi` parameter (exists but not used by frontend)
- **Returns:** ALL records (currently fetches 5000 at once)
- **Page Size:** Hardcoded 5000 in hook
- **Migration:** `202510081450_add_facility_name_to_transfer_list.sql`

**Frontend Pattern:**
```typescript
// Client-side filtering via useFacilityFilter hook
const {
  selectedFacilityId,
  setSelectedFacilityId,
  facilities: facilitiesFromItems,
  showFacilityFilter,
  filteredItems,  // ← Client filters all 5000 records
} = useFacilityFilter<TransferRequest>({
  mode: 'client',  // ← CLIENT MODE
  selectBy: 'id',
  items: transfers,  // ← All 5000 records loaded
  userRole: user?.role || 'user',
  getFacilityId: (t) => t.thiet_bi?.facility_id ?? null,
  getFacilityName: (t) => t.thiet_bi?.facility_name ?? null,
})

// useTransferRequests hook (use-cached-transfers.ts)
const data = await callRpc({
  fn: 'transfer_request_list_enhanced',
  args: {
    p_q: filters?.search ?? null,
    p_status: filters?.trang_thai ?? null,
    p_page: 1,
    p_page_size: 5000,  // ← Fetches ALL records
    p_don_vi: null,  // ← NOT passed (client filters instead)
  }
})
```

**Performance:**
- ⚠️ Fetches ALL 5000 records on page load
- ⚠️ Client filters in JavaScript (slow with large datasets)
- ⚠️ Large initial payload (~500KB+)
- ⚠️ Doesn't scale beyond 5000 records

---

## Key Differences

| Aspect | Repair Requests | Transfers |
|--------|-----------------|-----------|
| **Filtering** | Server-side | Client-side |
| **Initial Fetch** | 20 records | 5000 records |
| **Payload Size** | ~20KB | ~500KB |
| **Pagination** | Server-side | None (all in memory) |
| **Page Size** | 10/20/50/100 | N/A (all loaded) |
| **Scalability** | 10,000+ records | Limited to 5000 |
| **RPC Parameter** | Uses `p_don_vi` | Ignores `p_don_vi` |
| **TanStack Query** | Per-page cache | Single cache for all |

---

## RPC Function Analysis

### `transfer_request_list_enhanced` Already Supports Server-Side Filtering! ✅

**Migration:** `202510081450_add_facility_name_to_transfer_list.sql`

```sql
CREATE OR REPLACE FUNCTION public.transfer_request_list_enhanced(
  p_q TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 100,
  p_don_vi BIGINT DEFAULT NULL,  -- ✅ Facility filter parameter exists!
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_khoa_phong TEXT DEFAULT NULL
)
RETURNS SETOF JSONB
```

**Security Model (Already Implemented):**
```sql
-- Get allowed facilities for this user (handles regional_leader multi-facility access)
v_allowed := public.allowed_don_vi_for_session();

-- Determine effective facility filter
IF v_role = 'global' THEN
  IF p_don_vi IS NOT NULL THEN
    v_effective := ARRAY[p_don_vi];
  ELSE
    v_effective := NULL;  -- All facilities
  END IF;
ELSE
  -- For non-global users (including regional_leader)
  IF p_don_vi IS NOT NULL THEN
    -- Validate requested facility is in allowed list
    IF NOT p_don_vi = ANY(v_allowed) THEN
      RAISE EXCEPTION 'Access denied for tenant %', p_don_vi;
    END IF;
    v_effective := ARRAY[p_don_vi];
  ELSE
    -- Use all allowed facilities (important for regional_leader)
    v_effective := v_allowed;
  END IF;
END IF;

-- Filter query
WHERE (v_effective IS NULL OR tb.don_vi = ANY(v_effective))
```

**Result:**
- ✅ `p_don_vi` parameter already exists
- ✅ Security validation already implemented
- ✅ Pagination already supported (`p_page`, `p_page_size`)
- ✅ Facility name already included in response
- ✅ Regional leader multi-facility access handled

**Frontend just needs to:**
1. Change `mode: 'client'` → `mode: 'server'` in `useFacilityFilter`
2. Pass `p_don_vi: selectedFacilityId` to RPC
3. Reduce `p_page_size: 5000` → `p_page_size: 20` (or configurable)

---

## Decision Point: Should We Migrate to Server-Side Filtering First?

### Option 1: Migrate to Server-Side BEFORE Phase 0 (RECOMMENDED ✅)

**Pros:**
- ✅ Solves root performance problem immediately
- ✅ Reduces initial payload by 250x (5000 → 20 records)
- ✅ Makes Phase 0 implementation cleaner (no client-side filter complexity)
- ✅ Aligns with Repair Requests pattern (consistency)
- ✅ RPC already supports it (no migration needed)
- ✅ Easier to test (fewer moving parts)
- ✅ Phase 0 components can assume server-filtered data

**Cons:**
- ⚠️ Requires modifying `use-cached-transfers.ts` hook
- ⚠️ Requires updating `transfers/page.tsx` to pass `p_don_vi`
- ⚠️ Adds 1-2 hours before starting Phase 0

**Effort:** 1-2 hours

**Files to Modify:**
1. `src/hooks/use-cached-transfers.ts` - Change mode to 'server', pass `p_don_vi`
2. `src/app/(app)/transfers/page.tsx` - Update `useFacilityFilter` to `mode: 'server'`

---

### Option 2: Implement Phase 0 with Client-Side Filtering (NOT RECOMMENDED ⚠️)

**Pros:**
- ✅ Start Phase 0 immediately
- ✅ No changes to data fetching logic

**Cons:**
- ⚠️ Still fetches 5000 records initially (performance problem persists)
- ⚠️ Phase 0 collapsible columns/windowing only reduce DOM, not network payload
- ⚠️ Complex client-side filtering logic remains
- ⚠️ Inconsistent with Repair Requests page
- ⚠️ Will need migration later anyway
- ⚠️ Phase 0 benefits reduced (still large initial fetch)

**Effort:** 0 hours upfront, but deferred complexity

---

## Recommended Approach: Two-Phase Implementation

### Pre-Phase 0: Server-Side Filtering Migration (1-2 hours) ✅

**Goal:** Align Transfers page with Repair Requests pattern

**Tasks:**
1. [ ] Update `useTransferRequests` hook to accept `p_don_vi` parameter
2. [ ] Change `useFacilityFilter` mode from `'client'` → `'server'`
3. [ ] Reduce `p_page_size` from `5000` → `20` (default)
4. [ ] Add pagination state (reuse Repair Requests pattern)
5. [ ] Test with regional_leader role (multi-facility)
6. [ ] Test with global role (all facilities)
7. [ ] Verify facility filter dropdown works

**Expected Results:**
- Initial fetch: 5000 records → 20 records (250x reduction)
- Payload: ~500KB → ~20KB (25x reduction)
- Query time: Faster (less data to process)
- Regional leader: Same behavior (server enforces allowed facilities)

---

### Phase 0: Kanban UX Improvements (2-3 hours)

**Goal:** Immediate relief for large boards (now with server-filtered data)

**Tasks:**
1. [ ] Collapsible Done/Archive columns (header-only + counts)
2. [ ] Per-column windowing (50 initial + "Show more")
3. [ ] Density toggle (compact default)
4. [ ] LocalStorage persistence for preferences

**Components:**
- `src/components/transfers/CollapsibleLane.tsx` (new)
- `src/components/transfers/DensityToggle.tsx` (new)
- Update `src/app/(app)/transfers/page.tsx`

---

## Implementation Checklist

### Pre-Phase 0: Server-Side Filtering

#### 1. Update `use-cached-transfers.ts` Hook

**Current:**
```typescript
export function useTransferRequests(filters?: {
  search?: string
  trang_thai?: string
  // ...
}) {
  const data = await callRpc({
    fn: 'transfer_request_list_enhanced',
    args: {
      p_page: 1,
      p_page_size: 5000,  // ❌ Fetch all
      p_don_vi: null,     // ❌ Ignored
    }
  })
}
```

**After:**
```typescript
export function useTransferRequests(filters?: {
  search?: string
  trang_thai?: string
  don_vi?: number | null  // ✅ Add facility filter
  page?: number           // ✅ Add pagination
  pageSize?: number       // ✅ Configurable page size
}) {
  const data = await callRpc({
    fn: 'transfer_request_list_enhanced',
    args: {
      p_page: filters?.page ?? 1,
      p_page_size: filters?.pageSize ?? 20,  // ✅ Default 20
      p_don_vi: filters?.don_vi ?? null,     // ✅ Pass facility filter
    }
  })
}
```

#### 2. Update `transfers/page.tsx`

**Current:**
```typescript
const {
  selectedFacilityId,
  filteredItems,  // ❌ Client-side filtering
} = useFacilityFilter<TransferRequest>({
  mode: 'client',  // ❌ Client mode
  items: transfers,
})

const { data: transfers = [] } = useTransferRequests()
```

**After:**
```typescript
const { selectedFacilityId, showFacilityFilter } = useFacilityFilter({
  mode: 'server',  // ✅ Server mode
  userRole: user?.role || 'user',
  facilities: facilityOptionsData || [],
})

const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

const { data: transfers = [] } = useTransferRequests({
  don_vi: selectedFacilityId,  // ✅ Server filter
  page: pagination.pageIndex + 1,
  pageSize: pagination.pageSize,
})
```

#### 3. Add Facility Dropdown RPC (Reuse Existing)

**Already exists:** `get_repair_request_facilities` (can create similar for transfers if needed)

**Alternative:** Use `get_facilities_with_equipment_count` (already in use)

---

## Testing Strategy

### Pre-Phase 0 Testing

**Test as Global User:**
- [ ] No facility filter selected → See all transfers (paginated)
- [ ] Select facility → See only that facility's transfers
- [ ] Verify pagination works (page 1, 2, 3...)
- [ ] Verify total count displays correctly

**Test as Regional Leader:**
- [ ] Auto-filtered to assigned facilities
- [ ] Facility dropdown shows only allowed facilities
- [ ] Cannot select facility outside allowed list
- [ ] Pagination works within filtered set

**Test as Regular User:**
- [ ] Auto-filtered to own facility
- [ ] No facility filter dropdown shown
- [ ] Pagination works within filtered set

**Performance Testing:**
- [ ] Initial page load < 200ms
- [ ] Network payload < 50KB
- [ ] No console errors
- [ ] Smooth pagination navigation

---

## Risk Assessment

### Pre-Phase 0 Migration Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Breaking change for existing users** | Medium | Low | RPC already supports pagination; only frontend changes |
| **Cache invalidation issues** | Low | Medium | Use proper queryKey with pagination params |
| **Regional leader multi-facility breaks** | High | Low | RPC already handles via `allowed_don_vi_for_session()` |
| **Facility dropdown empty** | Medium | Low | Fallback to RPC-based facility list |
| **Performance regression** | Low | Very Low | Server-side filtering always faster than client-side |

---

## Success Metrics

### Pre-Phase 0 Goals

**Performance:**
- ✅ Initial payload: 500KB → 20KB (96% reduction)
- ✅ Initial fetch: 5000 records → 20 records (99.6% reduction)
- ✅ Page load time: Faster (less data to parse)
- ✅ Network requests: Same count, smaller size

**Functionality:**
- ✅ Facility filter works identically to before (regional leader perspective)
- ✅ Pagination enables viewing all transfers (not limited to first 5000)
- ✅ All existing actions (Approve, Start, Complete) still work
- ✅ No permission violations

**Code Quality:**
- ✅ Consistent with Repair Requests page pattern
- ✅ Reusable pagination logic
- ✅ Simpler client-side code (less filtering logic)

---

## Conclusion

**RECOMMENDATION: Implement Pre-Phase 0 server-side filtering migration BEFORE starting Phase 0.**

**Rationale:**
1. Solves root performance problem (large initial fetch)
2. RPC already supports it (no backend changes needed)
3. Makes Phase 0 implementation cleaner
4. Aligns with Repair Requests pattern (consistency)
5. Only 1-2 hours of work
6. Provides immediate performance benefits

**Next Steps:**
1. ✅ **Approve this plan** (confirm with team)
2. ✅ **Implement Pre-Phase 0 migration** (1-2 hours)
3. ✅ **Test with all user roles** (30 minutes)
4. ✅ **Commit and document** (30 minutes)
5. ✅ **Proceed with Phase 0** (Kanban UX improvements)

---

## Related Documentation

- [Transfers Kanban Scalability Plan](./transfers-kanban-scalability-plan.md)
- [Kanban Scalability Issue Template](./kanban-scalability-issue-template.md)
- [Repair Requests Pagination Session](../session-notes/repair-requests-pagination-and-facility-rpc-optimization.md)
- Migration: `supabase/migrations/202510081450_add_facility_name_to_transfer_list.sql`
- Migration: `supabase/migrations/20251011_add_pagination_to_repair_request_list.sql`

---

**Author:** Development Team  
**Date:** October 11, 2025  
**Status:** Awaiting approval to proceed with Pre-Phase 0 migration
