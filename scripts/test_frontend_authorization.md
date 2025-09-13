# Frontend Authorization Testing Guide

## Overview
This guide helps you test the frontend-only department-based authorization for repair request creation.

## Test Scenarios

### 1. Admin User Testing
**Expected Behavior**: Admin users should see all equipment and can create repair requests for any equipment.

**Test Steps**:
1. Login with an admin account
2. Go to Repair Requests page
3. Click on equipment search field
4. Verify you can see equipment from all departments
5. Select any equipment and create a repair request
6. Verify the request is created successfully

**Expected Results**:
- ✅ Can see all equipment regardless of department
- ✅ Can create repair requests for any equipment
- ✅ No department restrictions shown in UI

### 2. QLTB Manager Testing
**Expected Behavior**: QLTB managers should see all equipment and can create repair requests for any equipment.

**Test Steps**:
1. Login with a to_qltb role account
2. Go to Repair Requests page
3. Click on equipment search field
4. Verify you can see equipment from all departments
5. Select any equipment and create a repair request
6. Verify the request is created successfully

**Expected Results**:
- ✅ Can see all equipment regardless of department
- ✅ Can create repair requests for any equipment
- ✅ No department restrictions shown in UI

### 3. Regular User with Department Testing
**Expected Behavior**: Regular users should only see equipment from their own department.

**Test Steps**:
1. Login with a regular user account that has khoa_phong assigned
2. Go to Repair Requests page
3. Note the user's department in the UI guidance
4. Click on equipment search field
5. Verify you only see equipment from your department
6. Try to search for equipment names from other departments
7. Select equipment from your department and create a repair request
8. Verify the request is created successfully

**Expected Results**:
- ✅ Only see equipment from user's department
- ✅ Search placeholder shows department-specific text
- ✅ UI shows guidance about department restrictions
- ✅ Can create repair requests for own department equipment
- ✅ Cannot see equipment from other departments

### 4. User Without Department Testing
**Expected Behavior**: Users without assigned department should see no equipment and get appropriate warnings.

**Test Steps**:
1. Login with a user account that has NULL or empty khoa_phong
2. Go to Repair Requests page
3. Click on equipment search field
4. Verify you see no equipment options
5. Check for warning message about missing department assignment

**Expected Results**:
- ✅ No equipment shown in search
- ✅ Warning message about missing department assignment
- ✅ Clear guidance to contact administrator

### 5. Cross-Department Access Prevention
**Expected Behavior**: Regular users should not be able to create repair requests for equipment outside their department.

**Test Steps**:
1. Login with a regular user from Department A
2. Somehow obtain equipment ID from Department B (e.g., from browser dev tools)
3. Try to create a repair request by manipulating the form
4. Verify the system blocks the request with appropriate error message

**Expected Results**:
- ✅ Frontend validation blocks unauthorized requests
- ✅ Clear error message about department restrictions
- ✅ Request is not created in database

## UI Elements to Verify

### Search Field
- [ ] Placeholder text shows department context for regular users
- [ ] Placeholder text is generic for admin/QLTB users

### Equipment Dropdown
- [ ] Shows equipment name and code
- [ ] Shows department name for each equipment item
- [ ] Only shows authorized equipment based on user role

### No Results Message
- [ ] Shows department-specific message when no equipment found
- [ ] Provides helpful context about search scope

### User Guidance
- [ ] Shows department restriction info for regular users
- [ ] Shows warning for users without department
- [ ] No restrictions shown for admin/QLTB users

### Error Messages
- [ ] Clear Vietnamese error messages
- [ ] Specific guidance for different error types
- [ ] Helpful suggestions for resolution

## Console Verification

### Check Browser Console
1. Open browser developer tools (F12)
2. Go to Console tab
3. Perform test actions
4. Verify no errors related to:
   - Equipment authorization error
   - RPC function calls
   - Missing functions

### Expected Console Messages
- ✅ "Equipment fetch successful: X items" (where X = number of authorized equipment)
- ✅ "[RepairRequests] Applying department filter: [Department Name]" (for regular users)
- ❌ No "Equipment authorization error" messages
- ❌ No RPC-related errors

## Database Verification

### Check Created Repair Requests
```sql
-- Verify repair requests are created correctly
SELECT 
    ycsc.id,
    ycsc.thiet_bi_id,
    ycsc.nguoi_yeu_cau,
    tb.ten_thiet_bi,
    tb.khoa_phong_quan_ly,
    ycsc.created_at
FROM yeu_cau_sua_chua ycsc
JOIN thiet_bi tb ON tb.id = ycsc.thiet_bi_id
ORDER BY ycsc.created_at DESC
LIMIT 10;
```

### Check User Department Assignments
```sql
-- Verify user department assignments
SELECT 
    username,
    full_name,
    role,
    khoa_phong,
    CASE 
        WHEN role IN ('admin', 'to_qltb') THEN 'Unrestricted Access'
        WHEN khoa_phong IS NULL THEN 'No Access'
        ELSE 'Department: ' || khoa_phong
    END as access_level
FROM nhan_vien
ORDER BY role, khoa_phong;
```

## Troubleshooting

### Common Issues

1. **No equipment showing for regular users**
   - Check user's khoa_phong assignment
   - Verify equipment has khoa_phong_quan_ly assigned
   - Check console for query errors

2. **Admin users not seeing all equipment**
   - Verify user role is exactly 'admin' or 'to_qltb'
   - Check for case sensitivity issues

3. **Console errors about missing functions**
   - This is expected and normal with frontend-only implementation
   - Errors should be caught and handled gracefully

### Performance Check
- Equipment list should load quickly
- Search should be responsive
- No noticeable delays in form submission

## Success Criteria

The implementation is successful if:
- ✅ All test scenarios pass
- ✅ No console errors affecting functionality
- ✅ UI provides clear guidance to users
- ✅ Department-based restrictions work as expected
- ✅ Admin and QLTB users maintain full access
- ✅ Regular users are appropriately restricted
- ✅ Users without departments are properly handled
