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

### High Priority
1. **Kanban vs DataTable Toggle** (Deferred from initial request)
   - User requested: Add view toggle between Kanban and DataTable for transfers page
   - Reason: Kanban board doesn't scale well with many transfer requests
   - Impact: UX improvement for large-scale deployments
   - Files: `src/app/(app)/transfers/page.tsx`
   - Pattern: Similar to equipment page list/card toggle
   - Estimated effort: Medium (2-3 hours)

### Testing & Documentation
2. **End-to-End Testing**
   - Test regional_leader login with multiple facilities
   - Verify facility filters work on all pages
   - Test read-only enforcement on all pages
   - Verify cross-tenant isolation

3. **User Documentation**
   - Document regional_leader role capabilities
   - Create user guide for facility filtering
   - Document read-only restrictions

### Code Quality
4. **Consolidate Facility Filter Pattern**
   - Create shared hook: `useFacilityFilter()`
   - Reduce code duplication across pages
   - Centralize facility fetching logic
   - Files to consolidate: maintenance, equipment, repair-requests, transfers pages

### Performance
5. **Optimize Facility Fetching**
   - Consider caching facilities list globally
   - Use React Context or Zustand for facility state
   - Avoid re-fetching on every page navigation

## Notes
- All facility filters use `get_facilities_with_equipment_count` RPC
- Security enforced server-side via `allowed_don_vi_for_session()`
- Client-side filtering only for UX (not security boundary)
- Regional leaders have read-only access consistently enforced