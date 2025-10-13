# 🚀 Quick Deployment Guide - Reports RBAC Fixes

**Total Time:** ~10 minutes  
**Risk Level:** 🟢 LOW (Isolated RPC function changes)

---

## 📋 Pre-Deployment Checklist

- [ ] Backup current Supabase database (optional but recommended)
- [ ] Confirm you have Supabase SQL Editor access
- [ ] Have regional_leader test account ready
- [ ] Browser DevTools console open for error monitoring

---

## 🎯 Step 1: Apply Migration 1 (Nested Aggregates Fix)

### Location
`D:\qltbyt-nam-phong\supabase\migrations\2025-10-13_reports\20251013160000_fix_reports_nested_aggregates_and_regional_leader.sql`

### Actions
1. Open Supabase SQL Editor
2. Copy entire contents of migration file
3. Execute in SQL Editor
4. Verify success message: "Success. No rows returned"

### What This Fixes
- ✅ `get_maintenance_report_data` - Removes nested aggregate error
- ✅ `maintenance_stats_for_reports` - Adds regional_leader support
- ⚠️ `equipment_status_distribution` - Temporarily breaks format (fixed in Step 2)

### Test Immediately
```bash
# In browser as regional_leader:
# 1. Navigate to Reports → Bảo trì / Sửa chữa tab
# 2. Select a facility from dropdown
# 3. Verify no 400 error
# 4. Check that charts load (may be empty if no data)
```

**Expected:** No errors in browser console  
**If Error:** Check SQL Editor for syntax errors in migration

---

## 🎯 Step 2: Apply Migration 2 (JSONB Format Fix)

### Location
`D:\qltbyt-nam-phong\supabase\migrations\2025-10-13_reports\20251013170000_fix_equipment_status_distribution_preserve_format.sql`

### Actions
1. Keep Supabase SQL Editor open
2. Copy entire contents of migration file
3. Execute in SQL Editor
4. Verify success message: "Success. No rows returned"

### What This Fixes
- ✅ `equipment_status_distribution` - Restores JSONB format
- ✅ Equipment Distribution charts below KPIs
- ✅ Frontend receives expected data structure

### Test Immediately
```bash
# In browser as regional_leader:
# 1. Navigate to Reports → Xuất-nhập-tồn tab
# 2. Scroll down to charts section
# 3. Verify charts display (may still show zeros if data issue)
```

**Expected:** Charts render (even if empty)  
**If Error:** Check SQL Editor for syntax errors

---

## 🎯 Step 3: Apply Migration 3 (Inventory Data Fix) ⭐ CRITICAL

### Location
`D:\qltbyt-nam-phong\supabase\migrations\2025-10-13_reports\20251013180000_fix_inventory_rpcs_regional_leader.sql`

### Actions
1. Keep Supabase SQL Editor open
2. Copy entire contents of migration file
3. Execute in SQL Editor
4. Verify success message: "Success. No rows returned"

### What This Fixes
- ✅ `equipment_list_for_reports` - Powers the transaction table
- ✅ `equipment_count_enhanced` - Powers "Tồn kho" KPI
- ✅ `transfer_request_list_enhanced` - Powers export data
- ✅ **THIS IS THE MISSING PIECE** - Fixes KPI values showing "0"

### Test Immediately
```bash
# In browser as regional_leader:
# 1. Navigate to Reports → Xuất-nhập-tồn tab
# 2. Select first facility from dropdown
# 3. Check "Tồng nhập" and "Tồn kho" KPI values
# 4. Should show ACTUAL numbers, not zeros
# 5. Switch to different facility
# 6. Verify KPIs change to different values
# 7. Check transaction table below - should show equipment
```

**Expected:** 
- KPI cards show real numbers (e.g., "Tồn kho: 150")
- Transaction table shows equipment list
- Charts display with data

**If Still Zeros:** 
- Check browser console for RPC errors
- Verify `selectedDonVi` is being passed
- Hard refresh (Ctrl+Shift+R)

---

### Test Immediately
```bash
# In browser as regional_leader:
# 1. Navigate to Reports → Xuất-nhập-tồn tab
# 2. Select first facility from dropdown
# 3. Note the "Tổng thiết bị" KPI value
# 4. Switch to different facility
# 5. Verify KPI value changes
```

**Expected:** KPI cards update when facility changes  
**If No Change:** Hard refresh (Ctrl+Shift+R) to clear React Query cache

---

## ✅ Post-Deployment Verification

### Test Scenario 1: Facility Switching
```bash
# As regional_leader:
1. Go to Reports page
2. Note current facility in dropdown
3. Check KPI values (e.g., "150 thiết bị")
4. Switch to different facility
5. Verify KPIs change (e.g., "230 thiết bị")
```

**Pass Criteria:** 
- ✅ KPI values are different per facility
- ✅ No errors in console
- ✅ Charts render correctly

### Test Scenario 2: Access Control
```bash
# As regional_leader:
1. Open browser DevTools → Network tab
2. Switch to a facility
3. Find the RPC call to equipment_status_distribution
4. Check response - should have data
5. Try to manually call with facility ID outside your region (via API test)
6. Should receive 403/401 error
```

**Pass Criteria:**
- ✅ Allowed facilities work
- ✅ Unauthorized facilities blocked

### Test Scenario 3: No Regression for Global
```bash
# As global role:
1. Go to Reports page
2. Select "Tất cả đơn vị"
3. Verify aggregate data shows
4. Select specific facility
5. Verify facility-specific data shows
```

**Pass Criteria:**
- ✅ Global can still view all facilities
- ✅ No changes in behavior

---

## 🐛 Troubleshooting

### Issue: "400 error" still appearing
**Solution:**
- Check migration 1 was applied successfully
- Verify `maintenance_aggregated` CTE exists in function
- Try hard refresh (Ctrl+Shift+R)

### Issue: KPI values not changing
**Solution:**
- Check migration 2 was applied successfully
- Verify `equipment_status_distribution` returns `JSONB` not `TABLE`
- Clear browser cache or use incognito window
- Check if `effectiveTenantKey` is being passed correctly

### Issue: "No data" showing for regional_leader
**Solution:**
- Verify regional_leader has `dia_ban` claim in JWT
- Check `allowed_don_vi_for_session_safe()` returns facility IDs
- Ensure selected facility is in regional_leader's region
- Run SQL: `SELECT * FROM don_vi WHERE dia_ban_id = <your_region_id>`

### Issue: SQL migration errors
**Common Errors:**
```sql
-- Error: function already exists
-- Solution: Migration uses CREATE OR REPLACE, should not error

-- Error: syntax error near "BEGIN"
-- Solution: Ensure entire file is copied, including BEGIN/COMMIT

-- Error: permission denied
-- Solution: Ensure you're running as postgres/service_role
```

---

## 📊 Verification Queries

Run these in Supabase SQL Editor to verify functions:

### Check function exists and return type
```sql
SELECT 
  routine_name,
  data_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name IN (
  'equipment_status_distribution',
  'get_maintenance_report_data',
  'maintenance_stats_for_reports'
)
AND routine_schema = 'public';
```

**Expected:**
- `equipment_status_distribution`: `data_type = 'jsonb'`
- `get_maintenance_report_data`: `data_type = 'jsonb'`
- `maintenance_stats_for_reports`: `data_type = 'USER-DEFINED'` (TABLE return)

### Test equipment_status_distribution
```sql
-- As postgres/service_role (simulating regional_leader)
SET request.jwt.claims = '{"app_role": "regional_leader", "don_vi": "1", "dia_ban": "1"}';

SELECT public.equipment_status_distribution(NULL, 1, NULL, NULL);
```

**Expected:** JSONB object with keys: `total_equipment`, `status_counts`, `by_department`, `by_location`, `departments`, `locations`

### Test get_maintenance_report_data
```sql
SELECT public.get_maintenance_report_data(
  '2025-01-01'::date,
  '2025-12-31'::date,
  1
);
```

**Expected:** JSONB object with keys: `summary`, `charts`

---

## 🔄 Rollback Plan (If Needed)

If issues arise, rollback by restoring original functions:

### Rollback equipment_status_distribution
```sql
-- Copy original function from:
-- D:\qltbyt-nam-phong\supabase\migrations\2025-09-29\20250923_reports_exports_final.sql
-- Lines 18-193
```

### Rollback get_maintenance_report_data
```sql
-- Copy original function from:
-- D:\qltbyt-nam-phong\supabase\migrations\2025-10-13_reports\20251013140127_add_maintenance_report_rpc.sql
-- Lines 15-227
```

---

## 📞 Support

If issues persist:
1. Check browser console for detailed errors
2. Check Supabase logs for backend errors
3. Verify JWT claims are correct (`dia_ban` present for regional_leader)
4. Ensure `allowed_don_vi_for_session_safe()` function exists

---

## ✅ Success Criteria

Migration is successful when:
- [x] No 400 errors in "Bảo trì / Sửa chữa" tab
- [x] KPI values update when facility changes in "Xuất-nhập-tồn" tab
- [x] Regional leader can switch between allowed facilities
- [x] Regional leader **cannot** access unauthorized facilities
- [x] Global role behavior unchanged
- [x] No console errors

---

**Deployment Time:** ~10 minutes  
**Testing Time:** ~5 minutes  
**Total Time:** ~15 minutes

**Status:** 🟢 READY TO DEPLOY
