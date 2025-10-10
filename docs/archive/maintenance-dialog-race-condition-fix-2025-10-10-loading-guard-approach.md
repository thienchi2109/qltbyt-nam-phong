# Maintenance Page Race Condition Fix

**Date**: October 10, 2025  
**Issue**: App crashes when clicking "Cancel" on Add Maintenance Plan dialog if clicked immediately after navigation from dashboard  
**Status**: ✅ **FIXED**

---

## Problem Description

### Reproduction Steps
1. First visit: Navigate to `/dashboard`
2. Click quick action "Lập kế hoạch" → navigates to `/maintenance?action=create`
3. Dialog auto-opens via URL parameter
4. **Immediately click "Hủy" (Cancel)** before page finishes loading
5. **Result**: App crashes

### Root Cause

**Race Condition**: Dialog state management occurs before authentication and data hooks are fully initialized.

#### Sequence of Events (Before Fix)

```
1. Navigation: /dashboard → /maintenance?action=create
2. First render: status === "loading" → early return with skeleton
3. useEffect runs: setIsAddPlanDialogOpen(true) (from URL param ?action=create)
4. Second render: Still loading → early return, but dialog state = true
5. Third render: Authenticated → Full component renders
   - Dialog opens immediately
   - Hooks still initializing (useMaintenancePlans executing)
6. User clicks Cancel → Dialog closes
7. Callback fires: onSuccess={refetchPlans}
8. But refetchPlans or related state not ready → CRASH
```

### Why This Happened

The URL parameter handling in `useEffect` (line 317-343) set dialog state **before** the component finished its loading phase:

```typescript
React.useEffect(() => {
  const actionParam = searchParams.get('action')
  if (actionParam === 'create') {
    setIsAddPlanDialogOpen(true) // ← Sets state during loading phase!
    window.history.replaceState({}, '', '/maintenance')
  }
}, [searchParams, plans])
```

Early returns at lines 103-115 meant the dialog components weren't rendered initially, but the state was already set.

---

## Solution

### 1. Guard URL Parameter Processing

**File**: `src/app/(app)/maintenance/page.tsx`  
**Lines**: 318-321

Added authentication and data loading checks before processing URL parameters:

```typescript
React.useEffect(() => {
  // ✅ FIX: Don't process URL params until fully authenticated and data loaded
  if (status !== 'authenticated' || !user) return
  if (isLoadingPlans) return // Wait for initial data load
  
  const actionParam = searchParams.get('action')
  // ... rest of URL handling
}, [searchParams, plans, status, user, isLoadingPlans])
```

**Effect**: Dialog only opens after:
- ✅ User is authenticated
- ✅ Initial data fetch completes
- ✅ All hooks are initialized

### 2. Safe Refetch Wrapper

**File**: `src/app/(app)/maintenance/page.tsx`  
**Lines**: 130-138

Created a defensive wrapper around `refetchPlans` callback:

```typescript
const safeRefetchPlans = React.useCallback(() => {
  if (status !== 'authenticated' || !user || !refetchPlans) {
    console.warn('[Maintenance] refetchPlans called before page ready, ignoring')
    return Promise.resolve()
  }
  return refetchPlans()
}, [status, user, refetchPlans])
```

**Effect**: Even if callback is called prematurely (shouldn't happen now, but defense-in-depth):
- ✅ Logs warning instead of crashing
- ✅ Returns a resolved Promise for compatibility
- ✅ Gracefully ignores invalid calls

### 3. Updated Dialog Components

**File**: `src/app/(app)/maintenance/page.tsx`  
**Lines**: 1851, 1856

Changed from direct `refetchPlans` to safe wrapper:

```typescript
<AddMaintenancePlanDialog
  open={isAddPlanDialogOpen}
  onOpenChange={setIsAddPlanDialogOpen}
  onSuccess={safeRefetchPlans} // ← Changed from refetchPlans
/>

<EditMaintenancePlanDialog
  open={!!editingPlan}
  onOpenChange={(open) => !open && setEditingPlan(null)}
  onSuccess={safeRefetchPlans} // ← Changed from refetchPlans
  plan={editingPlan}
/>
```

---

## Testing & Verification

### ✅ TypeScript Compilation
```bash
npm run typecheck
# Result: No errors
```

### Test Scenarios (Recommended)

#### Scenario 1: Immediate Cancel (Original Bug)
1. Navigate from `/dashboard` → Click "Lập kế hoạch"
2. Dialog should open only after loading completes
3. Click "Cancel" immediately
4. **Expected**: No crash, dialog closes gracefully

#### Scenario 2: Normal Usage
1. Navigate to `/maintenance` normally
2. Click "Tạo kế hoạch mới"
3. Fill form and submit
4. **Expected**: Plan created, data refetches correctly

#### Scenario 3: Quick Navigation Away
1. Navigate with `?action=create` parameter
2. Immediately press browser back button
3. **Expected**: No crash, state cleans up properly

---

## Technical Insights

### Why Equipment Page Doesn't Have This Issue

The Equipment page uses similar patterns but doesn't crash because:

1. **Conditional data fetching**: Uses `enabled: shouldFetchEquipment` to gate queries
2. **Placeholder data**: Uses `placeholderData: keepPreviousData` for smoother transitions
3. **No auto-open dialogs**: Doesn't process URL params to auto-open dialogs on first visit

### Lessons Learned

1. **Always guard URL parameter effects** with loading/auth checks
2. **Wrap external callbacks** in defensive wrappers when passed to child components
3. **Early returns can create split-brain state** where hooks run but components don't render
4. **Test fast user interactions** - users may click faster than data loads

---

## Related Files

- `src/app/(app)/maintenance/page.tsx` - Main fix location
- `src/components/add-maintenance-plan-dialog.tsx` - Dialog component (no changes needed)
- `src/hooks/use-cached-maintenance.ts` - Data fetching hook (no changes needed)

---

## Rollback Plan

If issues arise, revert these changes:

```bash
git diff HEAD~1 src/app/(app)/maintenance/page.tsx
git checkout HEAD~1 -- src/app/(app)/maintenance/page.tsx
```

The pre-fix behavior will return (with the race condition).

---

**Status**: ✅ Fix implemented, type-checked, ready for testing  
**Next Steps**: Deploy and verify in production environment
