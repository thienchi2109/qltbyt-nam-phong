# Phase 1: Department Filtering Test Plan

## Implementation Summary

### Changes Made:
1. **Equipment Page (`src/app/(app)/equipment/page.tsx`)**:
   - Added department-based cache keys
   - Applied `eq('khoa_phong_quan_ly', user.khoa_phong)` filter for non-admin users
   - Added visual notification showing active department filter
   - Updated cache invalidation to handle department-specific caches

2. **Equipment Hook (`src/hooks/use-cached-equipment.ts`)**:
   - Added `useAuth()` to access user context
   - Updated cache keys to include user department
   - Applied same department filtering logic
   - Added console logging for debugging

3. **UI Notification**:
   - Blue notification box showing "Đang hiển thị thiết bị cho khoa: [Department Name]"
   - Only visible for non-admin users with department assigned

### Test Cases:

#### Test Case 1: Admin User
- **Expected**: Should see ALL equipment, no filter notification
- **User roles**: `admin`, `to_qltb`
- **Cache key**: `equipment_data` (no department suffix)

#### Test Case 2: Department User with khoa_phong
- **Expected**: Should see only equipment where `khoa_phong_quan_ly = user.khoa_phong`
- **User roles**: `qltb_khoa`, `user`
- **Cache key**: `equipment_data_[department_name]`
- **UI**: Blue notification box visible

#### Test Case 3: User without khoa_phong (NULL)
- **Expected**: Should see no equipment (empty list)
- **Cache key**: `equipment_data` (no department suffix)
- **UI**: No notification box

### Database Query Examples:

```sql
-- Admin/to_qltb users:
SELECT * FROM thiet_bi ORDER BY id ASC;

-- Department users (e.g., khoa_phong = "Khoa Nội"):
SELECT * FROM thiet_bi 
WHERE khoa_phong_quan_ly = 'Khoa Nội' 
ORDER BY id ASC;

-- Users with NULL khoa_phong:
SELECT * FROM thiet_bi 
WHERE khoa_phong_quan_ly = NULL 
ORDER BY id ASC;
-- (This will return empty result as intended)
```

### Performance Considerations:
- Database index on `khoa_phong_quan_ly` column recommended
- Separate cache keys prevent data leakage between users
- Console logging added for debugging (should be removed in production)

### Next Steps for Phase 2:
- Add UI notifications and user preferences
- Implement toggle options if needed
- Add analytics tracking
