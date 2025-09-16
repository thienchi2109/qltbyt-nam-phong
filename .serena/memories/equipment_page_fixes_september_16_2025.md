# Equipment Page Fixes - September 16, 2025

## Issues Resolved

### 1. "Cannot access 'tenantOptions' before initialization" Error
**Problem**: The `tenantOptions` state variable was being referenced in the `fetchEquipment` callback before it was declared, causing a JavaScript initialization error.

**Solution**: 
- Moved `tenantOptions` state declaration before the `fetchEquipment` callback (line 375)
- Moved the tenant loading useEffect to a proper position after state declarations (line 855-867)

### 2. Double Dialog Opening Issue
**Problem**: When clicking "Sửa thông tin" from the dropdown menu, both the "Xem chi tiết" dialog and "Sửa thông tin" dialog would open simultaneously.

**Solution**:
- Added `onClick={(e) => e.stopPropagation()}` to the `DropdownMenuContent` to prevent event bubbling to the table row click handler
- The table row has an `onClick={() => handleShowDetails(row.original)}` that was being triggered along with the menu item actions

### 3. Tenant Filter UI Improvements (Previous)
**Changes Made**:
- Removed the redundant comment text "Đang lọc theo đơn vị ID: {selectedDonViUI}" next to the tenant dropdown
- Increased SelectTrigger width from `w-[220px]` to `w-[280px]` to prevent text cutoff

### 4. Realtime Function Temporarily Disabled
**Change**: Commented out `useEquipmentRealtimeSync()` with a TODO comment for easy re-enabling
```typescript
// Enable realtime sync to invalidate cache on external changes
// TODO: Temporarily disabled - uncomment to re-enable
// useEquipmentRealtimeSync()
```

## Files Modified
- `src/app/(app)/equipment/page.tsx`

## How to Re-enable Realtime
To re-enable realtime functionality, simply uncomment line 336:
```typescript
// Enable realtime sync to invalidate cache on external changes
useEquipmentRealtimeSync()
```

## Verification
- ✅ Equipment page loads without initialization errors
- ✅ Clicking "Sửa thông tin" opens only the edit dialog, not both dialogs
- ✅ Tenant filter dropdown is wider and doesn't show redundant ID text
- ✅ Realtime sync is disabled but can be easily re-enabled

## Technical Details
The core issue was event bubbling - when clicking menu items in the dropdown, the click event was propagating up to the table row, causing the row's onClick handler (which opens the details dialog) to execute in addition to the menu item's action. Adding stopPropagation to the dropdown content container prevents this.