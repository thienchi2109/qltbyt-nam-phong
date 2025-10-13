# Kanban "Load More" Implementation Plan - Option B

**Date Created**: October 12, 2025  
**Priority**: P2 (Deferred after Option A quick fix)  
**Estimated Effort**: 1-2 days  
**Status**: 📋 PLANNED - Ready for Implementation  
**Related Bug**: P1 - Kanban pagination not implemented

---

## Executive Summary

This document provides a **comprehensive implementation plan** for adding "Load More" buttons to the Kanban Transfer board, enabling users to fetch and view transfers beyond the initial 100-record limit.

**Strategy**: Use TanStack Query's `useInfiniteQuery` per column for independent pagination with cursor-based loading.

**Timeline**:
- **Phase 1** (DONE): Quick fix with `limit: 500`
- **Phase 2** (THIS PLAN): Implement proper "Load More" buttons

---

## Solution Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────┐
│ TransfersPage Component                             │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │ Global Filters (facility, search, date)      │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │ Kanban Board (5 Columns)                     │ │
│  │                                               │ │
│  │  ┌────────────┐  ┌────────────┐             │ │
│  │  │ Chờ duyệt  │  │ Đã duyệt   │  ...        │ │
│  │  ├────────────┤  ├────────────┤             │ │
│  │  │ useInfinite│  │ useInfinite│  ...        │ │
│  │  │ Query #1   │  │ Query #2   │             │ │
│  │  ├────────────┤  ├────────────┤             │ │
│  │  │ Cards 1-50 │  │ Cards 1-50 │  ...        │ │
│  │  │ ...        │  │ ...        │             │ │
│  │  ├────────────┤  ├────────────┤             │ │
│  │  │ Load More  │  │ Load More  │  ...        │ │
│  │  │ Button     │  │ Button     │             │ │
│  │  └────────────┘  └────────────┘             │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Initial Load
   ↓
   useInfiniteQuery({ queryKey: ['transfers', 'cho_duyet', filters] })
   ↓
   Fetch page 1: GET /api/transfers/kanban?status=cho_duyet&limit=50
   ↓
   Render cards 1-50
   ↓
   Show "Load More" if hasNextPage

2. User Clicks "Load More"
   ↓
   fetchNextPage()
   ↓
   Fetch page 2: GET /api/transfers/kanban?status=cho_duyet&limit=50&cursor=12345
   ↓
   Append cards 51-100
   ↓
   Update "Showing 100 / 150"

3. Filters Change
   ↓
   queryKey changes → invalidate all queries
   ↓
   Reset to page 1 for all columns
   ↓
   Fresh data fetch
```

---

## Implementation Details

### Step 1: Create Custom Hook `useInfiniteTransferColumn`

**File**: `src/hooks/useInfiniteTransferColumn.ts` (NEW FILE)

```typescript
import { useInfiniteQuery, UseInfiniteQueryResult } from '@tanstack/react-query'
import type { TransferKanbanItem, TransferKanbanFilters, TransferStatus } from '@/types/transfer-kanban'

interface UseInfiniteTransferColumnParams {
  status: TransferStatus
  filters: Omit<TransferKanbanFilters, 'statuses' | 'limit' | 'cursor'>
  pageSize?: number
}

interface TransferPage {
  transfers: TransferKanbanItem[]
  nextCursor: number | null
  hasMore: boolean
}

/**
 * Custom hook for infinite loading of transfers in a single Kanban column
 * Uses TanStack Query's useInfiniteQuery for cursor-based pagination
 */
export function useInfiniteTransferColumn({
  status,
  filters,
  pageSize = 50,
}: UseInfiniteTransferColumnParams): UseInfiniteQueryResult<TransferPage[], Error> & {
  allTransfers: TransferKanbanItem[]
  totalLoaded: number
  hasMore: boolean
} {
  const queryResult = useInfiniteQuery<TransferPage, Error>({
    queryKey: ['transfers-infinite', status, filters, pageSize],
    
    queryFn: async ({ pageParam = null }): Promise<TransferPage> => {
      // Build URL with filters
      const params = new URLSearchParams()
      
      // Status filter (single column)
      params.set('statuses', status)
      
      // Pagination
      params.set('limit', pageSize.toString())
      if (pageParam) {
        params.set('cursor', pageParam.toString())
      }
      
      // Apply other filters
      if (filters.facilityIds?.length) {
        params.set('facilityIds', filters.facilityIds.join(','))
      }
      if (filters.searchText) {
        params.set('searchText', filters.searchText)
      }
      if (filters.dateFrom) {
        params.set('dateFrom', filters.dateFrom)
      }
      if (filters.dateTo) {
        params.set('dateTo', filters.dateTo)
      }
      if (filters.types?.length) {
        params.set('types', filters.types.join(','))
      }
      if (filters.assigneeIds?.length) {
        params.set('assigneeIds', filters.assigneeIds.join(','))
      }
      
      const response = await fetch(`/api/transfers/kanban?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transfers: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      // Extract transfers for this specific status
      const transfers = data.transfers[status] || []
      
      // Determine next cursor (last item ID in current page)
      const nextCursor = transfers.length > 0 
        ? transfers[transfers.length - 1].id 
        : null
      
      // Has more data if we received a full page
      const hasMore = transfers.length >= pageSize
      
      return {
        transfers,
        nextCursor,
        hasMore,
      }
    },
    
    getNextPageParam: (lastPage) => {
      return lastPage.hasMore ? lastPage.nextCursor : undefined
    },
    
    // Cache for 5 minutes
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    
    // Retry failed requests
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
  
  // Flatten all pages into single array
  const allTransfers = queryResult.data?.pages.flatMap(page => page.transfers) || []
  
  // Calculate totals
  const totalLoaded = allTransfers.length
  const hasMore = queryResult.hasNextPage || false
  
  return {
    ...queryResult,
    allTransfers,
    totalLoaded,
    hasMore,
  }
}
```

**Key Features**:
- ✅ Per-column infinite query with independent state
- ✅ Cursor-based pagination (uses last item ID)
- ✅ Automatic cache management via TanStack Query
- ✅ Flattens pages into single array for easy rendering
- ✅ Provides `hasMore` flag for conditional button rendering
- ✅ Retry logic for network failures

---

### Step 2: Update Page Component

**File**: `src/app/(app)/transfers/page.tsx`

#### 2.1: Remove Old Hook, Add New Hooks

```typescript
// ❌ REMOVE OLD (single query for all columns)
// const { data, isLoading, refetch: refetchTransfers } = useTransfersKanban(filters)

// ✅ ADD NEW (one query per column)
import { useInfiniteTransferColumn } from '@/hooks/useInfiniteTransferColumn'

// Create 5 independent queries (one per column)
const columnQueries = {
  cho_duyet: useInfiniteTransferColumn({
    status: 'cho_duyet',
    filters,
    pageSize: 50,
  }),
  da_duyet: useInfiniteTransferColumn({
    status: 'da_duyet',
    filters,
    pageSize: 50,
  }),
  dang_luan_chuyen: useInfiniteTransferColumn({
    status: 'dang_luan_chuyen',
    filters,
    pageSize: 50,
  }),
  da_ban_giao: useInfiniteTransferColumn({
    status: 'da_ban_giao',
    filters,
    pageSize: 50,
  }),
  hoan_thanh: useInfiniteTransferColumn({
    status: 'hoan_thanh',
    filters,
    pageSize: 50,
  }),
}
```

#### 2.2: Update Rendering Logic

```typescript
{KANBAN_COLUMNS.map((column) => {
  const query = columnQueries[column.status]
  const columnTransfers = query.allTransfers
  const totalCount = counts?.columnCounts[column.status] || 0
  
  return (
    <div key={column.status} className="flex flex-col gap-2">
      {/* Column Header */}
      <div className={`p-4 rounded-t-lg border-2 ${column.bgColor} ${column.borderColor}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${column.textColor}`}>{column.title}</h3>
          <Badge variant="secondary">{totalCount}</Badge>
        </div>
      </div>
      
      {/* Column Content */}
      <div className={`flex-1 min-h-[400px] border-2 border-t-0 rounded-b-lg p-2 ${column.bgColor} ${column.borderColor}`}>
        {/* Loading State (Initial) */}
        {query.isLoading && columnTransfers.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        )}
        
        {/* Empty State */}
        {!query.isLoading && columnTransfers.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            Không có yêu cầu nào
          </div>
        )}
        
        {/* Cards with Virtualization */}
        {columnTransfers.length > 0 && (
          <>
            <VirtualizedKanbanColumn
              transfers={columnTransfers}
              density={densityMode}
              renderCard={(transfer, index) => {
                const normalizedTransfer = normalizeTransferData(transfer)
                return (
                  <TransferCard
                    key={transfer.id}
                    transfer={transfer as any}
                    density={densityMode}
                    onClick={() => handleViewDetail(normalizedTransfer)}
                    statusActions={getStatusActions(normalizedTransfer)}
                    onEdit={() => handleEditTransfer(normalizedTransfer)}
                    onDelete={() => handleDeleteTransfer(transfer.id)}
                    canEdit={canEdit(normalizedTransfer)}
                    canDelete={canDelete(normalizedTransfer)}
                  />
                )
              }}
            />
            
            {/* Load More Section */}
            <div className="mt-2 space-y-2">
              {/* Count Display */}
              <div className="text-xs text-center text-muted-foreground">
                Hiển thị {query.totalLoaded} / {totalCount}
              </div>
              
              {/* Load More Button */}
              {query.hasMore && (
                <Button
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  {query.isFetchingNextPage ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full mr-2" />
                      Đang tải...
                    </>
                  ) : (
                    <>Tải thêm...</>
                  )}
                </Button>
              )}
              
              {/* All Loaded Message */}
              {!query.hasMore && query.totalLoaded > 0 && (
                <div className="text-xs text-center text-muted-foreground py-2">
                  Đã hiển thị tất cả {query.totalLoaded} yêu cầu
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
})}
```

#### 2.3: Update Refresh Handler

```typescript
const handleRefresh = async () => {
  setIsRefreshing(true)
  try {
    // Invalidate all column queries
    await Promise.all(
      Object.values(columnQueries).map(query => query.refetch())
    )
  } finally {
    setIsRefreshing(false)
  }
}
```

#### 2.4: Handle Filter Changes

```typescript
// Reset all queries when filters change
React.useEffect(() => {
  // TanStack Query will automatically refetch when queryKey changes
  // No manual reset needed! 🎉
}, [filters])
```

---

### Step 3: Update API Route (Optional Optimization)

**File**: `src/app/api/transfers/kanban/route.ts`

Add single-status optimization:

```typescript
// If only one status requested, optimize query
const statuses = searchParams.get('statuses')?.split(',').filter(Boolean)

if (statuses && statuses.length === 1) {
  // Optimize: only query one column instead of all 5
  rpcArgs.p_statuses = statuses
}
```

---

## State Management Strategy

### Option A: Multiple useInfiniteQuery (RECOMMENDED)

**Pros**:
- ✅ Built-in pagination state management
- ✅ Automatic cache invalidation
- ✅ Independent column loading
- ✅ Retry logic included
- ✅ Loading states handled
- ✅ Optimistic updates possible

**Cons**:
- ⚠️ 5 separate queries (overhead negligible with proper caching)
- ⚠️ Slightly more complex setup

**Implementation**: See Step 1 above

### Option B: Single Query + Manual State (NOT RECOMMENDED)

**Cons**:
- ❌ Manual cursor tracking per column
- ❌ Manual cache management
- ❌ Race condition handling needed
- ❌ More bug-prone

**Decision**: Use Option A (TanStack Query)

---

## Performance Considerations

### Memory Usage

| Scenario | Transfers Loaded | Memory Impact |
|----------|------------------|---------------|
| Initial load (5 × 50) | 250 | ~125 KB |
| After 1 "Load More" | 500 | ~250 KB |
| After 2 "Load More" | 750 | ~375 KB |
| Max realistic | 2000 | ~1 MB |

**Analysis**: Memory impact is negligible (<1MB even with 2000 transfers)

### React-Window Virtualization

**Current**: VirtualizedKanbanColumn uses `react-window@2.2.0`

**Compatibility**: 
- ✅ Works with arrays of any size
- ✅ Only renders visible items
- ✅ Append operation doesn't cause re-render of existing items

**Performance**: O(log n) for windowing, O(1) for scrolling

### Network Impact

| Page Size | Transfers | Payload Size | Load Time (3G) |
|-----------|-----------|--------------|----------------|
| 50 | 50 | ~25 KB | ~200ms |
| 100 | 100 | ~50 KB | ~400ms |
| 200 | 200 | ~100 KB | ~800ms |

**Recommendation**: Use `pageSize: 50` (good balance)

---

## Error Handling

### Network Errors

```typescript
{query.isError && (
  <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
    <p className="font-semibold">Không thể tải dữ liệu</p>
    <p className="text-xs mt-1">{query.error?.message}</p>
    <Button
      onClick={() => query.refetch()}
      size="sm"
      variant="outline"
      className="mt-2"
    >
      Thử lại
    </Button>
  </div>
)}
```

### Empty States

```typescript
{!query.isLoading && query.totalLoaded === 0 && (
  <div className="flex flex-col items-center justify-center h-32 text-center">
    <p className="text-sm text-muted-foreground">Không có yêu cầu nào</p>
    {filters.searchText && (
      <p className="text-xs text-muted-foreground mt-1">
        Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
      </p>
    )}
  </div>
)}
```

### Stale Data

```typescript
// Show indicator when data is stale but usable
{query.isRefetching && !query.isFetchingNextPage && (
  <div className="absolute top-2 right-2">
    <Badge variant="outline" className="text-xs">
      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
      Đang cập nhật...
    </Badge>
  </div>
)}
```

---

## Testing Strategy

### Unit Tests

**File**: `src/hooks/__tests__/useInfiniteTransferColumn.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useInfiniteTransferColumn } from '../useInfiniteTransferColumn'

describe('useInfiniteTransferColumn', () => {
  it('should fetch initial page', async () => {
    const { result } = renderHook(
      () => useInfiniteTransferColumn({
        status: 'cho_duyet',
        filters: {},
        pageSize: 50,
      }),
      { wrapper: createQueryWrapper() }
    )
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.allTransfers).toHaveLength(50)
    expect(result.current.hasMore).toBe(true)
  })
  
  it('should fetch next page when calling fetchNextPage', async () => {
    const { result } = renderHook(
      () => useInfiniteTransferColumn({
        status: 'cho_duyet',
        filters: {},
        pageSize: 50,
      }),
      { wrapper: createQueryWrapper() }
    )
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    result.current.fetchNextPage()
    
    await waitFor(() => expect(result.current.allTransfers).toHaveLength(100))
  })
  
  it('should reset when filters change', async () => {
    const { result, rerender } = renderHook(
      ({ filters }) => useInfiniteTransferColumn({
        status: 'cho_duyet',
        filters,
        pageSize: 50,
      }),
      {
        wrapper: createQueryWrapper(),
        initialProps: { filters: {} }
      }
    )
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    
    // Change filters
    rerender({ filters: { searchText: 'test' } })
    
    await waitFor(() => {
      expect(result.current.allTransfers.length).toBeLessThanOrEqual(50)
    })
  })
})
```

### Integration Tests

**File**: `src/app/(app)/transfers/__tests__/pagination.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TransfersPage from '../page'
import { mockTransfers } from '@/test/fixtures/transfers'

describe('Kanban Pagination', () => {
  it('should display "Load More" button when more data available', async () => {
    render(<TransfersPage />)
    
    await waitFor(() => {
      expect(screen.getAllByText('Tải thêm...').length).toBeGreaterThan(0)
    })
  })
  
  it('should load next page when "Load More" clicked', async () => {
    render(<TransfersPage />)
    
    const initialCards = screen.getAllByTestId('transfer-card')
    const loadMoreButton = screen.getAllByText('Tải thêm...')[0]
    
    fireEvent.click(loadMoreButton)
    
    await waitFor(() => {
      const newCards = screen.getAllByTestId('transfer-card')
      expect(newCards.length).toBeGreaterThan(initialCards.length)
    })
  })
  
  it('should hide "Load More" when all data loaded', async () => {
    // Mock API to return less than pageSize
    mockFetch({ transfers: mockTransfers.slice(0, 20) })
    
    render(<TransfersPage />)
    
    await waitFor(() => {
      expect(screen.queryByText('Tải thêm...')).not.toBeInTheDocument()
    })
  })
})
```

### Manual Testing Checklist

- [ ] Initial load shows first 50 transfers per column
- [ ] "Load More" button appears when hasMore = true
- [ ] Click "Load More" → loads next 50 transfers
- [ ] Count updates: "Hiển thị 50 / 120" → "Hiển thị 100 / 120"
- [ ] Button disabled while loading (shows spinner)
- [ ] Button hides when all data loaded
- [ ] Scroll position maintained after load
- [ ] Virtualization still works with 200+ items
- [ ] Changing facility filter resets to page 1
- [ ] Search resets all columns to page 1
- [ ] Error state shows retry button
- [ ] Network error → shows error message
- [ ] Retry button refetches data successfully
- [ ] Multiple columns can load independently
- [ ] No duplicate transfers after pagination
- [ ] Performance acceptable with 500+ transfers

---

## Migration Guide

### Before (Current - with Quick Fix)

```typescript
// Fetches max 500 transfers at once
const { data, isLoading } = useTransfersKanban({ 
  ...filters, 
  limit: 500 
})
```

**Issues**:
- ❌ Still caps at 500
- ❌ Large initial payload
- ❌ No way to view 501+

### After (With Load More)

```typescript
// Fetches 50 at a time, can load infinite
const columnQueries = {
  cho_duyet: useInfiniteTransferColumn({ 
    status: 'cho_duyet', 
    filters, 
    pageSize: 50 
  }),
  // ... other columns
}
```

**Benefits**:
- ✅ Scales to unlimited transfers
- ✅ Smaller initial payload
- ✅ User controls data loading

---

## Rollout Plan

### Phase 1: Implementation (Day 1)

**Morning**:
- [ ] Create `useInfiniteTransferColumn` hook
- [ ] Write unit tests for hook
- [ ] Test with mock data

**Afternoon**:
- [ ] Update TransfersPage component
- [ ] Integrate 5 column queries
- [ ] Update rendering logic
- [ ] Add "Load More" buttons

### Phase 2: Testing (Day 1 Evening)

- [ ] Manual testing with >200 transfers
- [ ] Test all error scenarios
- [ ] Verify scroll position maintained
- [ ] Check performance with 1000+ transfers
- [ ] Test on mobile devices

### Phase 3: Review & Deploy (Day 2)

**Morning**:
- [ ] Code review
- [ ] Address feedback
- [ ] Update documentation
- [ ] Create migration notes

**Afternoon**:
- [ ] Deploy to staging
- [ ] Smoke test on staging
- [ ] Deploy to production
- [ ] Monitor error logs
- [ ] User acceptance testing

---

## Metrics & Success Criteria

### Performance Targets

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Initial load time | <2s | Chrome DevTools Network |
| "Load More" response | <1s | User perception |
| Memory usage | <5MB total | Chrome DevTools Memory |
| Scroll jank | 0 dropped frames | Chrome Performance |

### User Experience Targets

- [ ] Users can access all transfers (no 500 cap)
- [ ] "Load More" feels responsive (<1s)
- [ ] No scroll position jumps
- [ ] Clear indication of loading state
- [ ] Intuitive "X / Y" count display

### Success Metrics

- [ ] Zero error logs related to pagination
- [ ] No user complaints about missing transfers
- [ ] Page load time unchanged
- [ ] Memory usage within acceptable range

---

## Future Enhancements

### v2.0: Infinite Scroll (Optional)

Replace "Load More" buttons with automatic infinite scroll:

```typescript
// Use Intersection Observer
const loadMoreRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && query.hasMore) {
        query.fetchNextPage()
      }
    },
    { threshold: 0.1 }
  )
  
  if (loadMoreRef.current) {
    observer.observe(loadMoreRef.current)
  }
  
  return () => observer.disconnect()
}, [query.hasMore, query.fetchNextPage])
```

### v2.1: Prefetching

Prefetch next page when user scrolls near bottom:

```typescript
const prefetchNextPage = usePrefetchQuery({
  queryKey: ['transfers-infinite', status, filters, pageSize],
  queryFn: () => fetchNextPage(),
})

// Trigger prefetch when 80% scrolled
if (scrollPercent > 0.8 && query.hasNextPage) {
  prefetchNextPage()
}
```

### v2.2: Virtual Scrolling Optimization

Use `react-window-infinite-loader` for seamless infinite scroll:

```typescript
import { InfiniteLoader } from 'react-window-infinite-loader'

<InfiniteLoader
  isItemLoaded={index => index < items.length}
  itemCount={totalCount}
  loadMoreItems={loadNextPage}
>
  {({ onItemsRendered, ref }) => (
    <List
      onItemsRendered={onItemsRendered}
      ref={ref}
      // ... other props
    />
  )}
</InfiniteLoader>
```

---

## Appendix: Complete Code Examples

### A. Complete Hook Implementation

See Step 1 above (already complete)

### B. Complete Page Integration

See Step 2 above (already complete)

### C. Alternative: Simple Pagination (Not Recommended)

For comparison, here's what page-based pagination would look like:

```typescript
// NOT RECOMMENDED - included for reference only
const [currentPage, setCurrentPage] = React.useState(1)
const pageSize = 50

const { data } = useQuery({
  queryKey: ['transfers', currentPage, filters],
  queryFn: () => fetchTransfers({ 
    ...filters, 
    page: currentPage, 
    pageSize 
  }),
})

// Requires RPC migration to support page parameter
// More complex for Kanban board (need page per column)
```

**Why Not**: Doesn't match existing cursor-based API

---

## References

- **TanStack Query Docs**: https://tanstack.com/query/latest/docs/react/guides/infinite-queries
- **React Window**: https://react-window.vercel.app/
- **Cursor Pagination Best Practices**: https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination

---

**Status**: 📋 READY FOR IMPLEMENTATION  
**Assigned**: TBD  
**Start Date**: TBD (after Option A deployed)  
**Est. Completion**: 1-2 days from start

---

**Last Updated**: October 12, 2025  
**Created By**: GitHub Copilot + Human MCP Brain  
**Reviewed By**: Pending  
**Approved By**: Pending
