# Repair Request Authorization Implementation (Frontend-Only)

## Overview

This document describes the simplified frontend-only implementation of department-based authorization for repair request creation in the medical equipment management system. The implementation ensures that users can only create repair requests for equipment within their own department (khoa_phong), while maintaining exceptions for admin and to_qltb roles.

## Security Issue Addressed

**Problem**: Users could create repair requests for ANY equipment by entering the equipment ID directly, even for equipment outside their department.

**Solution**: Implemented frontend authorization checks with department-based filtering.

## Implementation Components

### 1. Frontend Equipment Filtering

#### Equipment Search Filtering
- **Location**: `src/app/(app)/repair-requests/page.tsx` (lines 376-409)
- **Purpose**: Filter equipment list based on user department before displaying
- **Logic**:
  - Admin and to_qltb roles: See all equipment
  - Users with NULL khoa_phong: See no equipment
  - Regular users: See only equipment from their department
- **Implementation**: Direct database query with department filter

#### Frontend Authorization Check
- **Location**: `src/app/(app)/repair-requests/page.tsx` (lines 480-519)
- **Purpose**: Validate user permission before creating repair request
- **Process**:
  1. Check if user has admin/to_qltb role (bypass check)
  2. Verify user has assigned department
  3. Query equipment department from database
  4. Compare user department with equipment department
  5. Block creation if departments don't match

### 2. Enhanced User Interface

#### Department-Aware UI Components
- **Location**: `src/app/(app)/repair-requests/page.tsx` (lines 1255-1318)
- **Features**:
  - Department-specific placeholder text in search field
  - Equipment department display in dropdown options
  - "No results" message with department context
  - User guidance about department restrictions
  - Warning for users without department assignment
  - Visual indicators showing user's authorized scope

## Authorization Matrix

| User Role | Department | Can Access Equipment From | Can Create Repair Requests |
|-----------|------------|---------------------------|----------------------------|
| admin | Any/NULL | All departments | All equipment |
| to_qltb | Any | All departments | All equipment |
| user | Assigned | Same department only | Same department only |
| user | NULL | None | None |

## Security Features

### Frontend Security
- Equipment list filtered by department before display
- Real-time validation feedback during form submission
- Clear user guidance about access restrictions
- Graceful handling of unauthorized access attempts
- Department verification before repair request creation

### Security Limitations (Accepted Trade-offs)
- **Client-side only**: Authorization checks can be bypassed by technical users
- **API access**: Direct database/API access can circumvent restrictions
- **Browser manipulation**: Users with developer tools can potentially bypass frontend checks
- **Suitable for**: Internal corporate environments with trusted users

## Error Messages

The system provides user-friendly error messages in Vietnamese:

- **User not found**: "Người dùng không tồn tại."
- **Equipment not found**: "Thiết bị không tồn tại."
- **No department assigned**: "Tài khoản chưa được phân công khoa/phòng."
- **Equipment no department**: "Thiết bị chưa được phân công khoa/phòng quản lý."
- **Department mismatch**: "Bạn chỉ có thể tạo yêu cầu sửa chữa cho thiết bị thuộc khoa/phòng của mình."

## Testing

### Frontend Testing Guide
- **Location**: `scripts/test_frontend_authorization.md`
- **Coverage**:
  - Admin and QLTB manager unrestricted access
  - Regular user department-based restrictions
  - Users without department assignment
  - UI behavior and error messages
  - Cross-department access prevention

### Test Scenarios
1. Admin access to any equipment
2. QLTB manager access to any equipment
3. User access to same department equipment
4. User denied access to different department equipment
5. User with no department denied access
6. UI guidance and error message validation

## Deployment Instructions

1. **Frontend Changes Only**:
   - The implementation is already complete in the repair requests page
   - No database migrations required
   - No additional deployment steps needed

2. **Test the Implementation**:
   - Refresh your browser to clear any cached errors
   - Test with different user roles (admin, to_qltb, regular users)
   - Verify department-based filtering works correctly
   - Test repair request creation with authorized/unauthorized equipment

## Rollback Plan

If issues arise, the system can be easily rolled back by reverting the frontend changes:

1. **Remove Department Filtering**:
   - Change equipment query back to: `supabase.from('thiet_bi').select('id, ma_thiet_bi, ten_thiet_bi')`
   - Remove the department filter condition

2. **Remove Authorization Check**:
   - Remove the frontend validation logic in `handleSubmit`
   - Allow direct repair request creation without department checks

3. **Restore Original UI**:
   - Remove department-specific messaging and guidance
   - Restore original placeholder text and dropdown display

## Performance Considerations

- Database functions use indexes on `khoa_phong` and `khoa_phong_quan_ly` fields
- Equipment filtering reduces data transfer and improves UI responsiveness
- Caching mechanisms remain intact for optimal performance
- Authorization checks add minimal overhead to repair request creation

## Maintenance

- Monitor authorization function performance
- Review error logs for unauthorized access attempts
- Update department mappings as organizational structure changes
- Regularly test authorization rules with different user scenarios
