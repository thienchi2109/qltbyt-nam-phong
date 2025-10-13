# Reports Page Regional Leader RBAC - Complete Implementation

**Date:** 2025-10-13
**Status:** ✅ COMPLETED & TESTED
**Impact:** Critical security and functionality fix for regional_leader role

## 🎯 Problems Solved

### 1. Nested Aggregate Error (400) in Maintenance Tab
- **Error:** `aggregate function calls cannot be nested` (PostgreSQL 42803)
- **Location:** `get_maintenance_report_data` function lines 204-209
- **Cause:** `jsonb_agg(jsonb_build_object(..., SUM(planned), SUM(actual)))`
- **Fix:** Pre-aggregate in `maintenance_aggregated` CTE before jsonb_agg
- **Migration:** `20251013160000_fix_reports_nested_aggregates_and_regional_leader.sql`

### 2. Equipment Distribution Charts Not Rendering
- **Cause:** Function return type changed from `JSONB` to `TABLE`, breaking frontend
- **Function:** `equipment_status_distribution`
- **Frontend Expects:** `{total_equipment, status_counts, by_department, by_location, departments, locations}`
- **Fix:** Restored JSONB format + added regional_leader validation
- **Migration:** `20251013170000_fix_equipment_status_distribution_preserve_format.sql`

### 3. Inventory KPIs Show Zero & Empty Transaction Table ⭐ CRITICAL
- **Symptoms:** KPIs display "0", transaction table shows "Không có dữ liệu"
- **Root Cause:** THREE functions ignored `p_don_vi` parameter for regional_leader
- **Functions:** `equipment_list_for_reports`, `equipment_count_enhanced`, `transfer_request_list_enhanced`
- **Fix:** Added proper regional_leader RBAC with `allowed_don_vi_for_session_safe()`
- **Migration:** `20251013180000_fix_inventory_rpcs_regional_leader.sql`

## 🔧 Root Cause Pattern

All 6 functions had identical bug:
```sql
-- ❌ WRONG (lines 40-44 in each function)
IF lower(v_role) = 'global' THEN
  v_effective_donvi := p_don_vi;
ELSE
  v_effective_donvi := v_claim_donvi;  -- Always uses user's primary facility!
END IF;
```

**Impact:** Regional leaders could NEVER select different facilities - backend silently ignored dropdown selection.

## ✅ Fixed Pattern

```sql
v_role := lower(COALESCE(public._get_jwt_claim('app_role'), ...));
v_allowed := public.allowed_don_vi_for_session_safe();

IF v_role = 'global' THEN
  v_effective_donvi := p_don_vi;
  
ELSIF v_role = 'regional_leader' THEN
  IF v_allowed IS NULL OR array_length(v_allowed, 1) IS NULL THEN
    RETURN;  -- No access
  END IF;
  
  IF p_don_vi IS NOT NULL THEN
    IF p_don_vi = ANY(v_allowed) THEN
      v_effective_donvi := p_don_vi;  -- ✅ Respect selection
    ELSE
      RAISE EXCEPTION 'Access denied';  -- ✅ Block unauthorized
    END IF;
  ELSE
    v_effective_donvi := v_claim_donvi;  -- Fallback
  END IF;
  
ELSE
  v_effective_donvi := v_claim_donvi;
END IF;
```

## 📦 Migrations Applied

### Migration 1: `20251013160000` (Nested Aggregates)
- `get_maintenance_report_data` - Fixed nested aggregates
- `maintenance_stats_for_reports` - Added regional_leader support

### Migration 2: `20251013170000` (JSONB Format)
- `equipment_status_distribution` - Restored JSONB, added regional_leader

### Migration 3: `20251013180000` (Inventory Data) ⭐
- `equipment_list_for_reports` - Powers transaction table
- `equipment_count_enhanced` - Powers "Tồn kho" KPI
- `transfer_request_list_enhanced` - Powers export data

## 📊 Data Flow Architecture

**Inventory Tab ("Xuất-nhập-tồn"):**
```
KPI Cards (Tổng nhập, Tổng xuất, Tồn kho, Biến động)
  ↓ useInventoryData()
  ├─ equipment_list_for_reports()     (Migration 3)
  ├─ equipment_count_enhanced()       (Migration 3)
  └─ transfer_request_list_enhanced() (Migration 3)

Transaction Table
  ↓ useInventoryData()
  └─ equipment_list_for_reports()     (Migration 3)

Charts Section
  ↓ useEquipmentDistribution()
  └─ equipment_status_distribution()  (Migration 2)
```

**Maintenance Tab ("Bảo trì / Sửa chữa"):**
```
KPI Cards & Charts
  ↓ useMaintenanceData()
  └─ get_maintenance_report_data()    (Migration 1)
```

## 🧪 Testing Verification

**Test as regional_leader:**
1. ✅ Navigate to Reports → Xuất-nhập-tồn
2. ✅ KPIs show actual numbers (not zeros)
3. ✅ Select different facility from dropdown
4. ✅ All values change per facility
5. ✅ Transaction table populates with equipment
6. ✅ Charts render with data
7. ✅ Switch to Bảo trì / Sửa chữa tab
8. ✅ No 400 errors
9. ✅ Charts and data load correctly

**Security Testing:**
- ✅ Cannot access facilities outside region
- ✅ Proper 403 errors for unauthorized access
- ✅ Global role still works (no regression)

## 🎓 Key Lessons Learned

1. **Always trace complete data flow** - Don't assume function names match usage
2. **Check ALL functions in a feature** - One component can call multiple RPC functions
3. **Test with real user interaction** - API tests miss UX issues
4. **Verify return types** - `JSONB` vs `TABLE` breaks frontend expectations
5. **Use MCP thinking tools** - Sequential thinking identified nested aggregate bug in 5 steps

## 📁 Files Modified

**Migrations (4):**
- `supabase/migrations/2025-10-13_reports/20251013140127_add_maintenance_report_rpc.sql`
- `supabase/migrations/2025-10-13_reports/20251013160000_fix_reports_nested_aggregates_and_regional_leader.sql`
- `supabase/migrations/2025-10-13_reports/20251013170000_fix_equipment_status_distribution_preserve_format.sql`
- `supabase/migrations/2025-10-13_reports/20251013180000_fix_inventory_rpcs_regional_leader.sql`

**Frontend (5):**
- `src/app/(app)/reports/page.tsx` - Tenant filter logic
- `src/app/(app)/reports/components/tenant-filter-dropdown.tsx` - Dropdown component
- `src/app/(app)/reports/components/maintenance-report-tab.tsx` - Pass selectedDonVi
- `src/app/(app)/reports/hooks/use-maintenance-data.ts` - Query params
- `src/components/equipment-distribution-summary.tsx` - Chart component

**Backend (1):**
- `src/app/api/rpc/[fn]/route.ts` - RPC proxy (ALLOWED_FUNCTIONS whitelist)

**Documentation (17 files):**
- `docs/Reports-RBAC/COMPLETE-FIX-SUMMARY.md` - Full technical summary
- `docs/Reports-RBAC/DEPLOYMENT-GUIDE.md` - Step-by-step deployment
- `docs/Reports-RBAC/ISSUE-EQUIPMENT-STATUS-DISTRIBUTION.md` - Issue analysis
- And 14 other tracking documents

## 🔒 Security Model

**Role-Based Access:**
- `global`: Can view any/all facilities
- `regional_leader`: Can view facilities in their region (via JWT `dia_ban` claim)
- `admin/technician/user`: Limited to their facility only

**Validation Flow:**
1. Extract role from JWT (`app_role` or `role`)
2. Call `allowed_don_vi_for_session_safe()` to get permitted facilities
3. Validate `p_don_vi` against allowed array
4. Raise exception if unauthorized
5. Apply filter: `WHERE tb.don_vi = v_effective_donvi`

## 🚀 Deployment Notes

**CRITICAL:** Apply migrations in order:
1. Migration 1 first (fixes 400 error)
2. Migration 2 second (fixes charts)
3. Migration 3 third (fixes KPIs) ← DO NOT SKIP!

**Post-Deployment:**
- Hard refresh browser (Ctrl+Shift+R) to clear React Query cache
- Test facility dropdown switching
- Verify KPIs show different values per facility
- Check browser console for errors

## 📊 Functions Fixed (6 Total)

1. ✅ `get_maintenance_report_data` - Maintenance tab
2. ✅ `maintenance_stats_for_reports` - Maintenance stats
3. ✅ `equipment_status_distribution` - Equipment charts
4. ✅ `equipment_list_for_reports` - Transaction table
5. ✅ `equipment_count_enhanced` - Tồn kho KPI
6. ✅ `transfer_request_list_enhanced` - Export data

## 🔗 Related Work

**Previous Implementations:**
- Phase 1: Maintenance Plan regional_leader support (2025-10-07)
- Dashboard tabs regional_leader support (2025-10-11)
- Repair Request regional_leader support (2025-10-11)

**Reusable Patterns:**
- `allowed_don_vi_for_session_safe()` helper (2025-10-04)
- RPC proxy security model (2025-09-29)
- Tenant dropdown component pattern (2025-10-13)

## ⚠️ Known Limitations

- `equipment_status_distribution` requires specific facility selection (cannot aggregate across region)
- Empty data returns zeros (expected behavior)
- Charts may be empty if no data exists for date range

## 🎯 Future Considerations

- Consider adding "Tất cả cơ sở (vùng)" aggregation for Inventory tab
- Add more granular date range filters
- Implement export functionality for reports
- Add caching optimization for large datasets

---

**Commit:** `fix(reports): Complete regional_leader RBAC support for Reports page`  
**Status:** ✅ PRODUCTION READY  
**Testing:** Comprehensive testing completed  
**Documentation:** Complete with troubleshooting guides