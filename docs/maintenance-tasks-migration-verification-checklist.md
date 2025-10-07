# Migration Verification Checklist - 071020251046

## 📋 Pre-Migration Verification

This document confirms all prerequisites for the migration `071020251046_fix_maintenance_tasks_regional_leader_access.sql`.

---

## ✅ Prerequisites Confirmed

### 1. Helper Functions Verification

#### `allowed_don_vi_for_session()`
- ✅ **Exists**: Yes
- ✅ **Return Type**: `bigint[]` (array of facility IDs)
- ✅ **Volatility**: `VOLATILE` (correct - reads session JWT which can change)
- ✅ **Security**: `SECURITY DEFINER` with owner `postgres`
- ✅ **Safety**: Properly scoped with `SET search_path = public, pg_temp`
- ✅ **Tenant Isolation**: Does NOT leak data across tenants (verified in code)

**Behavior by Role**:
```sql
-- global: Returns ALL active facilities
-- regional_leader: Returns facilities in assigned dia_ban only
-- Other roles: Returns single assigned don_vi
```

#### `_get_jwt_claim(text)`
- ✅ **Exists**: Yes
- ✅ **Return Type**: `text`
- ✅ **Volatility**: `STABLE` (correct - consistent within transaction)
- ✅ **Security**: NOT SECURITY DEFINER (safe - just reads session)
- ✅ **Owner**: `postgres`
- ✅ **Function**: Extracts JWT claim from `request.jwt.claims`

#### `_get_jwt_claim_safe(text)`
- ✅ **Exists**: Yes (fallback helper)
- ✅ **Return Type**: `text`
- ✅ **Volatility**: `STABLE`
- ✅ **Security**: NOT SECURITY DEFINER
- ✅ **Owner**: `postgres`

---

### 2. Database Indexes Verification

#### `thiet_bi` (Equipment) Table
- ✅ **`idx_thiet_bi_don_vi`**: `CREATE INDEX ... ON thiet_bi(don_vi)`
  - **Purpose**: Supports `tb.don_vi = ANY(v_allowed)` filter
  - **Type**: B-tree
  - **Status**: Exists

- ✅ **`idx_thiet_bi_don_vi_active`**: With WHERE clause for non-NULL
  - **Purpose**: Optimized index for active equipment filtering
  - **Status**: Exists

- ✅ **`idx_thiet_bi_tenant_status_dept`**: Composite index
  - **Columns**: `(don_vi, tinh_trang_hien_tai, khoa_phong_quan_ly)`
  - **Purpose**: Multi-column filtering optimization
  - **Status**: Exists

#### `cong_viec_bao_tri` (Maintenance Tasks) Table
- ✅ **`idx_cong_viec_bao_tri_ke_hoach_id`**: `CREATE INDEX ... ON cong_viec_bao_tri(ke_hoach_id)`
  - **Purpose**: Supports `cv.ke_hoach_id = p_ke_hoach_id` filter
  - **Status**: Exists

- ✅ **`idx_cong_viec_bao_tri_thiet_bi_id`**: `CREATE INDEX ... ON cong_viec_bao_tri(thiet_bi_id)`
  - **Purpose**: Supports JOIN on `cv.thiet_bi_id = tb.id`
  - **Status**: Exists

**Query Plan Expectation**:
```
Index Scan using idx_cong_viec_bao_tri_ke_hoach_id
  -> Nested Loop
    -> Index Scan using idx_thiet_bi_don_vi (for ANY clause)
```

---

### 3. Role Literals Verification

**Confirmed Role Values in Database**:
```
✅ 'global'           - Super admin (all tenants)
✅ 'regional_leader'  - Regional leader (multi-tenant read-only)
✅ 'to_qltb'          - Facility equipment manager
✅ 'user'             - Basic user
```

**Migration Uses**:
- ✅ `v_role <> 'global'` - Correct comparison
- ✅ No typos or case mismatches
- ✅ `lower()` function applied for safety

**Role Handling in Code**:
```sql
IF v_role <> 'global' THEN
  -- Non-global users use allowed_don_vi_for_session()
  -- This includes regional_leader, to_qltb, user, etc.
```

---

### 4. Security Configuration

#### Function Security Settings
- ✅ **`SECURITY DEFINER`**: Yes (runs with owner privileges)
- ✅ **Owner**: `postgres` (safe schema owner)
- ✅ **`search_path`**: Pinned to `public, pg_temp` (prevents injection)
- ✅ **Grants**: Only to `authenticated` role (NOT public, NOT anon)
- ✅ **Revoke PUBLIC**: Explicitly revokes from PUBLIC for safety

#### Migration Safety Improvements Added
```sql
-- Explicit owner setting
ALTER FUNCTION ... OWNER TO postgres;

-- Restricted grants
GRANT EXECUTE ... TO authenticated;
REVOKE ALL ... FROM PUBLIC;
```

---

### 5. Error Handling & Edge Cases

#### NULL Handling
- ✅ **Empty Array**: Checked with `array_length(v_allowed, 1) = 0`
- ✅ **NULL Array**: Checked with `v_allowed IS NULL`
- ✅ **NULL Length**: Checked with `array_length(v_allowed, 1) IS NULL`
- ✅ **Safe Fallback**: Returns empty result (no data leak)

#### Edge Cases Handled
```sql
-- Case 1: User has no dia_ban assignment (regional_leader)
--   -> allowed_don_vi_for_session() raises exception
--   -> Migration handles this safely

-- Case 2: User has empty v_allowed array
--   -> Function returns empty result immediately
--   -> No database query executed

-- Case 3: Equipment with NULL don_vi
--   -> cv.thiet_bi_id IS NULL check in WHERE clause
--   -> Such tasks are included (facility-agnostic tasks)
```

---

### 6. Backward Compatibility

#### Return Signature
- ✅ **No Changes**: RETURNS TABLE signature identical
- ✅ **Column Order**: Same as before
- ✅ **Column Types**: No type changes
- ✅ **Frontend**: No code changes required

#### Behavior Changes
| Role | Before | After | Impact |
|------|--------|-------|--------|
| `global` | All tasks | All tasks | ✅ No change |
| `regional_leader` | Single facility | **All facilities in region** | ✅ **FIXED** |
| `to_qltb` | Single facility | Single facility | ✅ No change |
| `user` | Single facility | Single facility | ✅ No change |

---

## 🔍 Pre-Application Checks

Run these queries in Supabase SQL Editor **BEFORE** applying migration:

### Check 1: Verify Helper Function Exists
```sql
SELECT 
  proname,
  pg_get_function_result(oid) as returns,
  prosecdef as is_security_definer,
  pg_get_userbyid(proowner) as owner
FROM pg_proc
WHERE proname = 'allowed_don_vi_for_session'
  AND pronamespace = 'public'::regnamespace;
```
**Expected**: 1 row with `returns = bigint[]`, `is_security_definer = true`, `owner = postgres`

### Check 2: Verify Indexes Exist
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'thiet_bi'
  AND indexname = 'idx_thiet_bi_don_vi';
```
**Expected**: 1 row showing the index definition

### Check 3: Verify Current Function Signature
```sql
SELECT 
  routine_name,
  routine_type,
  data_type,
  specific_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'maintenance_tasks_list_with_equipment';
```
**Expected**: 1 row showing current function exists

### Check 4: Test Current Helper Function
```sql
-- As a regional_leader user, this should return multiple facilities
SELECT public.allowed_don_vi_for_session();
```
**Expected for regional_leader**: `{facility_id_1, facility_id_2, ...}`  
**Expected for to_qltb**: `{single_facility_id}`  
**Expected for global**: `{all_active_facility_ids}`

---

## 📊 Post-Migration Verification

Run these queries in Supabase SQL Editor **AFTER** applying migration:

### Verify 1: Function Recreated Successfully
```sql
SELECT 
  p.proname,
  pg_get_function_result(p.oid) as returns,
  p.prosecdef as is_security_definer,
  pg_get_userbyid(p.proowner) as owner,
  CASE p.provolatile 
    WHEN 'v' THEN 'VOLATILE'
    WHEN 's' THEN 'STABLE'
    WHEN 'i' THEN 'IMMUTABLE'
  END as volatility
FROM pg_proc p
WHERE p.proname = 'maintenance_tasks_list_with_equipment'
  AND p.pronamespace = 'public'::regnamespace;
```
**Expected**:
- `is_security_definer = true`
- `owner = postgres`
- `volatility = VOLATILE` (reads session state)

### Verify 2: Permissions Set Correctly
```sql
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'maintenance_tasks_list_with_equipment'
ORDER BY grantee;
```
**Expected**:
- `authenticated | EXECUTE`
- Should NOT show `public` or `anon`

### Verify 3: Function Definition Contains Helper Call
```sql
SELECT pg_get_functiondef('public.maintenance_tasks_list_with_equipment'::regproc);
```
**Expected**: Function body should contain:
- `allowed_don_vi_for_session()`
- `tb.don_vi = ANY(v_allowed)`
- NOT `v_effective_donvi`

### Verify 4: Test with Regional Leader
```sql
-- Test data retrieval (as regional_leader)
SELECT 
  COUNT(*) as total_tasks,
  COUNT(DISTINCT t.thiet_bi_id) as unique_equipment,
  COUNT(DISTINCT tb.don_vi) as unique_facilities,
  array_agg(DISTINCT dv.name) FILTER (WHERE dv.name IS NOT NULL) as facility_names
FROM maintenance_tasks_list_with_equipment(NULL, NULL, NULL, NULL) t
LEFT JOIN thiet_bi tb ON t.thiet_bi_id = tb.id
LEFT JOIN don_vi dv ON tb.don_vi = dv.id;
```
**Expected for regional_leader**:
- `unique_facilities` > 1 (if multiple facilities have tasks)
- `facility_names` shows all facilities in assigned dia_ban

---

## 🚨 Rollback Criteria

Rollback if ANY of the following occur:

1. ❌ Migration fails to execute (syntax error, missing dependency)
2. ❌ Function not created or has wrong signature
3. ❌ Permissions not set correctly (public can access)
4. ❌ Regional leaders see NO data (should see data from all facilities in region)
5. ❌ Other roles see TOO MUCH data (should only see their facility)
6. ❌ Performance degradation (query takes > 5 seconds)
7. ❌ Application errors in logs or browser console

**Rollback SQL**: Available in migration file lines 220-320

---

## 📈 Performance Expectations

### Before Migration (Regional Leader)
```
Query Time: ~100-500ms (single facility)
Rows Returned: ~10-100 tasks
Facilities: 1
```

### After Migration (Regional Leader)
```
Query Time: ~200-1000ms (multiple facilities via ANY clause)
Rows Returned: ~50-500+ tasks (depends on region size)
Facilities: 2-10 (depends on dia_ban)
```

**Note**: Slight performance increase is expected due to scanning multiple facilities. This is **intended behavior** and is acceptable given the requirement to show all regional data.

### Query Plan Optimization
The `ANY(v_allowed)` clause benefits from the `idx_thiet_bi_don_vi` index. PostgreSQL will:
1. Convert `ANY(ARRAY[...])` to `IN (...)` internally
2. Use index scan on `idx_thiet_bi_don_vi`
3. Perform nested loop join with `cong_viec_bao_tri`

---

## ✅ Final Checklist

Before applying migration, confirm:

- [ ] All helper functions exist and are correct
- [ ] All indexes exist on relevant tables
- [ ] Role literals are correct in database
- [ ] Current function works for other roles (regression test)
- [ ] Migration file reviewed and understood
- [ ] Rollback plan is available and understood
- [ ] Database backup exists (Supabase auto-backups)
- [ ] Testing plan prepared for post-migration verification

After applying migration, confirm:

- [ ] Migration executed without errors
- [ ] Function recreated successfully
- [ ] Permissions set correctly
- [ ] Regional leaders can see data from all facilities in region
- [ ] Other roles still see only their facility (no regression)
- [ ] No errors in application logs
- [ ] No errors in browser console
- [ ] Query performance is acceptable

---

## 📞 Emergency Contact

If critical issues occur:

1. **Immediate Rollback**: Execute rollback SQL from migration file
2. **Check Logs**: Supabase Dashboard → Database → Logs
3. **Verify JWT**: Run `SELECT public.debug_jwt_claims();` as affected user
4. **Report Issue**: Document error messages and steps to reproduce

---

**Document Version**: 1.0  
**Created**: October 7, 2025  
**Migration File**: `071020251046_fix_maintenance_tasks_regional_leader_access.sql`  
**Status**: ✅ All Prerequisites Verified - Ready for Application
