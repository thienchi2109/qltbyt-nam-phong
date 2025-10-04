# Equipment Multi-Department Filter UX Fix - 2025-09-27

## Issue Resolved
✅ **Multi-select department filter showing incorrect total record counts**

### Problem Description
- Department filter allows multiple selections (UX expectation)
- When 2+ departments selected, total record count at bottom left was incorrect
- Users reported pagination info not reflecting true total across all selected departments

### Root Cause Analysis
1. **Server-side limitation**: `equipment_list_enhanced` RPC only accepted single `p_khoa_phong TEXT` parameter
2. **Client-side workaround**: `getSingleFilter()` function returned `null` when multiple values selected
3. **Result**: Multi-select UI with single-select backend = broken UX

### Solution Implemented

#### 1. Database Migration
**File**: `supabase/migrations/20250927123900_equipment_list_enhanced_multi_department.sql`

Enhanced RPC with new parameter:
- Added `p_khoa_phong_array TEXT[] DEFAULT NULL` for multi-select support
- Maintained `p_khoa_phong TEXT` for backward compatibility
- Logic prioritizes array parameter over single parameter
- Uses `= ANY(array)` SQL syntax for efficient multi-value filtering

**Key changes**:
```sql
-- Handle department filtering: prioritize array over single value
IF p_khoa_phong_array IS NOT NULL AND array_length(p_khoa_phong_array, 1) > 0 THEN
  -- Multiple departments: use ANY for efficient IN clause
  v_where := v_where || ' AND khoa_phong_quan_ly = ANY(' || quote_literal(p_khoa_phong_array) || '::text[])';
ELSIF p_khoa_phong IS NOT NULL AND trim(p_khoa_phong) != '' THEN
  -- Single department: backward compatibility
  v_where := v_where || ' AND khoa_phong_quan_ly = ' || quote_literal(p_khoa_phong);
END IF;
```

#### 2. Client-Side Updates
**File**: `src/app/(app)/equipment/page.tsx`

**Added helper function** (lines 1038-1042):
```typescript
const getArrayFilter = React.useCallback((id: string): string[] => {
  const entry = (columnFilters || []).find((f) => f.id === id)
  return (entry?.value as string[] | undefined) || []
}, [columnFilters])
```

**Updated query logic** (lines 1057, 1064, 1077):
```typescript
const selectedDepartments = getArrayFilter('khoa_phong_quan_ly')
// ... in queryKey:
khoa_phong_array: selectedDepartments,
// ... in queryFn args:
p_khoa_phong_array: selectedDepartments.length > 0 ? selectedDepartments : null,
```

### Technical Benefits

1. **Accurate Pagination**: Total record counts now reflect all selected departments
2. **Backward Compatible**: Single department filtering still works via legacy parameter
3. **Performance**: Uses SQL `= ANY(array)` for efficient multi-value queries
4. **Type Safe**: TypeScript compilation passes with proper array handling
5. **Cache Efficient**: Query keys include full department array for proper invalidation

### UX Impact

**Before**:
- Select "Dược" + "Xét nghiệm" → Shows total for only one department (incorrect)
- Pagination info misleading users about actual filtered results

**After**:
- Select "Dược" + "Xét nghiệm" → Shows combined total across both departments (correct)
- Pagination accurately reflects multi-department result set
- Consistent behavior between single and multi-select scenarios

### Multi-Tenant Compliance
- ✅ Maintains tenant isolation via existing JWT validation
- ✅ Department array filtering respects user's tenant scope  
- ✅ Global users can filter across selected tenant's departments
- ✅ Regular users limited to their own tenant's departments

### Testing Status
- ✅ TypeScript compilation passes
- ✅ Migration follows naming convention
- ✅ RPC signature includes proper grants
- ✅ Client-side logic handles empty arrays gracefully

### Migration Instructions
1. Apply migration: `supabase db push`
2. Verify RPC updated with new parameter
3. Test multi-select department filtering in equipment page
4. Confirm total counts are accurate for multiple selections

This fix ensures the equipment page provides accurate record counts and pagination info when multiple departments are selected, maintaining a consistent and reliable user experience.