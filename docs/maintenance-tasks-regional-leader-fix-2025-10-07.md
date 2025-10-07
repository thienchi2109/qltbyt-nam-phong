# Maintenance Tasks Regional Leader Access Fix - October 7, 2025

## 🎯 Summary

Fixed critical issue preventing regional leaders from accessing equipment data in the "Danh sách TB trong kế hoạch" (Equipment List in Maintenance Plans) tab.

---

## 🔍 Problem Identified

### Issue
Regional leaders could **ONLY** see equipment from their **primary `don_vi`** (assigned facility), NOT from all facilities in their assigned `dia_ban` (region).

### Impact
- ❌ Regional leaders had incomplete visibility of maintenance tasks
- ❌ Could not see equipment from other facilities in their region
- ❌ Inconsistent with other maintenance page functions that work correctly

### Root Cause
The RPC function `maintenance_tasks_list_with_equipment()` was using **outdated single-tenant filtering logic**:

```sql
-- INCORRECT (old code)
DECLARE
  v_effective_donvi BIGINT := NULL;  -- Single tenant ID
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := NULL;
  ELSE
    v_effective_donvi := v_claim_donvi;  -- Only primary don_vi
  END IF;
  
  -- WHERE clause filters by single tenant
  AND (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
```

This code **did NOT use** the `allowed_don_vi_for_session()` helper function that properly handles regional leaders by returning an **array of all accessible facilities** in their region.

---

## ✅ Solution Implemented

### Migration File
**File**: `supabase/migrations/071020251046_fix_maintenance_tasks_regional_leader_access.sql`

### Key Changes

1. **Use Regional Leader Helper Function**
```sql
-- CORRECT (new code)
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_allowed BIGINT[] := NULL;  -- Array of accessible facilities
BEGIN
  IF v_role <> 'global' THEN
    v_allowed := public.allowed_don_vi_for_session();  -- ✅ Gets all accessible facilities
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      RETURN;  -- No access
    END IF;
  END IF;
```

2. **Update WHERE Clause to Array Check**
```sql
  -- WHERE clause checks against array
  AND (
    v_role = 'global'
    OR cv.thiet_bi_id IS NULL
    OR tb.don_vi = ANY(v_allowed)  -- ✅ Array membership check
  )
```

### What `allowed_don_vi_for_session()` Does

The helper function handles role-based access properly:

- **`global`**: Returns array of ALL active facilities
- **`regional_leader`**: Returns array of ALL facilities in assigned `dia_ban` (region)
- **`to_qltb`, `admin`, `technician`, `user`**: Returns array with single assigned `don_vi`

---

## 📋 Next Steps

### Step 1: Review Migration File ✅ COMPLETED

The migration file has been created at:
```
D:\qltbyt-nam-phong\supabase\migrations\071020251046_fix_maintenance_tasks_regional_leader_access.sql
```

**Review Checklist**:
- ✅ Migration file naming follows convention: `DDMMYYYYHHMM_description.sql`
- ✅ Includes comprehensive comments and documentation
- ✅ Uses proper SQL transaction (BEGIN/COMMIT)
- ✅ Includes rollback plan in comments
- ✅ Grants proper execution permissions
- ✅ Follows project conventions (SECURITY DEFINER, search_path)

---

### Step 2: Apply Migration in Supabase Console 🔴 REQUIRED

**⚠️ IMPORTANT**: Do NOT use automated tools or MCP to apply this migration!

**Instructions**:

1. **Open Supabase SQL Editor**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor** in left sidebar

2. **Load Migration File**
   - Click "New Query"
   - Copy the entire contents of `071020251046_fix_maintenance_tasks_regional_leader_access.sql`
   - Paste into SQL Editor

3. **Review Before Execution**
   - Verify you're on the **correct project**
   - Read through the SQL to understand changes
   - Check that helper function `allowed_don_vi_for_session()` exists

4. **Execute Migration**
   - Click **"Run"** button
   - Wait for confirmation message
   - Check for any errors in output

5. **Expected Output**
   ```
   BEGIN
   DROP FUNCTION
   CREATE FUNCTION
   GRANT
   COMMENT
   COMMIT
   ```

---

### Step 3: Verify Migration Success ✅ VERIFICATION REQUIRED

After applying the migration, run this verification query in Supabase SQL Editor:

```sql
-- Check function exists and has correct signature
SELECT 
  routine_name,
  routine_type,
  data_type,
  specific_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'maintenance_tasks_list_with_equipment';
```

**Expected Result**: Should return 1 row showing the function exists.

---

### Step 4: Test as Regional Leader User 🧪 TESTING REQUIRED

**Test Scenario**:

1. **Login as regional leader user**
   - User must have `role = 'regional_leader'`
   - User must have `dia_ban_id` assigned
   - Region must have multiple facilities

2. **Navigate to Maintenance Page**
   - Go to `/maintenance` page
   - Select a maintenance plan that has equipment from multiple facilities
   - Click on "Danh sách TB trong kế hoạch" tab

3. **Expected Results**:
   - ✅ Should see equipment from **ALL facilities** in the region
   - ✅ Should see multiple `don_vi` names if equipment exists in multiple facilities
   - ✅ No errors in browser console
   - ✅ Equipment codes and names display correctly

4. **Run This Query to Verify**:
```sql
-- As regional_leader user, check accessible equipment
SELECT 
  COUNT(*) as total_tasks,
  COUNT(DISTINCT tb.don_vi) as unique_facilities,
  array_agg(DISTINCT dv.name) as facility_names
FROM maintenance_tasks_list_with_equipment(
  p_ke_hoach_id := NULL,
  p_thiet_bi_id := NULL,
  p_loai_cong_viec := NULL,
  p_don_vi_thuc_hien := NULL
) t
LEFT JOIN thiet_bi tb ON t.thiet_bi_id = tb.id
LEFT JOIN don_vi dv ON tb.don_vi = dv.id;
```

**Expected Result**: 
- `unique_facilities` should be > 1 (if equipment exists in multiple facilities)
- `facility_names` should list all facilities in the region

---

### Step 5: Test Other Roles (Optional) 🔍 REGRESSION TESTING

Verify that other roles still work correctly:

**Global User**:
- Should see ALL equipment from ALL facilities (no change)

**to_qltb / admin User**:
- Should ONLY see equipment from their assigned `don_vi` (no change)

**technician / user**:
- Should ONLY see equipment from their assigned `don_vi` (no change)

---

## 📊 Technical Details

### Schema Investigation Results

**Tables Verified**:
- ✅ `public.thiet_bi` - Equipment table with `don_vi` foreign key
- ✅ `public.cong_viec_bao_tri` - Maintenance tasks with `thiet_bi_id` foreign key
- ✅ `public.don_vi` - Organizational units with `dia_ban_id` foreign key
- ✅ `public.dia_ban` - Regional districts table
- ✅ `public.nhan_vien` - Users with `dia_ban_id` for regional leaders

**Helper Functions Verified**:
- ✅ `public.allowed_don_vi_for_session()` - Returns array of accessible facilities
- ✅ `public._get_jwt_claim(claim text)` - Extracts JWT claims
- ✅ `public._get_jwt_claim_safe(claim text)` - Safe JWT claim extraction

**Permissions Verified**:
- ✅ Function uses `SECURITY DEFINER` (runs with owner privileges)
- ✅ `GRANT EXECUTE TO authenticated` (all logged-in users can call it)
- ✅ `SET search_path = public, pg_temp` (security best practice)

---

## 🔄 Rollback Plan

If issues occur after migration, rollback is included in the migration file (lines 210-306).

**To Rollback**:
1. Copy the rollback SQL from migration file comments
2. Execute in Supabase SQL Editor
3. This restores the old single-tenant filtering logic

**Note**: Rollback will **re-introduce** the original bug where regional leaders can't see all equipment.

---

## 📝 Comparison with Other Functions

This fix brings `maintenance_tasks_list_with_equipment()` into alignment with other properly-implemented functions:

| Function | Status | Uses Helper | Regional Leader Access |
|----------|--------|------------|----------------------|
| `maintenance_plan_list()` | ✅ Fixed | Yes | All facilities in region |
| `maintenance_tasks_list()` | ✅ Fixed | Yes | All facilities in region |
| `maintenance_tasks_list_with_equipment()` | ✅ **NOW FIXED** | Yes | All facilities in region |
| `repair_request_list()` | ✅ Fixed | Yes | All facilities in region |
| `transfer_request_list()` | ✅ Fixed | Yes | All facilities in region |

---

## 🎯 Success Criteria

Migration is considered successful when:

1. ✅ Migration executes without errors
2. ✅ Function exists with correct signature
3. ✅ Regional leaders can see equipment from ALL facilities in their region
4. ✅ Other roles continue to work as expected (no regression)
5. ✅ No errors in application logs
6. ✅ No errors in browser console

---

## 📞 Support

If issues occur during or after migration:

1. **Check Supabase Logs**
   - Go to Supabase Dashboard → Database → Logs
   - Look for errors related to `maintenance_tasks_list_with_equipment`

2. **Check Application Logs**
   - Open browser console
   - Navigate to maintenance page
   - Check for RPC call errors

3. **Verify JWT Claims**
   - Run `SELECT public.debug_jwt_claims();` as regional leader
   - Verify `role`, `don_vi`, and `dia_ban` are set correctly

4. **Rollback if Necessary**
   - Use rollback SQL from migration file
   - Report issue with error details

---

## 📚 Related Documentation

- `docs/regional-leader-maintenance-fix-2025-10-07.md` - Previous maintenance fix
- `docs/regional-leader-role-plan.md` - Overall implementation plan
- `docs/maintenance-facility-filter-implementation-2025-10-07.md` - Facility filter implementation
- `.github/copilot-instructions.md` - Agent workflow rules
- `WARP.md` - Project rules and conventions

---

**Migration Created**: October 7, 2025, 10:46 UTC  
**Status**: ✅ Ready for manual application in Supabase Console  
**Priority**: 🔴 HIGH - Blocks regional leader functionality
