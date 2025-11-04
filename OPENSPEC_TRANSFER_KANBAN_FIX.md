# OpenSpec Change Proposal: Fix Transfer Kanban Count/Data Mismatch

## Issue Summary

**Bug**: When a global user creates an external transfer request, the kanban board's 'Chờ duyệt' (Pending Approval) column shows an increased count badge, but the actual transfer card is not rendered in the column.

**Severity**: Medium (Data inconsistency, confusing UX)

**Affected Component**: Transfer Kanban Board (`/src/app/(app)/transfers/`)

## Root Cause

The counts API (`/api/transfers/counts`) and kanban data API (`/api/transfers/kanban`) apply **different filters**, causing count/data mismatch:

- **Kanban Data Query**: Applies ALL filters (facility, date range, types, statuses, search, assignees)
- **Counts Query**: Applies ONLY facility filter, ignoring all other active filters

This causes the badge count to include transfers that are filtered out of the actual rendered data.

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
   - Verify badge count matches card count

2. **Multi-filter scenario**:
   - Apply multiple filters (type + status + date)
   - Create transfer matching filters
   - Verify immediate visibility

3. **Refetch behavior**:
   - Create transfer
   - Verify both queries refetch
   - Verify cache invalidation

## Migration Path

1. **Create new migration file**: `supabase/migrations/YYYYMMDDHHMMSS_add_status_filter_to_counts.sql`
2. **Apply database changes**: Update `get_transfer_counts` function
3. **Update API route**: `/src/app/api/transfers/counts/route.ts`
4. **Update hook**: `/src/hooks/useTransfersKanban.ts`
5. **Update page**: `/src/app/(app)/transfers/page.tsx`
6. **Test thoroughly**: All filter combinations
7. **Deploy**: Stage → Production

## Benefits

✅ **Accuracy**: Badge counts will always match visible data
✅ **Consistency**: Same filters applied to both queries
✅ **Performance**: No performance impact (RPC already supports filters)
✅ **Maintainability**: Single source of truth for filter logic
✅ **User Experience**: No more confusing count/data mismatches

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing filters | Medium | Maintain backward compatibility with default NULL values |
| Cache invalidation issues | Low | Query keys include full filters for proper cache management |
| Performance degradation | Low | RPC already optimized with indexes for these filters |
| Migration rollback complexity | Low | Function is idempotent with `CREATE OR REPLACE` |

## Estimated Effort

- **Backend (RPC)**: 15 minutes (update function signature)
- **API Routes**: 30 minutes (add filter parsing)
- **Hooks**: 30 minutes (update signature and fetch logic)
- **Page Updates**: 15 minutes (pass filters to hook)
- **Testing**: 2 hours (comprehensive filter testing)
- **Total**: ~3.5 hours

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

**Prepared by**: Claude Code Audit
**Date**: 2025-11-04
**Status**: Ready for Implementation
