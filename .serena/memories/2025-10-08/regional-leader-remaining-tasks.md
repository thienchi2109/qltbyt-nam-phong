# Regional Leader Feature: Remaining Tasks

**Last Updated:** October 8, 2025  
**Branch:** feat/regional_leader

## Completed Features ✅
1. ✅ Regional leader role database schema and RPC functions
2. ✅ Maintenance page facility filter (client-side)
3. ✅ Equipment page facility filter
4. ✅ Repair requests page facility filter
5. ✅ **Transfer page facility filter (just completed)**

## Remaining Tasks 🔲

### High Priority - Code Quality Refactoring

#### 1. **TODO: Consolidate Facility Filter Pattern** 🎯
**Priority:** Medium (Code quality improvement)  
**Estimated Effort:** 3-4 hours  
**Impact:** Reduces ~200 lines of duplicated code to ~80 lines

**Current Problem:**
- Same facility filter logic duplicated across 4 pages
- ~50 lines of code × 4 pages = 200 lines total
- 4 places to update when logic changes
- Risk of inconsistent behavior if one page updated differently

**Solution:**
Create shared custom hook: `src/hooks/useFacilityFilter.ts`

```typescript
// Proposed API
const { 
  selectedFacility, 
  setSelectedFacility, 
  facilities, 
  showFacilityFilter,
  filteredItems 
} = useFacilityFilter(items, userRole)
```

**Files to Update (all in one PR):**
1. `src/hooks/useFacilityFilter.ts` (new - create hook)
2. `src/app/(app)/maintenance/page.tsx` (update)
3. `src/app/(app)/equipment/page.tsx` (update)
4. `src/app/(app)/repair-requests/page.tsx` (update)
5. `src/app/(app)/transfers/page.tsx` (update)

**Benefits:**
- Single source of truth for facility filtering
- Easier to add features (localStorage, URL params, global cache)
- Consistent behavior guaranteed across all pages
- Easier to test and maintain
- Better TypeScript type safety with generics

**Testing Strategy:**
- Verify all 4 pages still work after refactoring
- Test regional_leader filtering on each page
- Test global user filtering on each page
- Ensure "Tất cả cơ sở" option works everywhere

**Optional Enhancements (can add later):**
- Persistent filter selection (localStorage)
- URL query param support (`?facility=123`)
- Global facility cache (React Context/Zustand)
- Loading states for facility fetching
- Error handling UI component
- Accessibility improvements (ARIA labels, keyboard shortcuts)

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

1. **Testing (High Priority)** - Ensure current implementation is solid
2. **Code Consolidation (Medium Priority)** - Clean up technical debt
3. **Kanban Toggle (Medium Priority)** - User-requested UX improvement
4. **Documentation (Medium Priority)** - Enable user adoption
5. **Performance Optimization (Low Priority)** - Nice to have

## Notes
- All facility filters use `get_facilities_with_equipment_count` RPC
- Security enforced server-side via `allowed_don_vi_for_session()`
- Client-side filtering only for UX (not security boundary)
- Regional leaders have read-only access consistently enforced across all pages
- Pattern consistency maintained: maintenance → equipment → repair-requests → transfers