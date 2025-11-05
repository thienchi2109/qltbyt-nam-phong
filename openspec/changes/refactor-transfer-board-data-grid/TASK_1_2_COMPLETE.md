# Tasks 1 & 2 Complete - Transfer Board Refactoring

**Date**: 2025-11-04  
**Status**: ✅ Complete  
**Next**: Proceed to Task 3 (Next.js API Routes)

---

## Completed Tasks

### ✅ Task 1: Planning & Alignment

#### 1.1 Confirmed No Active Conflicts
- Verified only this proposal (`refactor-transfer-board-data-grid`) is active
- All other OpenSpec changes are archived
- **Clear to proceed** with no merge conflict risks

#### 1.2 Reusable Components Identified

**From Repair Requests**:
- `FilterChips.tsx` - Active filter badges with remove buttons
- `FilterModal.tsx` - Modal/Sheet filter UI (desktop/mobile)

**Patterns to Reuse**:
- Debounced search (`useSearchDebounce` hook)
- Server-side pagination (page/pageSize state)
- TanStack Table with actions column
- Facility filtering (`useFacilityFilter` hook)

#### 1.3 Files for Deletion (9 files)

**Components**:
- `src/components/transfers/VirtualizedKanbanColumn.tsx`
- `src/components/transfers/TransferCard.tsx`
- `src/components/transfers/DensityToggle.tsx`
- `src/components/transfers/CollapsibleLane.tsx`

**Utilities**:
- `src/hooks/useTransfersKanban.ts`
- `src/types/transfer-kanban.ts`
- `src/lib/kanban-preferences.ts`

**API Routes**:
- `src/app/api/transfers/kanban/route.ts`

**Keep/Refactor**:
- `src/components/transfers/FilterBar.tsx` - Refactor to FilterModal pattern
- `src/app/api/transfers/counts/route.ts` - Update to new RPC
- `src/lib/transfer-normalizer.ts` - May still be useful

---

### ✅ Task 2: Database / RPC Layer

#### 2.1 transfer_request_list RPC

**Function Signature**:
```sql
CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,                    -- Search
  p_statuses TEXT[] DEFAULT NULL,           -- Status filter
  p_types TEXT[] DEFAULT NULL,              -- Type filter
  p_page INT DEFAULT 1,                     -- Page number
  p_page_size INT DEFAULT 50,               -- Items per page
  p_don_vi BIGINT DEFAULT NULL,             -- Facility (global only)
  p_date_from DATE DEFAULT NULL,            -- Date range start
  p_date_to DATE DEFAULT NULL,              -- Date range end
  p_assignee_ids BIGINT[] DEFAULT NULL      -- Assignee filter
)
RETURNS JSONB
```

**Return Format**:
```json
{
  "data": [...],  // Array of transfer objects with equipment joined
  "total": 123,   // Total count (for pagination)
  "page": 1,      // Current page
  "pageSize": 50  // Items per page
}
```

**Key Features**:
- ✅ JSONB return (matches repair_request_list pattern)
- ✅ Offset-based pagination (not cursor)
- ✅ Tenant isolation via `allowed_don_vi_for_session()`
- ✅ VN timezone for date filtering
- ✅ Full-text search (equipment, transfer code, reason)

#### 2.2 transfer_request_counts RPC

**Function Signature**:
```sql
CREATE OR REPLACE FUNCTION public.transfer_request_counts(
  p_q TEXT DEFAULT NULL,
  p_don_vi BIGINT DEFAULT NULL,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_types TEXT[] DEFAULT NULL,
  p_assignee_ids BIGINT[] DEFAULT NULL
)
RETURNS JSONB
```

**Return Format**:
```json
{
  "cho_duyet": 12,
  "da_duyet": 8,
  "dang_luan_chuyen": 15,
  "da_ban_giao": 5,
  "hoan_thanh": 45
}
```

**Key Features**:
- ✅ Mirrors list filters (except status)
- ✅ Same tenant isolation logic
- ✅ Efficient CTE with COUNT FILTER

#### 2.3 Migration SQL Created

**File**: `supabase/migrations/20251104_transfer_data_grid_rpcs.sql`

**Structure**:
1. Drop old kanban functions (clean migration)
2. Create `transfer_request_list` (238 lines)
3. Create `transfer_request_counts` (87 lines)
4. EXPLAIN ANALYZE test queries (5 scenarios)
5. Tenant isolation test snippets (6 test cases)
6. Index verification queries

**Performance**:
- Reuses existing indexes (no new indexes needed)
- `idx_transfers_kanban_facility_status_date` - Status + date sorting
- `idx_transfers_kanban_assignee_date` - Assignee filter
- `idx_transfers_kanban_search` - Full-text search (GIN)
- `idx_thiet_bi_don_vi_join` - Equipment JOIN optimization

#### 2.4 Tenant Isolation Tests

**Test Scenarios Documented**:
1. Global user - Can see all facilities or filter by any
2. Global user - Can filter to specific facility
3. Non-global user - Sees only their facility
4. Non-global user - Cannot access other facilities (returns empty)
5. Regional leader - Can see multiple facilities via allowed list
6. Counts endpoint - Respects same isolation rules

**SQL Snippets**: Included in migration file (commented)

---

## Deliverables

### Files Created

1. **TASK_1_2_ANALYSIS.md** - Comprehensive analysis document
2. **TASK_1_2_COMPLETE.md** - This completion summary
3. **supabase/migrations/20251104_transfer_data_grid_rpcs.sql** - Migration with RPC functions

### Updates

1. **proposal.md** - Added decisions section, removed feature flag approach
2. **tasks.md** - Added file deletion checklist, enhanced QA tasks

---

## Next Steps (Task 3)

### 3.1 Scaffold API Routes
- Create `/api/transfers/list` (calls transfer_request_list)
- Update `/api/transfers/counts` (calls transfer_request_counts)

### 3.2 Update RPC Allowlist
- Add `transfer_request_list` to `ALLOWED_FUNCTIONS` in `/api/rpc/[fn]/route.ts`
- Add `transfer_request_counts` to `ALLOWED_FUNCTIONS`

### 3.3 Delete Kanban Route
- Remove `/api/transfers/kanban/route.ts`

---

## Key Design Decisions

### Why JSONB Return Format?
- Consistent with repair_request_list
- Single HTTP response (no multi-query overhead)
- Client receives structured data + metadata

### Why Offset Pagination?
- Simpler than cursor for table navigation
- Users expect page numbers (1, 2, 3...)
- No issues with data consistency in this use case

### Why Drop Old Functions?
- Clean migration (no function overloading ambiguity)
- Forces clients to update to new API
- Avoids dead code accumulation

### Why Reuse Indexes?
- Existing indexes already optimized for these queries
- No additional disk space needed
- Query planner will use them automatically

---

## Performance Expectations

**Baseline** (from current kanban implementation):
- ~500 transfers typical dataset
- 50-100ms query time for filtered results
- 10-20ms for counts query

**Expected** (with new data grid RPCs):
- **Same or better** (same indexes, simpler pagination)
- **Lower frontend complexity** (no virtualization overhead)
- **Better mobile performance** (fewer DOM nodes)

---

## Migration Safety

### Rollback Plan
```sql
-- Drop new functions
DROP FUNCTION IF EXISTS public.transfer_request_list(...);
DROP FUNCTION IF EXISTS public.transfer_request_counts(...);

-- Restore old functions
-- (Run 20251012120000_kanban_server_side_filtering.sql)
```

### Testing Before Deployment
1. Run migration in Supabase SQL Editor
2. Execute all EXPLAIN ANALYZE queries
3. Verify tenant isolation tests pass
4. Check `pg_stat_user_indexes` for index usage
5. Manual smoke test with different roles

---

## Summary

✅ **Task 1 Complete**: Planning done, reusable components identified, files marked for deletion  
✅ **Task 2 Complete**: RPC functions designed, migration written, tests documented

**Ready to proceed to Task 3**: Next.js API Routes implementation
