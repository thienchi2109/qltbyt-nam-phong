# 🐛 Issue: Equipment Status Distribution Missing Regional Leader Support

**Date:** 2025-10-13 15:00 UTC  
**Severity:** **HIGH** - Data accuracy issue  
**Component:** `equipment_status_distribution` RPC function  
**Status:** ⏳ **IDENTIFIED - FIX NEEDED**

---

## 🐛 Problem Description

When a regional_leader selects a specific facility from the dropdown filter in the "Xuất-nhập-tồn" (Inventory) tab, the KPI cards display incorrect statistics. The data shown is always from the regional_leader's PRIMARY facility (`user.don_vi`) instead of the selected facility.

---

## 🔍 Root Cause Analysis

**Function:** `equipment_status_distribution`  
**File:** `supabase/migrations/2025-09-29/20250923_reports_exports_final.sql`  
**Lines:** 29-39

**Current Code (WRONG):**
```sql
DECLARE
  v_role TEXT := COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), '');
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_effective_donvi BIGINT := NULL;
BEGIN
  IF lower(v_role) = 'global' THEN
    v_effective_donvi := p_don_vi;  -- Global: respects p_don_vi parameter
  ELSE
    v_effective_donvi := v_claim_donvi;  -- ❌ NON-GLOBAL: ignores p_don_vi!
  END IF;
```

**The Problem:**
- For `global` users: `p_don_vi` parameter is respected ✅
- For ALL other users (including `regional_leader`): `p_don_vi` is **IGNORED** ❌
- Instead, it always uses `v_claim_donvi` (user's primary facility)
- This means regional_leader **cannot** view stats for other facilities in their region

**Expected Behavior:**
- `global` users: Can view any facility or all facilities
- `regional_leader` users: Can view any facility **within their region**
- Other users: Limited to their primary facility only

---

## 📊 Impact

### Affected Components
1. **Inventory Report Tab** - Equipment Distribution Summary cards
2. **Dashboard** (if using this function)
3. **Any other component** calling `equipment_status_distribution`

### User Experience
- ✅ **Global users:** Working correctly
- ❌ **Regional leaders:** Always see their primary facility data, regardless of dropdown selection
- ✅ **Regular users:** Working as intended (no dropdown shown)

### Data Accuracy
- **Wrong data displayed** when regional_leader selects a facility
- **Confusing UX** - dropdown appears to work but shows wrong data
- **Trust issue** - users may lose confidence in the system

---

## ✅ Proposed Fix

Update the function to use `allowed_don_vi_for_session_safe()` helper, similar to other RPC functions.

**New Code (CORRECT):**
```sql
DECLARE
  v_role TEXT := lower(COALESCE(public._get_jwt_claim('app_role'), public._get_jwt_claim('role'), ''));
  v_claim_donvi BIGINT := NULLIF(public._get_jwt_claim('don_vi'), '')::BIGINT;
  v_allowed BIGINT[];
  v_effective_donvi BIGINT := NULL;
BEGIN
  -- Global users can query specific tenant or all tenants
  IF v_role = 'global' THEN
    v_effective_donvi := p_don_vi;  -- NULL = all, specific ID = that facility
    
  -- Regional leader: validate access to requested facility
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
    
    IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
      -- No access
      v_effective_donvi := -1;  -- Will return no data
    ELSIF p_don_vi IS NOT NULL THEN
      -- Validate access to specific facility
      IF p_don_vi = ANY(v_allowed) THEN
        v_effective_donvi := p_don_vi;  -- ✅ Allowed
      ELSE
        -- Access denied - return no data
        v_effective_donvi := -1;
      END IF;
    ELSE
      -- p_don_vi is NULL - this is a problem for this function
      -- It doesn't support multi-facility aggregation in WHERE clause
      -- For now, use first allowed facility or primary don_vi
      v_effective_donvi := v_claim_donvi;
    END IF;
    
  -- Other roles: limited to their facility
  ELSE
    v_effective_donvi := v_claim_donvi;
  END IF;
  
  -- Query using v_effective_donvi
  WHERE (v_effective_donvi IS NULL OR tb.don_vi = v_effective_donvi)
    AND (p_khoa_phong IS NULL OR tb.khoa_phong_quan_ly = p_khoa_phong)
    AND (p_vi_tri IS NULL OR tb.vi_tri_lap_dat = p_vi_tri)
    ...
END;
```

**Note:** This function is simpler than others because it always queries a SINGLE facility at a time. It doesn't support aggregating across multiple facilities in one call (unlike `get_maintenance_report_data` which can aggregate).

---

## 🎯 Alternative Simpler Fix

If the function should support "All facilities" option for regional_leader, we need a different approach:

```sql
DECLARE
  v_allowed BIGINT[];
BEGIN
  -- Get allowed facilities
  IF v_role = 'global' THEN
    v_allowed := NULL;  -- All facilities
  ELSIF v_role = 'regional_leader' THEN
    v_allowed := public.allowed_don_vi_for_session_safe();
  ELSE
    v_allowed := ARRAY[v_claim_donvi];
  END IF;
  
  -- Apply filtering
  WHERE (v_allowed IS NULL OR tb.don_vi = ANY(v_allowed))
    AND (p_don_vi IS NULL OR tb.don_vi = p_don_vi)  -- Additional filter if specific facility
    ...
END;
```

This allows:
- Global: All facilities or specific facility
- Regional leader: All allowed facilities OR specific facility (validated)
- Others: Their facility only

---

## 📝 Required Changes

### 1. SQL Migration File
**Create:** `supabase/migrations/2025-10-13_reports/20251013_fix_equipment_status_distribution_regional_leader.sql`

**Content:**
- Update `equipment_status_distribution` function
- Add regional_leader support with `allowed_don_vi_for_session_safe()`
- Validate facility access before querying
- Add comments explaining the logic

### 2. No Frontend Changes Needed
The frontend is already correct:
- ✅ Passes `selectedDonVi` parameter
- ✅ Uses proper query keys for caching
- ✅ Respects `effectiveTenantKey` gating

### 3. Same Fix Needed for `maintenance_stats_for_reports`
**Function:** `maintenance_stats_for_reports` (lines 198-283)  
**Same Issue:** Lines 209-222 have identical problem  
**Fix:** Apply same regional_leader logic

---

## 🧪 Testing Requirements

After fix is deployed:

**Test as Regional Leader:**
1. [ ] Select "Tất cả cơ sở (vùng)" - should show aggregated regional stats
2. [ ] Select specific facility in region - should show that facility's stats
3. [ ] Verify stats match when switching between facilities
4. [ ] Confirm cannot access facilities outside region (via API test)

**Test as Global:**
1. [ ] Select "Tất cả đơn vị" - should show all facility stats
2. [ ] Select specific facility - should show that facility's stats
3. [ ] No regression in existing functionality

**Test as Regular User:**
4. [ ] Stats show only their facility (no dropdown)
5. [ ] No changes in behavior

---

## 🚨 Priority

**HIGH** - This is a data accuracy issue that affects the core functionality of regional_leader RBAC implementation. Without this fix, regional leaders cannot effectively use the Reports feature.

---

## 📋 Implementation Steps

1. **Create migration file** for `equipment_status_distribution`
2. **Create migration file** for `maintenance_stats_for_reports`
3. **Test with regional_leader role** in browser
4. **Verify stats are correct** for each facility
5. **Document the changes**

---

## 🔗 Related Functions That ALREADY Work Correctly

These functions have proper regional_leader support and can be used as reference:

1. ✅ `get_maintenance_report_data` - Phase 1 implementation
2. ✅ `get_facilities_with_equipment_count` - Returns region-scoped facilities
3. ✅ `maintenance_tasks_list_with_equipment` - Supports regional_leader
4. ✅ `equipment_list_enhanced` - Supports multi-tenant filtering

---

**Status:** ⏳ IDENTIFIED  
**Next Action:** Create SQL migration to fix both functions  
**Estimated Time:** 30 minutes to create + test migration  
**Risk:** Low (isolated to these two RPC functions)
