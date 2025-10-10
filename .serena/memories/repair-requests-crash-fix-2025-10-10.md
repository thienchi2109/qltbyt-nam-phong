# Repair Requests Crash Fix - October 10, 2025

## Issue Resolved
**P0 Critical**: Regional leaders experienced browser crash when selecting facility filter on `/repair-requests` page.

## Root Cause
Client-side filtering with React Table caused infinite re-renders when `regional_leader` users selected a facility from the dropdown.

## Solution Implemented

### Phase 0: Server-Side Filtering (Core Fix)
1. **Migration**: `supabase/migrations/20251010213621_add_facility_filter_to_repair_request_list.sql`
   - Added `p_don_vi BIGINT` parameter to `repair_request_list()` RPC function
   - Server-side WHERE clause: `AND (p_don_vi IS NULL OR tb.don_vi = p_don_vi)`
   - Filtering now happens at database level before reaching client

2. **Frontend Refactor**: `src/app/(app)/repair-requests/page.tsx`
   - Changed `useFacilityFilter` from `mode: 'client'` to `mode: 'server'`
   - RPC call passes `p_don_vi: selectedFacilityId` parameter
   - Removed all client-side filtering logic

### Phase 1: Defensive Safety Fixes
3. **Safe Accessor Function** (line 1154)
   - Fixed: `accessorFn: row => ${row.thiet_bi?.ten_thiet_bi} ${row.mo_ta_su_co}`
   - Added explicit null checks to prevent "undefined undefined" text in UI

4. **Tooltip for Count Badges** (lines 2055-2073)
   - Added explanatory tooltips to facility count badges
   - Clarifies that counts reflect currently displayed data

5. **Hook Null Safety**: `src/hooks/useFacilityFilter.ts` (line 142)
   - Added explicit null/undefined handling in filter comparison
   - Prevents issues if hook is used in client mode elsewhere

## Architecture Pattern
Follow Equipment page pattern for server-side filtering:
- Use `mode: 'server'` in `useFacilityFilter` hook
- Pass filter parameter to RPC function
- Let database handle filtering with WHERE clause

## Files Modified
- `supabase/migrations/20251010213621_add_facility_filter_to_repair_request_list.sql` (NEW)
- `src/app/(app)/repair-requests/page.tsx` (MODIFIED - lines 321-324, 428-437, 1154-1165, 2055-2073)
- `src/hooks/useFacilityFilter.ts` (MODIFIED - line 142)

## Test Files Created (Cleanup Needed)
- `supabase/migrations/COMPLETE_TEST_repair_request_list.sql`
- `supabase/migrations/TEST_WRAPPER_repair_request_list.sql`
- Function: `test_repair_request_list_as_global` (needs DROP)

## Status
✅ Migration applied to database
✅ Crash issue resolved (user confirmed)
✅ All Phase 0 and Phase 1 fixes complete
✅ TypeScript checks passing

## Documentation
- Implementation summary: `docs/session-notes/2025-10-10-repair-requests-IMPLEMENTATION_COMPLETE.md`
- GitHub issue: `docs/Issues/GITHUB_ISSUE_REPAIR_CRASH.md` (marked RESOLVED)
- Tracking doc: `docs/REMAINING_TASKS_repair_requests_filtering.md`

## Key Lessons
1. Server-side filtering is superior for large datasets and prevents client-side crashes
2. Always follow existing patterns (Equipment page pattern)
3. Defensive null-checking prevents edge cases
4. JWT wrapper functions enable SQL Editor testing
