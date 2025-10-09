# Regional Leader Feature: Remaining Tasks

**Last Updated:** October 9, 2025  
**Branch:** feat/regional_leader

## Latest Session Accomplishments (Oct 9, 2025) 🎉

### 1. ✅ **Facility Filter Consolidation - COMPLETED!**
**Duration:** ~2 hours  
**Impact:** Eliminated 180+ lines of duplicated code

**Created:** `src/hooks/useFacilityFilter.ts` - Dual-mode shared hook
- **Client mode**: Derives facilities from items, filters client-side
- **Server mode**: State-only for pages using server-side filtering
- **Type-safe**: Full TypeScript generics support
- **Flexible**: Supports both ID and name-based selection

**Refactored 4 pages:**
1. ✅ Repair Requests (`selectBy: 'name'`, client mode)
2. ✅ Transfers (`selectBy: 'id'`, client mode + RPC fallback)
3. ✅ Maintenance (`selectBy: 'id'`, client mode + RPC fallback)
4. ✅ Equipment (`selectBy: 'id'`, server mode - preserved server filtering)

**Key Features Added:**
- RPC fallback for pages with empty facility metadata
- Role-aware `get_facilities_with_equipment_count` RPC integration
- Automatic facility name enrichment
- Consistent UI behavior across all pages
- Fixed infinite loop bugs in facility fetching

### 2. ✅ **Maintenance Page TanStack Query Migration - COMPLETED!**
**Duration:** ~1.5 hours  
**Impact:** Better UX, cleaner code, consistency with Transfers page

**Added 3 new mutation hooks:**
1. ✅ `useApproveMaintenancePlan()`
2. ✅ `useRejectMaintenancePlan()`
3. ✅ `useDeleteMaintenancePlan()` (enhanced)

**Refactored maintenance page:**
- Removed manual loading states (3 useState declarations)
- Removed manual error handling (try/catch blocks)
- Removed manual refetch calls
- Added automatic cache invalidation
- Reduced mutation code by ~60 lines

**Benefits Achieved:**
- ✅ Automatic loading states (`mutation.isPending`)
- ✅ Centralized error handling (toasts in hooks)
- ✅ Smart cache invalidation (background refetch)
- ✅ Consistent pattern with Transfers page
- ✅ Ready for optimistic updates (future enhancement)

---

## Completed Features ✅
1. ✅ Regional leader role database schema and RPC functions
2. ✅ Maintenance page facility filter (client-side)
3. ✅ Equipment page facility filter (server-side)
4. ✅ Repair requests page facility filter (client-side)
5. ✅ Transfer page facility filter (client-side)
6. ✅ **Consolidated facility filter hook (`useFacilityFilter`)**
7. ✅ **Maintenance page TanStack Query mutations**
8. ✅ **Fixed infinite API loop in Maintenance facility fetch**
9. ✅ **Type coercion fixes for facility ID filtering**

---

## Remaining Tasks 🔲

### High Priority - Code Quality

#### 1. ~~**Consolidate Facility Filter Pattern**~~ ✅ COMPLETED (Oct 9, 2025)
**Status:** ✅ Done  
**Files Created:**
- `src/hooks/useFacilityFilter.ts` - 170 lines

**Files Updated:**
- `src/app/(app)/maintenance/page.tsx`
- `src/app/(app)/equipment/page.tsx` (preserved server mode)
- `src/app/(app)/repair-requests/page.tsx`
- `src/app/(app)/transfers/page.tsx`

**Results:**
- ✅ Single source of truth for facility filtering
- ✅ Consistent behavior across all pages
- ✅ Better TypeScript type safety
- ✅ Eliminated ~180 lines of duplicated code
- ✅ Added RPC fallback for missing metadata
- ✅ Fixed infinite loop bugs

---

### High Priority - UX Improvements

#### 2. **Kanban vs DataTable Toggle** (User requested, deferred)
**Priority:** Medium (UX improvement)  
**Estimated Effort:** 2-3 hours

- User requested: Add view toggle between Kanban and DataTable for transfers page
- Reason: Kanban board doesn't scale well with many transfer requests (100+ items)
- Impact: Better scalability for large-scale deployments
- Files: `src/app/(app)/transfers/page.tsx`
- Pattern: Similar to equipment page list/card toggle
- Implementation: Add state toggle, conditional rendering, localStorage persistence

---

### Testing & Documentation

#### 3. **End-to-End Testing**
**Priority:** High (Before production deployment)

- Test regional_leader login with multiple facilities
- Verify facility filters work on all 4 pages
- Test read-only enforcement on all pages (no create/edit/delete/approve)
- Verify cross-tenant isolation (can't see other regions' data)
- Test with empty facility list (edge case)
- Test with 50+ facilities (performance)

#### 4. **User Documentation**
**Priority:** Medium (User training)

- Document regional_leader role capabilities and limitations
- Create user guide for facility filtering feature
- Document read-only restrictions with screenshots
- Add FAQ section for common questions
- Vietnamese language translation for all docs

---

### Performance Optimization

#### 5. **Optimize Facility Fetching**
**Priority:** Low (Performance tuning)  
**Estimated Effort:** 2-3 hours

**Current State:**
- Each page fetches facilities independently on mount
- 4 separate API calls when navigating between pages
- No caching between page navigations

**Proposed Solution:**
- Option A: React Context for app-wide facility state
- Option B: Zustand store for global facility cache
- Option C: React Query with longer staleTime (simplest)

**Benefits:**
- Faster page transitions (no re-fetching)
- Reduced API load
- Better UX (instant filter population)

---

## Implementation Priority Order

1. ~~**Code Consolidation**~~ ✅ **COMPLETED** (Oct 9, 2025)
2. **Testing (High Priority)** - Ensure current implementation is solid
3. **Kanban Toggle (Medium Priority)** - User-requested UX improvement
4. **Documentation (Medium Priority)** - Enable user adoption
5. ~~**Performance Optimization**~~ ⚡ **PARTIALLY COMPLETED** - RPC fallback reduces redundant calls

---

## Technical Implementation Notes

### Facility Filtering Pattern
**Hook:** `src/hooks/useFacilityFilter.ts`

**Client Mode** (Repair Requests, Transfers, Maintenance):
```typescript
const { selectedFacilityId, facilities, filteredItems } = useFacilityFilter({
  mode: 'client',
  selectBy: 'id', // or 'name'
  items: data,
  userRole: user?.role,
  getFacilityId: (item) => item?.facility_id,
  getFacilityName: (item) => item?.facility_name,
})
```

**Server Mode** (Equipment page):
```typescript
const { selectedFacilityId, facilities } = useFacilityFilter({
  mode: 'server',
  userRole: user?.role,
  facilities: facilitiesFromRPC,
  initialSelectedId: null,
})
```

### TanStack Query Mutations
**Maintenance Page Pattern:**
```typescript
const approveMutation = useApproveMaintenancePlan()
approveMutation.mutate({ id, nguoi_duyet }, {
  onSuccess: () => { /* update local state */ },
  onError: () => { /* handled in hook */ }
})
```

**Benefits:**
- Automatic loading states via `mutation.isPending`
- Centralized error handling with toasts
- Smart cache invalidation (background refetch)
- Ready for optimistic updates

### Security Model
- All facility filters use `get_facilities_with_equipment_count` RPC
- Security enforced server-side via `allowed_don_vi_for_session_safe()`
- Client-side filtering only for UX (not security boundary)
- Regional leaders have read-only access consistently enforced
- Role hierarchy: `global` → `regional_leader` → `to_qltb/admin` → others

### Data Flow
1. **Server-side**: RPC filters by allowed facilities (security)
2. **Hook derives**: Facilities from items or fetches via RPC fallback
3. **Client filters**: Pure UX enhancement on pre-filtered data
4. **No data leakage**: Impossible to see unauthorized facilities

---

## Code Quality Metrics

### Before Consolidation:
- 4 pages × ~50 lines = **200 lines** of duplicated code
- 4 separate implementations to maintain
- Inconsistent patterns (some by ID, some by name)
- No RPC fallback handling

### After Consolidation:
- 1 shared hook = **170 lines** (single source of truth)
- 4 pages call hook = **~40 lines total** (10 lines each)
- **Net savings: ~180 lines eliminated**
- Consistent API across all pages
- Built-in RPC fallback
- TypeScript generics for type safety

### Code Coverage:
- ✅ Repair Requests: Client mode (by name)
- ✅ Transfers: Client mode (by ID) + RPC fallback
- ✅ Maintenance: Client mode (by ID) + RPC fallback  
- ✅ Equipment: Server mode (preserved existing pattern)

---

## Next Session Recommendations

1. **End-to-End Testing** (3-4 hours)
   - Test all 4 pages with regional_leader role
   - Verify facility filters with 0, 1, 10, 50+ facilities
   - Test RPC fallback on Maintenance/Transfers
   - Verify no infinite loops or memory leaks

2. **Performance Monitoring** (1 hour)
   - Check network tab for redundant API calls
   - Verify React Query cache is working
   - Test page navigation speed
   - Monitor memory usage with large datasets

3. **User Documentation** (2-3 hours)
   - Document facility filter usage
   - Screenshot regional_leader view
   - Explain read-only restrictions
   - Vietnamese translation
