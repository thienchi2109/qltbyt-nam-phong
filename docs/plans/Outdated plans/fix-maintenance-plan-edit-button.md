# Fix Maintenance Plan Edit Button (Draft Status)

## Problem
The "Sửa" (Edit) button in the Plans table row menu does nothing when clicked. The handler is commented out, so clicking Edit does not open the edit dialog for draft plans.

## Root Cause
In `maintenance-columns.tsx:192`, the Edit button handler is literally a no-op comment:
```tsx
<DropdownMenuItem onSelect={() => {/* setEditingPlan(plan) */}}>
```

The `setEditingPlan` function is never passed to `usePlanColumns`, so it can't be used even if uncommented.

## Fix (2 files, 3 changes)

### 1. `src/app/(app)/maintenance/_components/maintenance-columns.tsx`

**Change A - Line 42-51:** Add `setEditingPlan` to interface:
```tsx
export interface PlanColumnOptions {
  sorting: SortingState
  setSorting: (sorting: SortingState) => void
  onRowClick: (plan: MaintenancePlan) => void
  openApproveDialog: (plan: MaintenancePlan) => void
  openRejectDialog: (plan: MaintenancePlan) => void
  openDeleteDialog: (plan: MaintenancePlan) => void
  setEditingPlan: (plan: MaintenancePlan | null) => void  // ADD
  canManagePlans: boolean
  isRegionalLeader: boolean
}
```

**Change B - Line 68-74:** Destructure `setEditingPlan`:
```tsx
const {
  onRowClick,
  openApproveDialog,
  openRejectDialog,
  openDeleteDialog,
  setEditingPlan,  // ADD
  canManagePlans,
} = options
```

**Change C - Line 192:** Uncomment the handler:
```tsx
<DropdownMenuItem onSelect={() => setEditingPlan(plan)}>
```

### 2. `src/app/(app)/maintenance/page.tsx`

**Change D - Line 626-635:** Pass `setEditingPlan`:
```tsx
const planColumns = usePlanColumns({
  sorting: planSorting,
  setSorting: setPlanSorting,
  onRowClick: handleSelectPlan,
  openApproveDialog: operations.openApproveDialog,
  openRejectDialog: operations.openRejectDialog,
  openDeleteDialog: operations.openDeleteDialog,
  setEditingPlan,  // ADD
  canManagePlans,
  isRegionalLeader,
})
```

## Verification
1. Run `npm run dev`
2. Login as global/admin
3. Go to Maintenance page → Plan tab
4. Find a plan with "Bản nháp" (draft) status
5. Click the row menu (3 dots) → Click "Sửa"
6. **Expected:** Edit dialog opens with plan data
7. Make a change, save, verify it persists

## Notes
- Mobile layout already works correctly (`mobile-maintenance-layout.tsx` uses `setEditingPlan`)
- Desktop card view in `page.tsx` (used for responsive breakpoints) also works correctly
- Only the desktop table column definition in `maintenance-columns.tsx` was missing this functionality
- Row click behavior stays as-is: always navigates to tasks tab (user confirmed)
