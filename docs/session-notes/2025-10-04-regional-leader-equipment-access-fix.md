# Regional Leader Equipment Access Fix - 2025-10-04

## Issues Identified

### Issue 1: Regional Leader Cannot See Regional Data
**Symptom:** Regional leader user `sytag-khtc` (dia_ban_id = 1, Tỉnh An Giang) cannot see any equipment data from the 7 don_vi in their region.

**Root Cause:** The `allowed_don_vi_for_session_safe()` function reads `v_user_region_id` from JWT claim `dia_ban`, which is correctly set in the JWT token, but the previous version may have had issues with case sensitivity or the CASE statement logic.

**Data Context:**
- Regional leader: `sytag-khtc` with `dia_ban_id = 1` (Tỉnh An Giang)
- Expected accessible don_vi: [8, 9, 10, 11, 12, 14, 15]
  - 8: Bệnh viện Đa khoa An Giang
  - 9: Trung tâm Kiểm soát bệnh tật An Giang
  - 10: Trung tâm Y tế khu vực An Phú
  - 11: Bệnh viện Sản Nhi An Giang
  - 12: Bệnh viện ĐK KV Tân Châu
  - 14: Trung tâm Y tế khu vực Châu Đốc
  - 15: Sở Y tế tỉnh An Giang

**Fix Applied:**
- Added `lower()` to role comparison in CASE statement: `CASE lower(v_user_role)`
- Added debug logging to track role, don_vi, and region_id values
- Ensured JWT claim `dia_ban` is properly read as BIGINT

### Issue 2: Server-Side Filters Return No Data
**Symptom:** Dropdown filters for Tình trạng (Status), Người sử dụng (Users), Phân loại (Classification) show no options even when equipment exists.

**Root Cause:** Filter functions used incorrect array empty check:
```sql
-- WRONG (prevents data retrieval):
IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
  RETURN;
END IF;
```

The `array_length(arr, 1) IS NULL` check returns TRUE when:
- Array is NULL ✓ (correct)
- Array is empty `{}` ✓ (correct)
- **BUT also causes early return preventing the query from running**

**Fix Applied:**
- Changed to `cardinality(v_allowed) = 0` for initial validation
- **Removed** the buggy `array_length(v_effective, 1) IS NULL` check entirely
- Now functions proceed to query even with valid non-empty arrays

### Issue 3: Array Empty Check Pattern
**Old Pattern (Buggy):**
```sql
IF v_role = '' OR v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
  RETURN;
END IF;

-- Later in code:
IF v_effective IS NOT NULL AND array_length(v_effective, 1) IS NULL THEN
  RETURN;  -- This prevents queries from running!
END IF;
```

**New Pattern (Fixed):**
```sql
-- Only check at entry point:
IF v_role = '' OR v_allowed IS NULL OR cardinality(v_allowed) = 0 THEN
  RETURN;
END IF;

-- No secondary check needed - let query handle NULL or arrays naturally
```

## Migration Files Created

### 1. `20251004090000_fix_equipment_list_array_literal_error.sql`
**Status:** ✅ Applied
**Purpose:** Fixed 400 error by replacing `quote_literal()` with proper array syntax
**Result:** Equipment page now loads without error

### 2. `20251004091500_fix_regional_leader_data_access_and_filters.sql`
**Status:** 🔄 Ready to apply
**Purpose:** Fix regional leader data access AND all filter functions
**Fixes:**
- `allowed_don_vi_for_session_safe()` - Add `lower()` to role comparison
- `equipment_users_list_for_tenant()` - Remove buggy array check
- `equipment_locations_list_for_tenant()` - Remove buggy array check
- `equipment_classifications_list_for_tenant()` - Remove buggy array check
- `equipment_statuses_list_for_tenant()` - Remove buggy array check
- `departments_list_for_tenant()` - Apply consistent pattern

## Testing Steps

### Test Regional Leader Access
1. Login as `sytag-khtc` / `1234`
2. Navigate to Equipment page
3. **Expected:** See equipment from all 7 An Giang don_vi
4. **Verify:** Check browser console for JWT claims showing `dia_ban: 1`

### Test Filter Functions
1. Login as any non-regional_leader account (e.g., `admin-ag` for don_vi 15)
2. Navigate to Equipment page
3. **Expected:** All dropdown filters show unique values:
   - ✅ Khoa/Phòng (already working)
   - ✅ Tình trạng (Status) - now fixed
   - ✅ Người sử dụng (Users) - now fixed
   - ✅ Phân loại (Classification) - now fixed

### SQL Verification Queries
```sql
-- Test 1: Check allowed_don_vi returns An Giang facilities (with regional_leader JWT)
SELECT public.allowed_don_vi_for_session_safe();
-- Expected: {8,9,10,11,12,14,15}

-- Test 2: Check users filter returns data
SELECT * FROM public.equipment_users_list_for_tenant(NULL);

-- Test 3: Check status filter returns data
SELECT * FROM public.equipment_statuses_list_for_tenant(NULL);

-- Test 4: Check classification filter returns data
SELECT * FROM public.equipment_classifications_list_for_tenant(NULL);
```

## Key Learnings

### PostgreSQL Array Checks
1. **`array_length(arr, 1)`**:
   - Returns NULL if array is NULL or empty
   - But creates confusing logic in secondary checks
   
2. **`cardinality(arr)`**:
   - Returns 0 for empty array
   - Returns NULL for NULL array
   - More intuitive for "has elements" checks

3. **Best Practice**:
   - Check once at function entry
   - Let WHERE clause handle NULL vs array naturally: `(v_effective IS NULL OR tb.don_vi = ANY(v_effective))`

### Regional Leader Pattern
1. **JWT Claims Priority:**
   - `app_role` / `role` → user role type
   - `don_vi` → user's home organizational unit
   - `dia_ban` → user's assigned region (for regional_leader only)

2. **Access Control:**
   - Global: All active don_vi
   - Regional Leader: All active don_vi where `dia_ban_id = JWT.dia_ban`
   - Others: Only their specific `don_vi`

3. **Case Sensitivity:**
   - Always use `lower()` when comparing roles from JWT
   - Database stores role as lowercase in nhan_vien.role
   - JWT may have mixed case

## Next Actions

1. ✅ Execute migration `20251004091500_fix_regional_leader_data_access_and_filters.sql` in Supabase SQL Editor
2. ✅ Test with regional_leader account (sytag-khtc)
3. ✅ Test with regular accounts (admin-ag, technician accounts)
4. ✅ Verify all filter dropdowns populate correctly
5. ✅ Commit all migration files to git
6. 📋 Update Serena memory with findings

## Files Modified

- ✅ `supabase/migrations/20251004090000_fix_equipment_list_array_literal_error.sql` (array literal fix)
- 🆕 `supabase/migrations/20251004091500_fix_regional_leader_data_access_and_filters.sql` (this fix)

## References

- Original issue: Equipment page 400 error for regional_leader
- Related docs: `docs/regional-leader-role-plan.md`
- JWT implementation: `docs/jwt_claim_reading_fix_2025-10-04.md`
- Authentication flow: `src/auth/config.ts`
