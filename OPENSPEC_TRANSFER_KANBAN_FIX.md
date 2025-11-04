# OpenSpec Change Proposal: Fix Transfer Kanban Count/Data Mismatch

## Issue Summary

**Two Related Bugs**:

1. **Filter Mismatch**: When a global user creates an external transfer request, the kanban board's 'Chờ duyệt' (Pending Approval) column shows an increased count badge, but the actual transfer card is not rendered in the column.

2. **Missing Cache Invalidation**: After status changes (approve, start, handover, complete), the count badges show stale data for up to 60 seconds because the counts query is never refetched/invalidated.

**Severity**: High (Data inconsistency throughout entire transfer lifecycle, confusing UX)

**Affected Component**: Transfer Kanban Board (`/src/app/(app)/transfers/`)

## Root Causes

### Root Cause #1: Filter Mismatch

The counts API (`/api/transfers/counts`) and kanban data API (`/api/transfers/kanban`) apply **different filters**, causing count/data mismatch:

- **Kanban Data Query**: Applies ALL filters (facility, date range, types, statuses, search, assignees)
- **Counts Query**: Applies ONLY facility filter, ignoring all other active filters

This causes the badge count to include transfers that are filtered out of the actual rendered data.

### Root Cause #2: Missing Cache Invalidation

After mutations (create, approve, start, handover, complete), only the kanban data query refetches. The counts query is never refetched or invalidated:

**Location**: `/src/app/(app)/transfers/page.tsx:147-150`

```typescript
const { data, isLoading, refetch: refetchTransfers } = useTransfersKanban(filters)
const { data: counts } = useTransferCounts(
  selectedFacilityId ? [selectedFacilityId] : undefined
)
// ❌ counts.refetch is never destructured or called
```

**All mutation handlers** only call `refetchTransfers()`:
- `handleApproveTransfer` (line 280)
- `handleStartTransfer` (line 304)
- `handleHandoverToExternal` (line 329)
- `handleReturnFromExternal` (line 354)
- `handleCompleteTransfer` (line 382)
- `handleDeleteTransfer` (line 256)
- `AddTransferDialog.onSuccess` (line 539)
- `EditTransferDialog.onSuccess` (line 545)

The counts query only refetches when:
- Page mounts (`refetchOnMount: true`)
- Window gets focus (`refetchOnWindowFocus: true`)
- Cache becomes stale after 60 seconds (`staleTime: 60_000`)

**Impact**: Badge counts are stale for up to 60 seconds after every status change, creating confusion about actual transfer counts in each column.

## Technical Analysis

### Current Implementation

**File**: `/src/app/(app)/transfers/page.tsx`

```typescript
// Line 147-150
const { data, isLoading, refetch: refetchTransfers } = useTransfersKanban(filters)
const { data: counts } = useTransferCounts(
  selectedFacilityId ? [selectedFacilityId] : undefined
)

// Where filters includes (lines 125-130):
const [filters, setFilters] = React.useState<TransferKanbanFilters>(() => ({
  facilityIds: selectedFacilityId ? [selectedFacilityId] : undefined,
  dateFrom: thirtyDaysAgo.toISOString(), // 30-day default
  dateTo: undefined,
  limit: 500,
}))
```

**File**: `/src/app/api/transfers/counts/route.ts`

```typescript
// Lines 35-40 - INCOMPLETE FILTER PASSING
const rpcUrl = new URL('/api/rpc/get_transfer_counts', request.nextUrl.origin)

const rpcPayload = {
  p_facility_ids: facilityIds,  // ❌ ONLY facility filter!
  // Missing: assigneeIds, types, dateFrom, dateTo, searchText
}
```

### RPC Function Capability (Already Supports All Filters)

**File**: `supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_filtering.sql`

```sql
-- Line 269-276: RPC already accepts all filter parameters
CREATE OR REPLACE FUNCTION get_transfer_counts(
  p_facility_ids BIGINT[] DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL,  -- ✅ Supported but not passed
  p_types TEXT[] DEFAULT NULL,            -- ✅ Supported but not passed
  p_date_from TIMESTAMPTZ DEFAULT NULL,   -- ✅ Supported but not passed
  p_date_to TIMESTAMPTZ DEFAULT NULL,     -- ✅ Supported but not passed
  p_search_text TEXT DEFAULT NULL         -- ✅ Supported but not passed
)
```

## Status Transition Workflow Analysis

### External Transfer Lifecycle

| Step | Action | Status Change | Handler | Refetch Behavior | Issue |
|------|--------|---------------|---------|------------------|-------|
| 1 | Create transfer | → `cho_duyet` | AddTransferDialog | `refetchTransfers()` | ❌ Counts not refetched |
| 2 | Approve | `cho_duyet` → `da_duyet` | handleApproveTransfer | `refetchTransfers()` | ❌ Counts not refetched |
| 3 | Start | `da_duyet` → `dang_luan_chuyen` | handleStartTransfer | `refetchTransfers()` | ❌ Counts not refetched |
| 4 | Handover | `dang_luan_chuyen` → `da_ban_giao` | handleHandoverToExternal | `refetchTransfers()` | ❌ Counts not refetched |
| 5 | Return | `da_ban_giao` → `hoan_thanh` | handleReturnFromExternal | `refetchTransfers()` | ❌ Counts not refetched |

**Result**: At EVERY step in the lifecycle, badge counts become stale immediately after the action, showing incorrect counts until cache expires (60s) or page regains focus.

### Internal Transfer Lifecycle

| Step | Action | Status Change | Handler | Refetch Behavior | Issue |
|------|--------|---------------|---------|------------------|-------|
| 1 | Create transfer | → `cho_duyet` | AddTransferDialog | `refetchTransfers()` | ❌ Counts not refetched |
| 2 | Approve | `cho_duyet` → `da_duyet` | handleApproveTransfer | `refetchTransfers()` | ❌ Counts not refetched |
| 3 | Start | `da_duyet` → `dang_luan_chuyen` | handleStartTransfer | `refetchTransfers()` | ❌ Counts not refetched |
| 4 | Complete | `dang_luan_chuyen` → `hoan_thanh` | handleCompleteTransfer | `refetchTransfers()` | ❌ Counts not refetched |

## Proposed Solution

### Change 1: Update Counts API Route

**File**: `/src/app/api/transfers/counts/route.ts`

**Action**: Add missing filter parameters to match kanban API

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse ALL filter parameters (same as kanban route)
    const searchParams = request.nextUrl.searchParams

    const facilityIds = searchParams.get('facilityIds')
      ?.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id)) || null

    // ✅ ADD: Parse additional filters
    const assigneeIds = searchParams.get('assigneeIds')
      ?.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id)) || null

    const types = searchParams.get('types')
      ?.split(',')
      .map(t => t.trim())
      .filter(t => ['noi_bo', 'ben_ngoai'].includes(t)) || null

    const statuses = searchParams.get('statuses')
      ?.split(',')
      .map(s => s.trim())
      .filter(s => ['cho_duyet', 'da_duyet', 'dang_luan_chuyen', 'da_ban_giao', 'hoan_thanh'].includes(s)) || null

    const dateFrom = searchParams.get('dateFrom') || null
    const dateTo = searchParams.get('dateTo') || null
    const searchText = searchParams.get('searchText') || null

    const rpcUrl = new URL('/api/rpc/get_transfer_counts', request.nextUrl.origin)

    // ✅ CHANGE: Pass all filters to RPC
    const rpcPayload = {
      p_facility_ids: facilityIds,
      p_assignee_ids: assigneeIds,
      p_types: types,
      p_statuses: statuses,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_search_text: searchText,
    }

    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || '',
      },
      body: JSON.stringify(rpcPayload),
    })

    // ... rest of implementation
  } catch (error) {
    // ... error handling
  }
}
```

### Change 2: Update Counts Hook Usage

**File**: `/src/app/(app)/transfers/page.tsx`

**Action**: Pass full filters to counts hook

```typescript
// Line 148-150 - BEFORE
const { data: counts } = useTransferCounts(
  selectedFacilityId ? [selectedFacilityId] : undefined
)

// ✅ AFTER: Pass full filters
const { data: counts } = useTransferCounts(
  filters  // Pass the same filters used for kanban data
)
```

### Change 3: Update Counts Hook Implementation

**File**: `/src/hooks/useTransfersKanban.ts`

**Action**: Update hook signature to accept full filters

```typescript
// Line 160-176 - BEFORE
export function useTransferCounts(
  facilityIds?: number[],
  options?: Omit<UseQueryOptions<TransferCountsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TransferCountsResponse, Error>({
    queryKey: transferKanbanKeys.counts(facilityIds),
    queryFn: () => fetchTransferCounts(facilityIds),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    ...options,
  })
}

// ✅ AFTER: Accept full filter object
export function useTransferCounts(
  filters: TransferKanbanFilters = {},
  options?: Omit<UseQueryOptions<TransferCountsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TransferCountsResponse, Error>({
    queryKey: transferKanbanKeys.counts(filters),  // Use full filters as cache key
    queryFn: () => fetchTransferCounts(filters),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
    ...options,
  })
}
```

### Change 4: Update Counts Fetch Function

**File**: `/src/hooks/useTransfersKanban.ts`

**Action**: Build URL params from full filters

```typescript
// Line 84-106 - BEFORE
async function fetchTransferCounts(
  facilityIds?: number[]
): Promise<TransferCountsResponse> {
  const params = new URLSearchParams()

  if (facilityIds && facilityIds.length > 0) {
    params.set('facilityIds', facilityIds.join(','))
  }

  const response = await fetch(`/api/transfers/counts?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch counts')
  }

  return response.json()
}

// ✅ AFTER: Build params from full filters (same as kanban)
async function fetchTransferCounts(
  filters: TransferKanbanFilters
): Promise<TransferCountsResponse> {
  const params = new URLSearchParams()

  if (filters.facilityIds && filters.facilityIds.length > 0) {
    params.set('facilityIds', filters.facilityIds.join(','))
  }

  if (filters.assigneeIds && filters.assigneeIds.length > 0) {
    params.set('assigneeIds', filters.assigneeIds.join(','))
  }

  if (filters.types && filters.types.length > 0) {
    params.set('types', filters.types.join(','))
  }

  if (filters.statuses && filters.statuses.length > 0) {
    params.set('statuses', filters.statuses.join(','))
  }

  if (filters.dateFrom) {
    params.set('dateFrom', filters.dateFrom)
  }

  if (filters.dateTo) {
    params.set('dateTo', filters.dateTo)
  }

  if (filters.searchText && filters.searchText.trim()) {
    params.set('searchText', filters.searchText.trim())
  }

  const response = await fetch(`/api/transfers/counts?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch counts')
  }

  return response.json()
}
```

### Change 5: Update Query Key Factory

**File**: `/src/hooks/useTransfersKanban.ts`

**Action**: Update counts key to use full filters

```typescript
// Line 17-22 - BEFORE
export const transferKanbanKeys = {
  all: ['transfers', 'kanban'] as const,
  lists: () => [...transferKanbanKeys.all, 'list'] as const,
  list: (filters: TransferKanbanFilters) => [...transferKanbanKeys.lists(), filters] as const,
  counts: (facilityIds?: number[]) => [...transferKanbanKeys.all, 'counts', facilityIds] as const,
}

// ✅ AFTER: Use full filters for counts cache key
export const transferKanbanKeys = {
  all: ['transfers', 'kanban'] as const,
  lists: () => [...transferKanbanKeys.all, 'list'] as const,
  list: (filters: TransferKanbanFilters) => [...transferKanbanKeys.lists(), filters] as const,
  counts: (filters: TransferKanbanFilters) => [...transferKanbanKeys.all, 'counts', filters] as const,
}
```

### Change 6: Update RPC Function to Accept Status Filter

**File**: `supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_filtering.sql`

**Action**: Add status filter to counts RPC (currently missing)

```sql
-- Line 269-345 - UPDATE FUNCTION SIGNATURE
CREATE OR REPLACE FUNCTION get_transfer_counts(
  p_facility_ids BIGINT[] DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_statuses TEXT[] DEFAULT NULL,  -- ✅ ADD: Status filter
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_search_text TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_count BIGINT,
  cho_duyet_count BIGINT,
  da_duyet_count BIGINT,
  dang_luan_chuyen_count BIGINT,
  da_ban_giao_count BIGINT,
  hoan_thanh_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_user_don_vi BIGINT;
  v_user_dia_ban BIGINT;
BEGIN
  -- ... existing permission checks ...

  -- Return counts grouped by status
  RETURN QUERY
  SELECT
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'cho_duyet') AS cho_duyet_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'da_duyet') AS da_duyet_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'dang_luan_chuyen') AS dang_luan_chuyen_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'da_ban_giao') AS da_ban_giao_count,
    COUNT(*) FILTER (WHERE yclc.trang_thai = 'hoan_thanh') AS hoan_thanh_count
  FROM yeu_cau_luan_chuyen yclc
  INNER JOIN thiet_bi tb ON yclc.thiet_bi_id = tb.id
  WHERE
    (p_facility_ids IS NULL OR tb.don_vi = ANY(p_facility_ids))
    AND (p_assignee_ids IS NULL OR yclc.nguoi_yeu_cau_id = ANY(p_assignee_ids))
    AND (p_types IS NULL OR yclc.loai_hinh = ANY(p_types))
    AND (p_statuses IS NULL OR yclc.trang_thai = ANY(p_statuses))  -- ✅ ADD: Status filter
    AND (p_date_from IS NULL OR yclc.created_at >= p_date_from)
    AND (p_date_to IS NULL OR yclc.created_at <= p_date_to)
    AND (
      p_search_text IS NULL
      OR to_tsvector('simple',
        COALESCE(yclc.ma_yeu_cau, '') || ' ' ||
        COALESCE(yclc.ly_do_luan_chuyen, '') || ' ' ||
        COALESCE(tb.ten_thiet_bi, '') || ' ' ||
        COALESCE(tb.ma_thiet_bi, '')
      ) @@ plainto_tsquery('simple', p_search_text)
    );
END;
$$;
```

### Change 7: Add Cache Invalidation for Counts Query

**File**: `/src/app/(app)/transfers/page.tsx`

**Action**: Use `queryClient.invalidateQueries()` to invalidate counts cache after mutations

```typescript
// Add import at top of file
import { useQueryClient } from "@tanstack/react-query"

// In component body, add queryClient hook (after line 62)
const queryClient = useQueryClient()

// Extract refetch from counts query (line 148-150)
// BEFORE:
const { data: counts } = useTransferCounts(
  selectedFacilityId ? [selectedFacilityId] : undefined
)

// ✅ AFTER: Extract refetch function
const { data: counts, refetch: refetchCounts } = useTransferCounts(
  selectedFacilityId ? [selectedFacilityId] : undefined
)

// Create unified refetch helper (after line 193)
const refetchAll = React.useCallback(() => {
  refetchTransfers()
  refetchCounts()
  // Alternative: invalidate all transfer-related queries
  // queryClient.invalidateQueries({ queryKey: ['transfers', 'kanban'] })
}, [refetchTransfers, refetchCounts])

// Update all mutation handlers to use refetchAll instead of refetchTransfers:
// 1. handleApproveTransfer (line 280) → refetchAll()
// 2. handleStartTransfer (line 304) → refetchAll()
// 3. handleHandoverToExternal (line 329) → refetchAll()
// 4. handleReturnFromExternal (line 354) → refetchAll()
// 5. handleCompleteTransfer (line 382) → refetchAll()
// 6. handleDeleteTransfer (line 256) → refetchAll()
// 7. AddTransferDialog.onSuccess (line 539) → refetchAll
// 8. EditTransferDialog.onSuccess (line 545) → refetchAll
```

**Example for one handler**:

```typescript
// BEFORE (line 266-288)
const handleApproveTransfer = async (transferId: number) => {
  if (isRegionalLeader) {
    notifyRegionalLeaderRestricted()
    return
  }

  try {
    await callRpc({
      fn: 'transfer_request_update_status',
      args: {
        p_id: transferId,
        p_status: 'da_duyet',
        p_payload: { nguoi_duyet_id: user?.id }
      }
    })

    toast({
      title: "Thành công",
      description: "Đã duyệt yêu cầu luân chuyển."
    })

    refetchTransfers() // ❌ Only refetches kanban data
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: "Lỗi",
      description: error.message || "Có lỗi xảy ra khi duyệt yêu cầu."
    })
  }
}

// ✅ AFTER: Refetch both queries
const handleApproveTransfer = async (transferId: number) => {
  if (isRegionalLeader) {
    notifyRegionalLeaderRestricted()
    return
  }

  try {
    await callRpc({
      fn: 'transfer_request_update_status',
      args: {
        p_id: transferId,
        p_status: 'da_duyet',
        p_payload: { nguoi_duyet_id: user?.id }
      }
    })

    toast({
      title: "Thành công",
      description: "Đã duyệt yêu cầu luân chuyển."
    })

    refetchAll() // ✅ Refetches both kanban data and counts
  } catch (error: any) {
    toast({
      variant: "destructive",
      title: "Lỗi",
      description: error.message || "Có lỗi xảy ra khi duyệt yêu cầu."
    })
  }
}
```

**Apply same pattern** to all 8 mutation handlers listed above.

## Testing Plan

### Unit Tests

1. **Test filter synchronization**:
   - Create transfer with active filters
   - Verify counts match filtered data length

2. **Test date range filter**:
   - Apply 30-day default filter
   - Create new transfer
   - Verify it appears in both counts and data

3. **Test type filter**:
   - Filter by 'ben_ngoai' type
   - Create external transfer
   - Verify counts and data match

### Integration Tests

1. **Global user workflow**:
   - Login as global user
   - Select facility filter
   - Create external transfer
   - Verify card renders in correct column
   - Verify badge count matches card count IMMEDIATELY

2. **Multi-filter scenario**:
   - Apply multiple filters (type + status + date)
   - Create transfer matching filters
   - Verify immediate visibility in both data and counts

3. **Status transition workflow** (CRITICAL):
   - Create transfer → verify badge increments immediately
   - Approve transfer → verify badges update immediately (cho_duyet -1, da_duyet +1)
   - Start transfer → verify badges update immediately (da_duyet -1, dang_luan_chuyen +1)
   - Handover transfer → verify badges update immediately (dang_luan_chuyen -1, da_ban_giao +1)
   - Complete transfer → verify badges update immediately (da_ban_giao -1, hoan_thanh +1)
   - **No stale counts at any step**

4. **Cache invalidation verification**:
   - Monitor React Query DevTools during status changes
   - Verify both 'list' and 'counts' queries refetch
   - Verify no 60-second delay before badge updates

5. **Edit/Delete operations**:
   - Edit transfer details → verify both queries refetch
   - Delete transfer → verify counts decrement immediately

## Migration Path

### Phase 1: Backend (Database)
1. **Create new migration file**: `supabase/migrations/YYYYMMDDHHMMSS_add_status_filter_to_counts.sql`
2. **Apply database changes**: Update `get_transfer_counts` function to add missing status filter
3. **Test RPC in SQL Editor**: Verify function accepts all parameters

### Phase 2: Backend (API Routes)
4. **Update counts API route**: `/src/app/api/transfers/counts/route.ts` - add filter parsing
5. **Test API endpoint**: Call with various filter combinations via Postman/curl

### Phase 3: Frontend (Hooks)
6. **Update query key factory**: `/src/hooks/useTransfersKanban.ts` - change counts key
7. **Update fetch function**: `/src/hooks/useTransfersKanban.ts` - build params from filters
8. **Update counts hook**: `/src/hooks/useTransfersKanban.ts` - accept full filters object

### Phase 4: Frontend (Page)
9. **Update page imports**: Add `useQueryClient` import
10. **Extract refetch functions**: Destructure `refetch` from counts query
11. **Create refetchAll helper**: Unified function to refetch both queries
12. **Update all 8 handlers**: Replace `refetchTransfers()` with `refetchAll()`

### Phase 5: Testing & Deployment
13. **Test locally**: All status transitions with React Query DevTools
14. **Test filter combinations**: Verify counts match data
15. **Deploy to staging**: Monitor for issues
16. **Deploy to production**: Stage → Production

## Benefits

✅ **Accuracy**: Badge counts will always match visible data
✅ **Real-time**: Counts update IMMEDIATELY after status changes (no 60s delay)
✅ **Consistency**: Same filters applied to both queries throughout entire lifecycle
✅ **Performance**: No performance impact (RPC already supports filters, just utilizing them)
✅ **Maintainability**: Single source of truth for filter logic
✅ **User Experience**: No more confusing count/data mismatches at any stage
✅ **Developer Experience**: Proper React Query patterns with cache invalidation

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing filters | Medium | Maintain backward compatibility with default NULL values |
| Cache invalidation issues | Low | Query keys include full filters for proper cache management |
| Performance degradation | Low | RPC already optimized with indexes for these filters |
| Migration rollback complexity | Low | Function is idempotent with `CREATE OR REPLACE` |

## Estimated Effort

- **Backend (RPC)**: 15 minutes (update function signature to add status filter)
- **API Routes**: 30 minutes (add all filter parameter parsing)
- **Hooks**: 45 minutes (update signature, fetch logic, query keys)
- **Page Updates**: 45 minutes (add queryClient, refetchAll helper, update 8 handlers)
- **Testing**: 3 hours (comprehensive filter testing + status transition testing)
- **Documentation**: 30 minutes (update comments, add migration notes)
- **Total**: ~5.5 hours

### Breakdown by Change
| Change | Component | Time | Complexity |
|--------|-----------|------|------------|
| Change 1 | Counts API Route | 30 min | Low |
| Change 2 | Counts Hook Usage | 5 min | Low |
| Change 3 | Counts Hook Implementation | 15 min | Medium |
| Change 4 | Counts Fetch Function | 15 min | Low |
| Change 5 | Query Key Factory | 5 min | Low |
| Change 6 | RPC Function | 15 min | Low |
| Change 7 | Cache Invalidation | 45 min | Medium |
| Testing | All Status Transitions | 3 hours | High |

## Related Issues

- Filter Bar implementation: `/src/components/transfers/FilterBar.tsx`
- Kanban virtualization: `/src/components/transfers/VirtualizedKanbanColumn.tsx`
- Transfer types: `/src/types/transfer-kanban.ts`

## References

- Original RPC migration: `supabase/migrations/2025-10-12_transfer_kanban/20251012120000_kanban_server_filtering.sql`
- Kanban API: `/src/app/api/transfers/kanban/route.ts`
- Counts API: `/src/app/api/transfers/counts/route.ts`
- React Query hooks: `/src/hooks/useTransfersKanban.ts`
- Project architecture: `CLAUDE.md` (RPC-first architecture)

---

## Summary

This proposal fixes **two critical bugs** in the Transfer Kanban board:

### Bug #1: Filter Mismatch
- **Problem**: Counts query uses only facility filter, kanban data uses all filters
- **Impact**: Badge counts don't match visible cards when filters active
- **Fix**: Synchronize all filter parameters between both queries

### Bug #2: Missing Cache Invalidation
- **Problem**: After status changes, counts query never refetches
- **Impact**: Badge counts stale for up to 60 seconds after every action
- **Fix**: Add proper React Query cache invalidation using `refetchAll()` helper

### Critical Impact Points
- **8 mutation handlers** affected (create, edit, delete, approve, start, handover, return, complete)
- **5 status transitions** in external transfer lifecycle
- **4 status transitions** in internal transfer lifecycle
- **Every user action** on transfers shows stale counts

### Solution Approach
1. Expand counts query to use same filters as kanban data
2. Add cache invalidation to all mutation handlers
3. Use React Query best practices (`useQueryClient`, `invalidateQueries`)
4. Ensure immediate updates with no stale data

**Prepared by**: Claude Code Audit (Extended Investigation)
**Date**: 2025-11-04
**Last Updated**: 2025-11-04 (Added Cache Invalidation Analysis)
**Status**: Ready for Implementation
