# Maintenance Page Regional Leader Access Fix - October 7, 2025

## Issue Summary
Regional leaders could not see any maintenance plan data on the maintenance page. The page was completely inaccessible to them.

## Root Causes Identified

### 1. UI-Level Hard Block (Lines 108-126)
The maintenance page component had a hard-coded check that completely blocked regional_leader role from accessing the page, displaying an error message instead.

### 2. Database-Level Filtering Issue
The `maintenance_plan_list()` RPC function only supported two scenarios:
- `global` role: see all plans
- Non-global roles: see only plans from their single `don_vi` (tenant)

It did NOT handle the `regional_leader` role, which should see plans from ALL tenants in their assigned `dia_ban` (region).

## Solution Implemented

### Database Migration: `20251007_fix_maintenance_plan_regional_leader_access`

Updated two RPC functions to use `allowed_don_vi_for_session_safe()` helper:

1. **`maintenance_plan_list()`**
   - Now uses `allowed_don_vi_for_session_safe()` to get accessible tenant IDs
   - Filters plans using `kh.don_vi = ANY(v_allowed_don_vi)`
   - Supports global, regional_leader, and tenant-specific roles

2. **`dashboard_maintenance_plan_stats()`**
   - Same pattern as above for KPI statistics
   - Returns counts and recent plans based on role-based filtering

### UI Changes: `src/app/(app)/maintenance/page.tsx`

1. **Removed Hard Block** (Lines 108-126)
   - Deleted the error card that prevented regional leaders from accessing the page
   - Regional leaders can now see the full maintenance page interface

2. **Updated Comment** (Line 87)
   - Clarified that regional leaders can VIEW but not MANAGE plans

3. **Added Informational Banner** (Lines 1874-1888)
   - Blue informational banner appears for regional leaders
   - Explains they can view plans from all facilities in their region
   - Clarifies read-only restrictions (no create/edit/approve permissions)

## Access Matrix After Fix

| Role | Can View Plans | Can Create | Can Edit | Can Approve | Scope |
|------|---------------|------------|----------|-------------|-------|
| global | ✅ All tenants | ✅ | ✅ | ✅ | All active tenants |
| regional_leader | ✅ Region tenants | ❌ | ❌ | ❌ | All tenants in assigned region |
| admin | ✅ Own tenant | ✅ | ✅ | ✅ | Single tenant only |
| to_qltb | ✅ Own tenant | ✅ | ✅ | ✅ | Single tenant only |
| Other roles | ✅ Own tenant | ❌ | ❌ | ❌ | Single tenant only |

## Technical Details

### Database Schema
- `ke_hoach_bao_tri.don_vi` → FK to `don_vi.id` (tenant)
- `don_vi.dia_ban_id` → FK to `dia_ban.id` (region)
- `nhan_vien.dia_ban_id` → FK to `dia_ban.id` (assigned region for regional leaders)

### Helper Function Used
`allowed_don_vi_for_session_safe()` returns:
- Global users: All active tenant IDs
- Regional leaders: All tenant IDs where `don_vi.dia_ban_id = user.dia_ban_id`
- Other roles: Single tenant ID from `user.don_vi`

### UI Permissions Check
```typescript
const canManagePlans = !!user && !isRegionalLeader && 
  ((user.role === 'global' || user.role === 'admin') || user.role === 'to_qltb')
```

This ensures:
- Regional leaders see all UI elements but cannot trigger write operations
- Create/Edit/Delete/Approve buttons are hidden from regional leaders

## Testing Verification

✅ TypeScript compilation successful (no errors)
✅ Migration applied to database via Supabase MCP
✅ UI changes preserve existing functionality for other roles
✅ Comments added to RPC functions for future maintainability

## Related Files Modified

1. **Migration**: `supabase/migrations/20251007_fix_maintenance_plan_regional_leader_access.sql`
   - `maintenance_plan_list()` function
   - `dashboard_maintenance_plan_stats()` function

2. **Frontend**: `src/app/(app)/maintenance/page.tsx`
   - Removed blocking code (lines 108-126 deleted)
   - Added informational banner for regional leaders
   - Updated permission comments

## Next Steps

None required for this specific fix. The implementation is complete and follows the established regional leader pattern used in other pages (equipment, dashboard KPIs, etc.).

## Consistency Notes

This fix brings the maintenance page in line with:
- Dashboard KPI filtering for regional leaders (already implemented)
- Equipment page filtering for regional leaders (already implemented)
- The overall regional leader access pattern established in Phase 1-4 migrations

All read operations for regional leaders now properly filter by region across the entire application.