# Regional Leader Implementation - Session Notes
**Date**: October 4, 2025  
**Session Duration**: ~2 hours  
**Participants**: Developer + AI Assistant

## Session Overview
Fixed critical bugs preventing regional leader users from accessing equipment data and using filter dropdowns on the Equipment page.

## Problems Identified

### 1. Equipment Page 400 Error (FIXED ✅)
**Issue**: Regional leader users received 400 Bad Request when loading Equipment page  
**Root Cause**: Malformed SQL array literal in `equipment_list_enhanced` function  
**Symptom**: `malformed array literal: "15"`

**Fix Applied** (Migration `20251004090000`):
```sql
-- BEFORE (BROKEN)
v_where := v_where || ' AND don_vi = ANY(' || quote_literal(v_allowed_don_vi) || ')';
-- Generated SQL: don_vi = ANY('"15"')  -- Invalid!

-- AFTER (FIXED)
v_where := v_where || ' AND don_vi = ANY(ARRAY[' || array_to_string(v_allowed_don_vi, ',') || '])';
-- Generated SQL: don_vi = ANY(ARRAY[8,9,10,11,12,14,15])  -- Valid!
```

### 2. Empty Equipment List (FIXED ✅)
**Issue**: After fixing 400 error, equipment list showed 0 items instead of 146  
**Root Cause**: RPC proxy was overwriting `p_don_vi=null` with user's home facility `don_vi=15`

**Discovery Process**:
1. Checked JWT claims → ✅ Correct (role, don_vi, dia_ban all present)
2. Checked `allowed_don_vi_for_session_safe()` → ✅ Returns [8,9,10,11,12,14,15]
3. Checked filter function logic → ✅ WHERE clauses correct
4. Created debug function → 🔍 Found `p_don_vi: 15` instead of `null`!
5. Traced to RPC proxy parameter sanitization

**Fix Applied** (`src/app/api/rpc/[fn]/route.ts`):
```typescript
// BEFORE
if (appRole !== 'global') {
  body.p_don_vi = donVi  // Overwrites for ALL non-global users
}

// AFTER  
if (appRole !== 'global' && appRole !== 'regional_leader') {
  body.p_don_vi = donVi  // Only overwrites for regular users
}
```

**Security Note**: Regional leaders still can't access tenants outside their `dia_ban`. Database functions enforce this through JWT-based `allowed_don_vi_for_session_safe()`.

### 3. Empty Filter Dropdowns (FIXED ✅)
**Issue**: All filter dropdowns showed no options (Status, Location, Classification, User, Department)  
**Root Causes**: 
- (A) RPC proxy overwriting `p_don_vi` (same as issue #2)
- (B) Filter functions returning wrong field names

**Discovery**: Frontend expected `{name, count}[]` but functions returned:
- `equipment_statuses_list_for_tenant`: `{status, count}`
- `equipment_locations_list_for_tenant`: `{location, count}`
- `equipment_classifications_list_for_tenant`: `{classification, count}`
- `equipment_users_list_for_tenant`: `{id, username, full_name, role}` (completely wrong!)
- `departments_list_for_tenant`: `{department, count}`

**Fix Applied** (Migration `20251004100000`):
```sql
-- Standardized ALL filter functions to return {name, count}
SELECT jsonb_build_object('name', COALESCE(...), 'count', COUNT(*)::INTEGER)
```

Changed columns used:
- Users: Aggregate `nguoi_dang_truc_tiep_quan_ly` instead of returning individual `nhan_vien` records
- Locations: Use `vi_tri_lap_dat` (not `vi_tri`)
- Classifications: Use `phan_loai_theo_nd98` (not `phan_loai`)
- Departments: Use `khoa_phong_quan_ly` with `name` field

## Debugging Techniques Used

### 1. JWT Claims Inspection
Created `debug_jwt_and_access()` function to verify:
```sql
RETURN jsonb_build_object(
  'jwt_claims', v_jwt_claims,
  'extracted_role', v_role,
  'extracted_don_vi', v_don_vi,
  'extracted_dia_ban', v_dia_ban,
  'allowed_don_vi_array', v_allowed,
  'allowed_count', array_length(v_allowed, 1)
);
```

Result: ✅ All JWT claims correct, 7 facilities accessible

### 2. WHERE Clause Inspection  
Created `equipment_list_enhanced_debug_test()` to see generated SQL:
```sql
RETURN jsonb_build_object(
  'role', v_role,
  'allowed', v_allowed,
  'p_don_vi', p_don_vi,  -- ← This revealed the bug!
  'where_clause', v_where,
  'test_query', 'SELECT COUNT(*) FROM thiet_bi WHERE ' || v_where
);
```

Result: 🔍 Found `p_don_vi: 15` instead of expected `null`

### 3. SQL Editor Testing
Tested functions directly with simulated JWT:
```sql
SET request.jwt.claims = '{"app_role": "regional_leader", "don_vi": "15", "dia_ban": "1", "role": "authenticated"}';
SELECT * FROM equipment_list_enhanced(NULL, 'id.asc', 1, 10, NULL, ...);
```

Result: ✅ Returned 146 items correctly when tested directly (proved database functions were fine)

### 4. Frontend Console Logging
Added debug output in Equipment page `useEffect`:
```javascript
console.log('isGlobal:', isGlobal)
console.log('shouldFetchEquipment:', shouldFetchEquipment)  
console.log('selectedDonVi:', selectedDonVi)  // null ✅
console.log('data length:', data?.length)      // 0 ❌
```

### 5. Network Tab Analysis
Compared request body vs response to see transformation:
- Request: `{p_don_vi: null}`
- Database received: `{p_don_vi: 15}` (after proxy transformation)

## Failed Approaches

### Attempt 1: Added `cardinality()` check to filter functions
**Migration**: `20251004091500`  
**Result**: Made it WORSE - all users saw empty filters  
**Reason**: Early `RETURN` when `cardinality(v_allowed) = 0` broke valid queries

### Attempt 2: Removed `cardinality()` check  
**Migration**: `20251004093000`  
**Result**: Still broken  
**Reason**: Didn't address root cause (RPC proxy overwriting parameters)

### Attempt 3: Added array_length validation everywhere
**Result**: Database functions were already correct!  
**Reason**: Problem was upstream in API proxy, not database

## Key Learnings

### 1. Always Check the Full Stack
Don't assume the bug is where symptoms appear:
- Symptom: Database returns 0 results
- Assumed: Database function bug
- **Actual**: API middleware transforming parameters

### 2. Add Debugging Layer by Layer
Start at presentation, work backward:
1. ✅ Frontend sends correct params
2. ❌ API proxy transforms them  ← Found the bug here
3. ✅ Database receives wrong params but processes correctly

### 3. Test Database Functions in Isolation
Using SQL Editor with SET request.jwt.claims helped prove database logic was sound.

### 4. Multiple Small Bugs Can Compound
Even after fixing RPC proxy issue, filters still didn't work because of field name mismatch. Both needed fixing.

### 5. Role-Based Middleware Needs Role-Specific Logic
Binary global/non-global split insufficient. Regional leader is a third category.

## Verification Checklist

- [x] Regional leader can log in
- [x] Equipment page loads without 400 error  
- [x] Equipment list shows all allowed facilities (146 items for dia_ban=1)
- [x] Status filter populated ("Hoạt động")
- [x] Location filter populated (multiple from 7 facilities)
- [x] Classification filter populated ("A", "B", "C", "D")
- [x] User filter populated (aggregated user names)
- [x] Department filter populated (Khoa Sản, Khoa Nhi, etc.)
- [x] Filtering works correctly  
- [x] Pagination works
- [x] Search works
- [x] No security bypass (can't access tenants outside dia_ban)

## Migrations Applied

1. `20251004090000_fix_equipment_list_array_literal_error.sql`
   - Fixed array literal syntax in equipment_list_enhanced WHERE clause
   
2. `20251004091500_fix_regional_leader_data_access_and_filters.sql`  
   - **ROLLBACK** - Added cardinality check that broke everything
   
3. `20251004093000_fix_filter_functions_remove_cardinality_check.sql`
   - **ROLLBACK** - Removed cardinality but didn't fix root cause
   
4. `20251004095000_add_comprehensive_debug_logging.sql`
   - Added debug_jwt_and_access() function (kept for future debugging)
   
5. `20251004100000_fix_filter_functions_return_format.sql`
   - Fixed all 5 filter functions to return {name, count} format
   - ✅ **KEEP THIS ONE**

6. `20251004101000_fix_equipment_list_enhanced_array_length_check.sql`
   - Added equipment_list_enhanced_debug_test() (can remove from whitelist)

## Code Changes (Non-Migration)

### Frontend  
`src/app/(app)/equipment/page.tsx`:
- Removed debug useEffect calls (cleaned up)

### Backend
`src/app/api/rpc/[fn]/route.ts`:
- Line 146: Changed `if (appRole !== 'global')` to `if (appRole !== 'global' && appRole !== 'regional_leader')`
- Removed debug function entries from ALLOWED_FUNCTIONS

## Next Steps

### Immediate
- [x] Remove debug code from equipment page
- [x] Remove debug functions from RPC whitelist  
- [x] Document the fix
- [x] Update memory bank

### Future Enhancements
- [ ] Add integration tests for regional leader role
- [ ] Create role-based proxy behavior config map
- [ ] Standardize filter function return type with SQL TYPE
- [ ] Add E2E tests for multi-tenant filtering

## Time Breakdown

- Initial 400 error fix: 15 minutes
- Debugging empty list: 60 minutes (most time spent)
- Fixing filter functions: 20 minutes  
- Testing & verification: 15 minutes
- Documentation: 10 minutes

**Total**: ~2 hours

## Status: ✅ RESOLVED

Regional leader functionality is now fully working. Users with `app_role='regional_leader'` can:
- View equipment from all facilities in their `dia_ban`
- Use all filter dropdowns with proper aggregated data
- Filter, search, and paginate through equipment list
- Access is properly restricted to their geographic boundary

---
**Session End**: All critical bugs resolved, code cleaned up, documentation complete.
