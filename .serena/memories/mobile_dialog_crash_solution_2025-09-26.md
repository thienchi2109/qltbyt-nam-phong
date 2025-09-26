# Mobile Dialog Crash Solution - Critical Learning (2025-09-26)

## Problem
Mobile browsers crashed when closing the "Create Maintenance Plan" dialog from Dashboard → Maintenance navigation, but only when the user did NOT select any option in the Select component.

## Root Cause Discovered
**The Select component with undefined value crashes mobile browsers during dialog cleanup.**

Key insight: The crash only happened when closing the dialog WITHOUT selecting any option. When a value was selected first, no crash occurred.

## Solution Applied
Set a default value for the `loai_cong_viec` Select field:

```typescript
// In AddMaintenancePlanDialog and EditMaintenancePlanDialog
defaultValues: {
  ten_ke_hoach: "",
  nam: new Date().getFullYear(),
  khoa_phong: "",
  loai_cong_viec: "Bảo trì", // ✅ Prevents mobile crash
}
```

## Key Learning Points

### 1. Avoid Over-Engineering
- Initially tried complex mobile-specific workarounds (setTimeout, try-catch blocks, form cleanup logic)
- The real solution was simple: ensure Select components always have valid values
- Over-engineering often creates more problems than it solves

### 2. Focus on Exact Failure Conditions  
- User observation: "works after selecting, crashes without selecting"
- This pinpointed the exact issue: undefined Select value
- Understanding the precise failure condition leads to elegant solutions

### 3. Mobile Browser Sensitivity
- Mobile browsers are more sensitive to inconsistent component state during cleanup
- Desktop browsers tolerate undefined Select values better
- Always test dialog interactions on mobile devices

### 4. React Hook Form + Radix UI Pattern
- Default values in React Hook Form should cover all required fields
- Radix UI Select expects consistent controlled values
- Undefined values during component unmounting can crash mobile browsers

## Files Modified
- `src/components/add-maintenance-plan-dialog.tsx` - Added default loai_cong_viec value
- `src/components/edit-maintenance-plan-dialog.tsx` - Added default loai_cong_viec value  
- `src/app/(app)/maintenance/page.tsx` - Simplified URL parameter handling
- `tsconfig.json` - Excluded reference files from type checking

## Testing Status
- ✅ Dialog opens with "Bảo trì" pre-selected
- ✅ Users can change selection or keep default
- ✅ Dialog closes without crashes on mobile browsers
- ✅ TypeScript compilation passes
- ✅ Form validation works correctly

## Commit Message
```
fix: resolve mobile dialog crash by setting default Select value

- Root cause: Select component with undefined value crashes mobile browsers during cleanup
- Solution: Set default loai_cong_viec to 'Bảo trì' in form defaultValues
- Updated both AddMaintenancePlanDialog and EditMaintenancePlanDialog
- Simplified dialog handling to match reference pattern
- Removed over-engineered mobile-specific workarounds
```

## Rule for Future Development
**Always provide default values for Select components in forms**, especially in dialogs that might be closed without user interaction. Mobile browsers require consistent component state during cleanup.

This was a perfect example of how understanding the exact failure condition (undefined Select value) led to a simple, elegant solution rather than complex workarounds.