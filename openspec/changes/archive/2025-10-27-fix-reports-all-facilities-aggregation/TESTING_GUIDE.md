# Testing Guide - Reports "All Facilities" Aggregation

## Quick Start

### Prerequisites
1. Database migrations applied
2. Frontend deployed
3. Test users with different roles available

---

## Test Scenarios

### Scenario 1: Regional Leader - "All Facilities" Mode

**Setup:**
- Login with `regional_leader` user
- Navigate to Reports page
- Go to "Xuất-Nhập-Tồn" tab

**Steps:**
1. Select "Tất cả cơ sở (vùng)" from facility dropdown
2. Wait for data to load
3. Verify KPI cards show numbers (not zeros)
4. Verify info message displays instead of table
5. Verify no charts are shown
6. Check browser console for errors (should be none)

**Expected Results:**
- ✅ KPI cards display aggregated values from all allowed facilities
- ✅ "Tổng nhập" shows sum of imports across facilities
- ✅ "Tổng xuất" shows sum of exports across facilities
- ✅ "Tồn kho" shows total current stock
- ✅ "Biến động" shows net change
- ✅ Info card displays: "Đang hiển thị dữ liệu tổng hợp..."
- ✅ No detailed transaction table
- ✅ No charts section
- ✅ No console errors

**Manual Verification:**
To verify correctness, check individual facilities and sum manually:
```sql
-- For each allowed facility, run:
SELECT 
  COUNT(*) FILTER (WHERE created_at::date BETWEEN '2025-01-01' AND '2025-12-31') as imports,
  COUNT(*) as current_stock
FROM thiet_bi 
WHERE don_vi = [facility_id];

-- Sum the results and compare with aggregated values
```

---

### Scenario 2: Regional Leader - Single Facility Mode

**Steps:**
1. From "all facilities", select a specific facility
2. Wait for data to load
3. Verify detailed table appears
4. Verify charts appear
5. Verify KPI cards still show correct values

**Expected Results:**
- ✅ Detailed transaction table displays
- ✅ Charts section displays
- ✅ KPI cards show single-facility values
- ✅ Data matches selected facility only
- ✅ No console errors

---

### Scenario 3: Global User - "All Facilities" Mode

**Setup:**
- Login with `global` or `admin` user
- Navigate to Reports page

**Steps:**
1. Select "Tất cả đơn vị" from facility dropdown
2. Wait for data to load
3. Verify system-wide aggregated values

**Expected Results:**
- ✅ KPI cards show system-wide totals
- ✅ Values should be higher than any single facility
- ✅ Info message displays
- ✅ No errors

**Manual Verification:**
```sql
-- System-wide totals
SELECT 
  COUNT(*) FILTER (WHERE created_at::date BETWEEN '2025-01-01' AND '2025-12-31') as total_imports,
  COUNT(*) as total_current_stock
FROM thiet_bi;
```

---

### Scenario 4: Facility User - No "All" Option

**Setup:**
- Login with `facility_user` role
- Navigate to Reports page

**Steps:**
1. Check facility dropdown
2. Verify "all facilities" option is NOT present

**Expected Results:**
- ✅ Dropdown only shows user's assigned facility
- ✅ No "Tất cả" option
- ✅ Reports display normally for single facility

---

### Scenario 5: Department Filter with "All Facilities"

**Setup:**
- Login as `regional_leader`
- Select "Tất cả cơ sở"

**Steps:**
1. Select a specific department from department dropdown
2. Wait for data to load
3. Verify filtered aggregated values

**Expected Results:**
- ✅ KPI cards show aggregated values filtered by department
- ✅ Values should be less than or equal to "all departments"
- ✅ Department list updates correctly

---

### Scenario 6: Date Range Filter with "All Facilities"

**Setup:**
- Login as `regional_leader`
- Select "Tất cả cơ sở"

**Steps:**
1. Change date range (e.g., last month only)
2. Click "Làm mới" or wait for auto-refresh
3. Verify KPI cards update

**Expected Results:**
- ✅ "Tổng nhập" reflects imports in date range only
- ✅ "Tổng xuất" reflects exports in date range only
- ✅ "Tồn kho" remains unaffected (current stock doesn't filter by date)
- ✅ Values change appropriately with date range

---

### Scenario 7: Cache Behavior

**Setup:**
- Login as `regional_leader`
- Select "Tất cả cơ sở"
- Wait for data to load

**Steps:**
1. Note the values in KPI cards
2. Switch to a different tab (e.g., "Bảo trì")
3. Switch back to "Xuất-Nhập-Tồn" tab
4. Verify data loads from cache (instant)

**Expected Results:**
- ✅ Data loads instantly from cache
- ✅ No RPC calls made (check Network tab)
- ✅ Values unchanged

**Then:**
1. Wait 5+ minutes or force refresh
2. Verify data reloads from server

---

### Scenario 8: Error Handling - Unauthorized Access

**Setup:**
- Developer tools open
- Network tab visible

**Steps:**
1. Login as `regional_leader`
2. In browser console, attempt to call aggregate RPC with unauthorized facility:
   ```javascript
   await callRpc({
     fn: 'equipment_aggregates_for_reports',
     args: { 
       p_don_vi_array: [999999], // Unauthorized facility ID
       p_date_from: '2025-01-01',
       p_date_to: '2025-12-31'
     }
   })
   ```

**Expected Results:**
- ✅ Error 42501 raised
- ✅ Error message: "Access denied to requested facilities"
- ✅ No data returned
- ✅ UI handles error gracefully (shows error toast)

---

### Scenario 9: Performance Check

**Setup:**
- Login with user that has access to many facilities (5+)
- Open browser DevTools Network tab

**Steps:**
1. Select "Tất cả cơ sở"
2. Measure time from click to data display
3. Check Network tab for RPC call duration

**Expected Results:**
- ✅ Total time < 3 seconds
- ✅ Single `equipment_aggregates_for_reports` RPC call
- ✅ Single `departments_list_for_facilities` RPC call
- ✅ No multiple facility queries
- ✅ UI remains responsive during load

**Performance Targets:**
- 3-5 facilities: < 1.5s
- 5-10 facilities: < 2.5s
- 10+ facilities: < 3.5s

---

### Scenario 10: Switching Between Modes

**Steps:**
1. Login as `regional_leader`
2. Select specific facility → verify detailed view
3. Select "Tất cả cơ sở" → verify aggregated view
4. Select different specific facility → verify detailed view
5. Select "Tất cả cơ sở" again → verify aggregated view

**Expected Results:**
- ✅ Smooth transitions between modes
- ✅ No stale data
- ✅ Cache works correctly for each mode
- ✅ No console errors

---

## Security Testing

### Test 1: SQL Injection Attempt

**Steps:**
```javascript
// Attempt SQL injection via facility array
await callRpc({
  fn: 'equipment_aggregates_for_reports',
  args: { 
    p_don_vi_array: ["1; DROP TABLE thiet_bi;"],
    p_date_from: '2025-01-01',
    p_date_to: '2025-12-31'
  }
})
```

**Expected Results:**
- ✅ Query fails safely
- ✅ No SQL executed
- ✅ Error handled gracefully

### Test 2: Role Escalation Attempt

**Steps:**
1. Login as `facility_user`
2. Manually craft RPC call with facility array:
   ```javascript
   await callRpc({
     fn: 'equipment_aggregates_for_reports',
     args: { p_don_vi_array: [1, 2, 3] }
   })
   ```

**Expected Results:**
- ✅ Returns data for user's facility only
- ✅ Ignores facility array
- ✅ No privilege escalation

---

## Regression Testing

### Verify Existing Functionality Still Works

**Test:**
1. Single facility reports (existing flow)
2. Department filtering
3. Date range filtering  
4. Search functionality
5. Export reports
6. Charts rendering
7. Detailed transaction table

**Expected Results:**
- ✅ All existing features work unchanged
- ✅ No performance degradation
- ✅ No new console errors

---

## Troubleshooting Common Issues

### Issue: KPI Cards Show 0

**Check:**
```javascript
// In browser console
await callRpc({ fn: 'get_facilities_with_equipment_count', args: {} })
// Should return array of facilities with IDs
```

**If empty:** User may not have access to any facilities

### Issue: Error 42501

**Check:**
```javascript
// In browser console
await callRpc({ fn: 'allowed_don_vi_for_session_safe', args: {} })
// Should return array of allowed facility IDs
```

**If NULL:** User's regional leader configuration may be incorrect

### Issue: Slow Performance

**Check database indexes:**
```sql
-- Check for indexes on key columns
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE tablename IN ('thiet_bi', 'yeu_cau_luan_chuyen')
  AND (
    indexname LIKE '%don_vi%' OR 
    indexname LIKE '%created_at%' OR
    indexname LIKE '%khoa_phong%'
  );
```

---

## Acceptance Criteria Checklist

### Functional Requirements
- [ ] Regional leader can select "all facilities" and see aggregated data
- [ ] Global user can select "all facilities" and see system-wide data
- [ ] KPI cards display correct aggregated sums
- [ ] Department filter works with "all facilities"
- [ ] Date range filter works with "all facilities"
- [ ] Switching between single/all facility modes works
- [ ] Info message displays in "all facilities" mode
- [ ] Charts hidden in "all facilities" mode
- [ ] Detailed table hidden in "all facilities" mode

### Non-Functional Requirements
- [ ] Query performance < 3 seconds
- [ ] No console errors
- [ ] No breaking changes to existing functionality
- [ ] Proper error handling
- [ ] Authorization enforced correctly
- [ ] SQL injection prevented
- [ ] Cache works correctly
- [ ] UI responsive and smooth

### Security Requirements
- [ ] Regional leader cannot access unauthorized facilities
- [ ] Facility user cannot escalate privileges
- [ ] SQL injection attempts fail safely
- [ ] Error messages don't leak sensitive data

---

## Sign-Off

**Tested By:** _________________  
**Date:** _________________  
**Status:** ☐ Pass  ☐ Fail  
**Notes:**

---

**Issues Found:** (List any bugs or concerns)

---

**Ready for Production:** ☐ Yes  ☐ No  
**Approved By:** _________________
