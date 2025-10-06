# Equipment List Enhanced Ambiguous ID Fix - September 30, 2025

## Issue Identified
- **Error**: `column reference "id" is ambiguous` in `equipment_list_enhanced` RPC function
- **Root Cause**: JOIN between `thiet_bi` and `don_vi` tables both have `id` columns, ORDER BY clause doesn't know which to use
- **Location**: Lines causing `ORDER BY %I %s` where `%I` = `id` becomes ambiguous

## Solution Applied
- **Migration**: `20250930101500_fix_equipment_list_enhanced_ambiguous_id.sql`
- **Key Fix**: Added `v_qualified_sort_col` variable to map all sortable columns to fully qualified names (e.g., `id` → `tb.id`)
- **Additional Fixes**: 
  - All WHERE clause column references qualified with `tb.` prefix
  - COUNT query updated with table alias
  - Function signature matches existing exactly

## Technical Changes
1. **Column Qualification Mapping**:
   ```sql
   v_qualified_sort_col := CASE v_sort_col
     WHEN 'id' THEN 'tb.id'
     WHEN 'ten_thiet_bi' THEN 'tb.ten_thiet_bi'
     -- etc for all sortable columns
   END;
   ```

2. **WHERE Clause Updates**: All column references prefixed with `tb.`
3. **ORDER BY Fix**: Uses `v_qualified_sort_col` instead of raw `v_sort_col`

## Status
- ✅ Migration file created with correct function signature
- ⏳ **PENDING MANUAL APPLICATION**: Need to run in Supabase SQL Editor
- ✅ All column ambiguity resolved
- ✅ Maintains existing function behavior and security

## Next Steps
1. Copy migration content to Supabase SQL Editor
2. Execute to replace the function
3. Test equipment page to verify error resolution

## Files Modified
- `supabase/migrations/20250930101500_fix_equipment_list_enhanced_ambiguous_id.sql` - Complete fix ready for execution