# Fix Reports "All Facilities" Aggregation - Executive Summary

## Quick Overview

**Problem**: When regional_leader or global users select "all facilities" in the Reports page, KPI cards show incorrect values (only showing data from one facility instead of aggregated totals).

**Solution**: Implement backend aggregate RPCs and update frontend to properly sum data across multiple facilities.

**Estimated Effort**: 5.5-6.5 days

## What's Wrong?

### For Regional Leaders
- When selecting "Tất cả cơ sở (vùng)", reports only show PRIMARY facility data
- Should show aggregated data from ALL allowed facilities in their region
- Example: If managing 3 facilities with 50+30+20 imports each, should show 100 total, not just 50

### For Global Users  
- When selecting "Tất cả đơn vị", backend returns all data correctly BUT:
- Frontend doesn't aggregate properly
- KPI cards may show incorrect totals

### Root Cause
1. Frontend passes `null` to backend when "all" selected
2. Backend RPCs handle `null` differently for global vs regional_leader
3. Regional_leader falls back to primary facility only
4. No aggregation logic in place for multi-facility scenarios

## Proposed Solution

### Backend (Phase 1)
Create new aggregate RPC functions:
- `equipment_aggregates_for_reports(p_don_vi_array BIGINT[])` 
- `transfer_aggregates_for_reports(p_don_vi_array BIGINT[])`
- `departments_list_for_facilities(p_don_vi_array BIGINT[])`

These will:
- Accept array of facility IDs
- Validate authorization (regional_leader can only access allowed facilities)
- Execute efficient SQL aggregation using GROUP BY
- Return aggregated totals in single query

### Frontend (Phase 2)
Update data fetching hooks:
- Detect when "all facilities" is selected
- Fetch list of allowed facilities
- Call aggregate RPCs instead of regular RPCs
- Display aggregated KPIs
- Show informational message that detailed transaction table unavailable for "all" mode

### UI Changes
- KPI cards show proper aggregated totals
- Add notice: "📊 Displaying aggregated data from all facilities. Detailed transaction table not available in this mode."
- Hide/disable detailed transaction tables when "all" selected
- Charts adapt or show message

## Implementation Phases

### Phase 1: Backend RPCs (2-3 days)
- Create `equipment_aggregates_for_reports` 
- Create `transfer_aggregates_for_reports`
- Update `departments_list_for_facilities`
- Add comprehensive authorization checks
- Write SQL tests

### Phase 2: Frontend Hooks (2 days)
- Update `useInventoryData` to detect "all" mode
- Add facilities list fetching
- Implement aggregate RPC calls
- Update query keys for proper caching
- Similar changes for maintenance and usage tabs

### Phase 3: Testing (1 day)
- Unit tests for RPCs
- Integration tests for authorization
- Manual QA for all user roles
- Performance testing

### Phase 4: Documentation (0.5 day)
- Technical documentation
- User-facing documentation
- Update data flow diagrams

## Key Design Decisions

### ✅ New Aggregate RPCs (Chosen)
**Why**: 
- Clean, purpose-built functions
- No breaking changes
- Efficient SQL aggregation
- Clear separation of concerns

### ❌ Frontend Aggregation (Rejected)
**Why**: Multiple RPC calls, slow, complex

### ❌ Modify Existing RPCs (Rejected)  
**Why**: Breaking changes, backward compatibility issues

### ❌ Remove "All" Option (Rejected)
**Why**: Poor UX, doesn't solve user need

## Risk Mitigation

### Performance Risk
- **Risk**: Aggregate queries across many facilities could be slow
- **Mitigation**: Proper indexes, SQL optimization, caching

### Authorization Risk
- **Risk**: Regional_leader accessing unauthorized facilities
- **Mitigation**: Rigorous validation using `allowed_don_vi_for_session_safe()`

### Data Consistency Risk
- **Risk**: Aggregates not matching sum of individual queries
- **Mitigation**: Comprehensive integration tests, validation queries

## Success Criteria

- [x] Regional leader "all" → aggregated data from allowed facilities
- [x] Global "all" → system-wide aggregated data
- [x] KPI cards show correct sums
- [x] No unauthorized data access
- [x] Query performance < 3 seconds
- [x] No breaking changes to existing code

## Migration Plan

1. **Deploy backend** migration (aggregate RPCs)
2. **Test in staging** - verify RPCs work correctly
3. **Deploy frontend** changes
4. **Monitor** performance and errors
5. **Rollback if needed** - revert frontend, disable "all" option temporarily

## Files to Change

### Backend
- `supabase/migrations/YYYY-MM-DD/NNNN_add_equipment_aggregates_rpc.sql` (new)
- `supabase/migrations/YYYY-MM-DD/NNNN_add_transfer_aggregates_rpc.sql` (new)
- `supabase/migrations/YYYY-MM-DD/NNNN_update_departments_list_rpc.sql` (new)

### Frontend  
- `src/app/(app)/reports/hooks/use-inventory-data.ts` (modify)
- `src/app/(app)/reports/hooks/use-maintenance-data.ts` (modify)
- `src/app/(app)/reports/hooks/use-usage-analytics.ts` (modify)
- `src/app/(app)/reports/components/inventory-report-tab.tsx` (modify)
- `src/app/(app)/reports/components/maintenance-report-tab.tsx` (modify)

## Next Steps

1. **Review proposal** with team
2. **Get approval** for approach
3. **Start Phase 1** - backend RPCs
4. **Iterative development** with testing
5. **Deploy to staging** first
6. **Production deployment** after QA sign-off

---

For detailed technical specification, see [proposal.md](./proposal.md)
