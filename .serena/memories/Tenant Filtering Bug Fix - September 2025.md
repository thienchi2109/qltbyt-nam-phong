# Tenant Filtering Bug Fix - September 16, 2025

## Issue Summary
The tenant filtering functionality in the Equipment page was not working correctly. Despite the proxy correctly setting JWT claims with `appRole: 'global'` and passing the correct `p_don_vi` parameter to the `equipment_list` RPC, the function was still returning equipment from all tenants instead of the filtered results.

## Root Cause Analysis
The bug was located in the `equipment_list` SQL function in `supabase/migrations/20250915_claims_compat.sql` (lines 34-49). The issue was a logical flaw in the control flow:

```sql
IF v_role = 'global' THEN
  -- When tenant filter provided
  IF p_don_vi IS NOT NULL THEN
    RETURN QUERY EXECUTE format(...) -- Returns filtered results
  END IF;
  
  -- This ALSO executes when p_don_vi IS NOT NULL
  RETURN QUERY EXECUTE format(...) -- Returns ALL equipment (unfiltered)
ELSE
  -- Non-global logic
END IF;
```

Both `RETURN QUERY` statements were executing when `v_role = 'global'` and `p_don_vi IS NOT NULL`, causing the function to return both the filtered results AND all unfiltered results.

## Solution Implemented
Created a new migration `20250916_fix_equipment_list_double_return.sql` that fixes the control flow by adding a `RETURN` statement after the first filtered query:

```sql
IF v_role = 'global' THEN
  IF p_don_vi IS NOT NULL THEN
    RETURN QUERY EXECUTE format(...) -- Returns filtered results
    RETURN; -- CRITICAL FIX: Exit here to prevent executing unfiltered query
  END IF;
  
  -- Only executes when p_don_vi IS NULL
  RETURN QUERY EXECUTE format(...) -- Returns all equipment
ELSE
  -- Non-global logic
END IF;
```

## Additional Improvements
1. **User-Friendly Toast Notification**: Updated the Equipment page to show a more informative toast when tenant filtering is applied:
   - Before: `"Đang lọc theo đơn vị - ID: 3"`
   - After: `"✅ Đã áp dụng bộ lọc đơn vị - Hiển thị thiết bị thuộc [Tenant Name]"`

## Verification
- Proxy logs confirmed correct JWT claims: `{ appRole: 'global', donVi: '1', userId: '1', originalRole: 'global' }`
- RPC call body confirmed correct tenant filter: `{ p_don_vi: 3 }`
- After fix: Equipment data now correctly shows only records with the selected `don_vi`
- Toast notifications are now user-friendly and informative

## Files Modified
1. `supabase/migrations/20250916_fix_equipment_list_double_return.sql` - New migration fixing the SQL function
2. `src/app/(app)/equipment/page.tsx` - Updated toast notification for better UX

## Impact
- ✅ Tenant filtering now works correctly for global/admin users
- ✅ Equipment data is properly scoped by selected tenant
- ✅ Improved user experience with friendly notifications
- ✅ No breaking changes to existing functionality

This fix ensures that the multi-tenant architecture works as intended, preventing cross-tenant data leakage and providing proper data isolation.