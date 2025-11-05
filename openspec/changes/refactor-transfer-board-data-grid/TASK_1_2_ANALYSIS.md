# Task 1 & 2 Analysis - Transfer Board Refactoring

**Date**: 2025-11-04  
**Status**: Complete

---

## Task 1: Planning & Alignment

### 1.1 ✅ Confirm No Active OpenSpec Changes
**Status**: Verified - NO conflicts

**Active OpenSpec Changes**:
- Only `refactor-transfer-board-data-grid` (this proposal) is in Draft status
- All other changes are archived

**Conclusion**: **Clear to proceed** - no risk of merge conflicts with transfer UI/API

---

### 1.2 ✅ Review Existing Grid Implementations

**Reusable Components Identified**:

#### From Repair Requests (`src/app/(app)/repair-requests/`)
1. **FilterChips Component** (`_components/FilterChips.tsx`)
   - Displays active filters as removable badges
   - Supports: status array, facility name, date range
   - "Clear all" button functionality
   - **Reusable**: Can adapt for transfers (add type filter)

2. **FilterModal Component** (`_components/FilterModal.tsx`)
   - Dialog/Sheet variant for mobile responsiveness
   - Status multi-select (button grid)
   - Facility dropdown
   - Date range pickers (from/to with Calendar)
   - **Reusable**: Can adapt STATUS_OPTIONS for transfer statuses

#### From Maintenance (`src/app/(app)/maintenance/`)
3. **Server-Side Pagination Pattern**
   ```typescript
   const [currentPage, setCurrentPage] = React.useState(1)
   const [pageSize, setPageSize] = React.useState(50)
   const { data: paginatedResponse, isLoading } = useMaintenancePlans({
     search: debouncedPlanSearch,
     facilityId: selectedFacilityId,
     page: currentPage,
     pageSize,
   })
   ```

4. **TanStack Table Integration**
   - Column definitions with sorting
   - Actions column with role-based buttons
   - Pagination footer (ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight)
   - Mobile card fallback

**Key Patterns to Follow**:
- ✅ **Debounced search** - `useSearchDebounce()` hook
- ✅ **Facility filtering** - `useFacilityFilter()` hook with mode: 'server'
- ✅ **Status badges** - Display counts from counts endpoint
- ✅ **TanStack Query** - Separate hooks for list + counts
- ✅ **Mobile responsiveness** - FilterModal with Sheet variant

---

### 1.3 ✅ Identify Kanban-Specific Files for Deletion

**Files to Delete** (9 files total):

#### Components (5 files)
1. `src/components/transfers/VirtualizedKanbanColumn.tsx` - Custom virtualization logic
2. `src/components/transfers/TransferCard.tsx` - Kanban-specific card layout
3. `src/components/transfers/DensityToggle.tsx` - Kanban density modes
4. `src/components/transfers/CollapsibleLane.tsx` - Kanban column collapse

#### Hooks (1 file)
5. `src/hooks/useTransfersKanban.ts` - Kanban data fetching hooks

#### Types (1 file)
6. `src/types/transfer-kanban.ts` - Kanban-specific type definitions

#### Utilities (1 file)
7. `src/lib/kanban-preferences.ts` - LocalStorage for density/collapse state

#### API Routes (1 file)
8. `src/app/api/transfers/kanban/route.ts` - Kanban grouping API

**Files to Keep/Refactor**:
- ✅ `src/components/transfers/FilterBar.tsx` - Refactor to use FilterModal pattern
- ✅ `src/app/api/transfers/counts/route.ts` - Keep but update to new RPC
- ✅ `src/lib/transfer-normalizer.ts` - May still be useful for data normalization

**Files with Import Dependencies** (to update):
- `src/app/(app)/transfers/page.tsx` - Main page (full rewrite)
- Dialog components (AddTransferDialog, EditTransferDialog, TransferDetailDialog, HandoverPreviewDialog)

---

## Task 2: Database / RPC Layer Design

### 2.1 ✅ Design SQL for `transfer_request_list`

**Current State** (`get_transfers_kanban`):
- ✅ Accepts 9 parameters (facility, assignee, types, statuses, dates, search, limit, cursor)
- ✅ Returns all columns + joined equipment data
- ✅ Uses INNER JOIN for strict tenant isolation
- ✅ Enforces `allowed_don_vi_for_session()` for non-global users
- ⚠️ Returns TABLE format (not JSONB) - needs conversion for data grid pattern

**Required Changes for `transfer_request_list`**:

#### Signature Changes
```sql
CREATE OR REPLACE FUNCTION public.transfer_request_list(
  p_q TEXT DEFAULT NULL,                    -- Search text
  p_statuses TEXT[] DEFAULT NULL,           -- Multi-status filter
  p_types TEXT[] DEFAULT NULL,              -- Transfer types (noi_bo, ben_ngoai)
  p_page INT DEFAULT 1,                     -- Page number
  p_page_size INT DEFAULT 50,               -- Items per page
  p_don_vi BIGINT DEFAULT NULL,             -- Facility filter (global users)
  p_date_from DATE DEFAULT NULL,            -- Date range start
  p_date_to DATE DEFAULT NULL,              -- Date range end
  p_assignee_ids BIGINT[] DEFAULT NULL      -- Assignee filter (optional)
)
RETURNS JSONB
```

#### Return Format (Match Repair Requests Pattern)
```json
{
  "data": [...],  // Array of transfer objects
  "total": 123,   // Total count (for pagination)
  "page": 1,      // Current page
  "pageSize": 50  // Items per page
}
```

#### Key Differences from Current RPC
1. **Return JSONB** (not TABLE) - Consistent with repair_request_list
2. **Offset-based pagination** (not cursor) - Simpler for table pagination
3. **Rename parameters** - Match repair request naming (`p_q`, `p_don_vi`, etc.)
4. **Remove p_limit/p_cursor** - Use p_page/p_page_size instead
5. **Use `allowed_don_vi_for_session()`** - Reuse existing helper for regional_leader support

---

### 2.2 ✅ Design `transfer_request_counts`

**Current State** (`get_transfer_counts`):
- ✅ Accepts 1 parameter (facility_ids)
- ⚠️ Returns TABLE with count columns
- ⚠️ Does NOT accept other filters (date, search, assignee)

**Required Changes for `transfer_request_counts`**:

#### Signature
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

#### Return Format (Match Repair Requests Pattern)
```json
{
  "cho_duyet": 12,
  "da_duyet": 8,
  "dang_luan_chuyen": 15,
  "da_ban_giao": 5,
  "hoan_thanh": 45
}
```

**Note**: Excludes `p_statuses` parameter - counts should reflect ALL statuses for current non-status filters

---

### 2.3 ✅ Migration Plan

**File**: `supabase/migrations/20251104_transfer_data_grid_rpcs.sql`

**Structure**:
1. Drop old functions (clean migration)
   ```sql
   DROP FUNCTION IF EXISTS get_transfers_kanban(...);
   DROP FUNCTION IF EXISTS get_transfer_counts(...);
   ```

2. Create `transfer_request_list` (based on repair_request_list pattern)
3. Create `transfer_request_counts` (based on repair_request_status_counts pattern)
4. Reuse existing indexes (already optimized for these queries)
5. Add EXPLAIN ANALYZE queries for testing
6. Add tenant isolation test snippets

**Performance Indexes** (Already Exist):
- ✅ `idx_transfers_kanban_facility_status_date` - Status + date sorting
- ✅ `idx_transfers_kanban_assignee_date` - Assignee filter
- ✅ `idx_transfers_kanban_search` - Full-text search (GIN index)
- ✅ `idx_thiet_bi_don_vi_join` - Equipment JOIN optimization

---

### 2.4 ✅ Tenant Isolation Test Plan

**Test Scenarios**:

1. **Global user** - Can specify any facility or none
2. **Regional leader** - Can view multiple facilities in their region
3. **Non-global user** - Forced to their single don_vi
4. **Malicious attempt** - Non-global user tries to request other facilities (should fail)

**SQL Test Snippets** (to include in migration):
```sql
-- Test 1: Global user (no restrictions)
SET request.jwt.claims = '{"app_role":"global"}';
SELECT jsonb_array_length(data) FROM (
  SELECT transfer_request_list() AS result
) t, LATERAL jsonb_extract_path(result, 'data') data;

-- Test 2: Non-global user (forced tenant)
SET request.jwt.claims = '{"app_role":"to_qltb","don_vi":"5"}';
SELECT transfer_request_list(p_don_vi := 10); -- Should return empty (no access to facility 10)

-- Test 3: Regional leader (multi-tenant)
-- (Requires allowed_don_vi_for_session() to return array)
```

---

## Summary

### ✅ Task 1 Complete
- No active OpenSpec conflicts
- Reusable components identified (FilterChips, FilterModal, pagination patterns)
- 9 files marked for deletion

### ✅ Task 2 Design Complete
- `transfer_request_list` signature defined (JSONB return, offset pagination)
- `transfer_request_counts` signature defined (JSONB return, mirrors filters)
- Migration plan outlined
- Tenant isolation test scenarios documented

### Next: Proceed to Implementation
- Create migration SQL file
- Write RPC functions
- Add EXPLAIN ANALYZE queries
- Add tenant isolation tests
