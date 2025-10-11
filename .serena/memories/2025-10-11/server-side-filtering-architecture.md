# Server-Side Filtering Architecture Analysis

## Current State (October 11, 2025)

Two pages implement server-side facility filtering for regional leaders with different patterns:

### Equipment Page Pattern (✅ Superior)
- **Framework**: TanStack Query (`useQuery`)
- **Race Protection**: Automatic (queryKey change cancels old requests)
- **Pagination**: Server-side (p_page, p_page_size)
- **Cache Strategy**: Per-facility cache entries with `placeholderData: keepPreviousData`
- **Complexity**: Low (framework handles abort, deduplication, cache)
- **Scalability**: Excellent (only fetches needed data)

**Implementation**:
```typescript
const { data: equipmentRes, isLoading } = useQuery({
  queryKey: ['equipment_list_enhanced', {
    donVi: selectedDonVi, // ← Facility in cache key
    page: pagination.pageIndex,
    // ... filters
  }],
  queryFn: async ({ signal }) => {
    return callRpc({ 
      fn: 'equipment_list_enhanced', 
      args: { p_don_vi: selectedDonVi },
      signal // ← TanStack Query provides abort signal
    })
  },
  placeholderData: keepPreviousData, // ← No UI flash
})
```

### Repair Requests Page Pattern (⚠️ Custom Implementation)
- **Framework**: Manual fetch with React.useCallback
- **Race Protection**: Custom two-layer defense (snapshot + AbortController)
- **Pagination**: Client-side (fetches all 5000 records, React Table paginates)
- **Cache Strategy**: localStorage only
- **Complexity**: Medium (manual abort handling, 100+ lines of code)
- **Scalability**: Limited (fetches all data, filters client-side)

**Implementation**:
```typescript
const fetchRequests = React.useCallback(async (signal?: AbortSignal) => {
  const capturedFacilityId = selectedFacilityId; // ← Snapshot
  const data = await callRpc({ fn: 'repair_request_list', args: { p_don_vi: capturedFacilityId } })
  
  if (signal?.aborted || capturedFacilityId !== selectedFacilityId) return; // ← Guard
  setRequests(data);
}, [selectedFacilityId]);

React.useEffect(() => {
  const abortController = new AbortController();
  fetchRequests(abortController.signal);
  return () => abortController.abort();
}, [selectedFacilityId]);
```

## Architectural Differences

| Feature | Equipment (TanStack) | Repair Requests (Manual) |
|---------|---------------------|-------------------------|
| Race Protection | Automatic | Manual (2 layers) |
| Network Efficiency | High (paginated) | Low (fetch all) |
| Cache Strategy | Smart (per-filter) | Simple (localStorage) |
| Memory Usage | Low (~1MB) | High (~10MB for 5000 records) |
| Code Complexity | Low | Medium |
| UX (filter change) | Instant cached data | Loading spinner |

## Recommended Consolidation

**Proposal**: Migrate Repair Requests to TanStack Query pattern (Equipment pattern)

**Benefits**:
1. ✅ Eliminate 100+ lines of custom race protection code
2. ✅ Add server-side pagination for scalability
3. ✅ Consistent architecture across pages
4. ✅ Better UX (cached data, no UI flash)
5. ✅ Automatic request deduplication
6. ✅ 96% reduction in network payload (20 records vs 5000)

**Implementation Steps**:
1. Update `repair_request_list` RPC to support pagination (add p_page, p_page_size, return total)
2. Replace manual `fetchRequests` with `useQuery`
3. Remove custom abort controller code
4. Update table config: `manualPagination: true`
5. Convert mutations to `useMutation` with `queryClient.invalidateQueries`

**Effort**: 4-6 hours  
**Risk**: Low (TanStack Query already used in Equipment page)

## Race Condition Protection Comparison

### TanStack Query (Automatic)
- Query key includes facility ID
- Changing facility changes queryKey
- Old query automatically cancelled
- New query starts with fresh cache key
- No manual abort controller needed

### Manual Implementation (Custom)
- Capture facility ID at fetch start
- Manual AbortController for each useEffect
- Compare captured vs current before setState
- Check signal.aborted in multiple places
- Manual cleanup in useEffect return

## Performance Impact

**Current (fetch all)**:
- Initial load: ~500KB, 5000 records
- Memory: ~10MB in state
- Filter change: Re-fetch all 5000 records

**Proposed (paginated)**:
- Initial load: ~20KB, 20 records
- Memory: ~1MB (current page + cache)
- Filter change: Fetch 20 records, show cached data instantly

## Testing Scenarios

1. **Rapid facility switching**: Last selected facility wins
2. **Slow network + change**: No stale data from old facility
3. **Cache behavior**: Instant display from cache, background refresh
4. **Pagination**: Smooth page transitions
5. **Create/update/delete**: Proper cache invalidation

## Documentation

- **Full Analysis**: `docs/server-side-filtering-consolidation-analysis.md`
- **Equipment Pattern**: `src/app/(app)/equipment/page.tsx` (lines 1224-1258)
- **Repair Requests Pattern**: `src/app/(app)/repair-requests/page.tsx` (lines 409-520)
- **Race Protection Fix**: October 11, 2025 (snapshot + abort pattern)

## Key Takeaway

Equipment page's TanStack Query pattern is the gold standard for server-side filtering in this project. It provides automatic race protection, better performance, and simpler code compared to manual implementations.
