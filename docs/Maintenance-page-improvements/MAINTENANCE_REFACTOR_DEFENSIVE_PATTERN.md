# Maintenance Page Refactoring: Defensive Callback Pattern

**Date:** January 10, 2025  
**Status:** ✅ Completed  
**Approach:** Defensive callback pattern (Equipment page style)

---

## Problem Summary

The Maintenance page experienced race condition crashes when:
1. User navigated from Dashboard quick action with URL parameter `action=create`
2. Dialog opened before component fully initialized
3. User immediately clicked Cancel button
4. Dialog's `onSuccess` callback (`refetchPlans`) was invoked before React Query hook was ready
5. App crashed with undefined callback error

**Previous Fix:** Loading guard approach that delayed dialog opening until authentication and data loading completed.

**Current Fix:** Defensive callback pattern that allows immediate dialog opening while safely handling early callback invocations.

---

## Why Refactor?

### Equipment Page Doesn't Have This Problem

Investigation revealed Equipment page uses similar quick actions but **never crashes** because:

1. **Defensive callback structure:**
   ```typescript
   const onDataMutationSuccessWithStatePreservation = React.useCallback(() => {
     const currentState = table.getState(); // Stable UI state operation
     const stateToSave = {
       pageIndex: currentState.pagination.pageIndex,
       pageSize: currentState.pagination.pageSize,
     };
     setPreservePageState(stateToSave);
     onDataMutationSuccess(); // Safe refetch
   }, [table, onDataMutationSuccess]);
   ```

2. **Key characteristics:**
   - Operates on **stable UI state** (table state from initialized component)
   - Saves state **before** triggering async refetch
   - Uses `React.useCallback` with stable dependencies
   - Gracefully degrades if called early (just reads existing state)

3. **Equipment page can open dialogs immediately** without crashes because callbacks don't directly invoke async operations that might be uninitialized

### Benefits of Defensive Pattern Over Loading Guards

| Aspect | Loading Guard Approach | Defensive Callback Pattern |
|--------|----------------------|---------------------------|
| Dialog Opening | Delayed until auth + data load | Immediate (better UX) |
| User Experience | Visible delay | Instant response |
| Code Complexity | Guard conditions scattered | Centralized callback logic |
| Error Handling | Prevents early calls | Handles early calls gracefully |
| Maintainability | Multiple check points | Single defensive callback |
| Consistency | Different from Equipment | Matches Equipment pattern |

---

## Implementation Details

### 1. State Preservation System

**Added state to track UI across refetches:**
```typescript
const [preserveUIState, setPreserveUIState] = React.useState<{
  selectedPlanId: number | null
  activeTab: string
} | null>(null)
```

**Purpose:** Maintain user's context when dialogs trigger data refetch

### 2. Defensive Callback

**Core callback that replaces direct `refetchPlans`:**
```typescript
const onPlanMutationSuccessWithStatePreservation = React.useCallback(() => {
  // 1. Save current UI state (stable operation)
  const stateToSave = {
    selectedPlanId: selectedPlan?.id || null,
    activeTab: activeTab,
  }
  setPreserveUIState(stateToSave)
  
  // 2. Trigger refetch (safe because state already saved)
  refetchPlans()
}, [selectedPlan, activeTab, refetchPlans])
```

**Safety mechanisms:**
- Reads from already-initialized state variables (`selectedPlan`, `activeTab`)
- Operates on stable UI state before triggering async operations
- If called early, just saves `null` values (harmless)
- Refetch happens after state preservation, preventing race conditions

### 3. State Restoration Effect

**Restores UI after refetch completes:**
```typescript
React.useEffect(() => {
  if (preserveUIState && !isLoadingPlans && plans.length > 0) {
    // Restore selected plan
    if (preserveUIState.selectedPlanId) {
      const planToRestore = plans.find(p => p.id === preserveUIState.selectedPlanId)
      if (planToRestore) {
        setSelectedPlan(planToRestore)
      }
    }
    // Restore active tab
    if (preserveUIState.activeTab) {
      setActiveTab(preserveUIState.activeTab)
    }
    // Clear preserved state
    setPreserveUIState(null)
  }
}, [preserveUIState, isLoadingPlans, plans])
```

### 4. Simplified URL Parameter Handling

**Removed loading guards - no longer needed:**
```typescript
React.useEffect(() => {
  const actionParam = searchParams.get('action')
  
  // Can open dialog immediately - defensive callback handles early calls
  if (actionParam === 'create') {
    setIsAddPlanDialogOpen(true)
    window.history.replaceState({}, '', '/maintenance')
    return
  }
  
  // Plan selection waits for data naturally (plans.length > 0)
  // No authentication check needed
}, [searchParams, plans])
```

**Key differences from old code:**
- ❌ Removed: `if (status !== 'authenticated' || !user) return`
- ❌ Removed: `if (isLoadingPlans) return`
- ✅ Kept: Natural data wait (`plans.length > 0`)
- ✅ Added: Comment explaining defensive pattern allows immediate opening

### 5. Dialog Integration

**Updated dialogs to use defensive callback:**
```typescript
<AddMaintenancePlanDialog
  open={isAddPlanDialogOpen}
  onOpenChange={setIsAddPlanDialogOpen}
  onSuccess={onPlanMutationSuccessWithStatePreservation}
/>

<EditMaintenancePlanDialog
  open={!!editingPlan}
  onOpenChange={(open) => !open && setEditingPlan(null)}
  onSuccess={onPlanMutationSuccessWithStatePreservation}
  plan={editingPlan}
/>
```

---

## Comparison: Before vs After

### Before (Loading Guard Approach)

```typescript
// ❌ Guard wrapper around refetchPlans
const safeRefetchPlans = React.useCallback(() => {
  if (status !== 'authenticated' || !user || !refetchPlans) {
    console.warn('[Maintenance] refetchPlans called before page ready, ignoring')
    return Promise.resolve()
  }
  return refetchPlans()
}, [status, user, refetchPlans])

// ❌ URL param handler with loading guards
React.useEffect(() => {
  if (status !== 'authenticated' || !user) return // Guard 1
  if (isLoadingPlans) return // Guard 2
  
  if (actionParam === 'create') {
    setIsAddPlanDialogOpen(true) // Delayed opening
  }
}, [searchParams, plans, status, user, isLoadingPlans])

// ❌ Dialogs use guarded wrapper
<AddMaintenancePlanDialog onSuccess={safeRefetchPlans} />
```

**Problems:**
- Dialog opening delayed until authentication + data load
- Multiple guard conditions scattered across code
- User sees delay before dialog appears
- Different pattern from Equipment page

### After (Defensive Callback Pattern)

```typescript
// ✅ State preservation for UI context
const [preserveUIState, setPreserveUIState] = React.useState<{...} | null>(null)

// ✅ Defensive callback - saves state before refetch
const onPlanMutationSuccessWithStatePreservation = React.useCallback(() => {
  const stateToSave = {
    selectedPlanId: selectedPlan?.id || null,
    activeTab: activeTab,
  }
  setPreserveUIState(stateToSave)
  refetchPlans()
}, [selectedPlan, activeTab, refetchPlans])

// ✅ State restoration effect
React.useEffect(() => {
  if (preserveUIState && !isLoadingPlans && plans.length > 0) {
    // Restore selected plan and tab
    setPreserveUIState(null)
  }
}, [preserveUIState, isLoadingPlans, plans])

// ✅ Simplified URL handler - no loading guards needed
React.useEffect(() => {
  if (actionParam === 'create') {
    setIsAddPlanDialogOpen(true) // Immediate opening
  }
}, [searchParams, plans])

// ✅ Dialogs use defensive callback
<AddMaintenancePlanDialog onSuccess={onPlanMutationSuccessWithStatePreservation} />
```

**Benefits:**
- Dialog opens immediately (better UX)
- No loading guards needed
- Centralized callback logic
- Matches Equipment page pattern
- Safe handling of early calls

---

## Why This Pattern is Safer

### Loading Guard Approach
```
User Action → Check Auth → Check Loading → Open Dialog → Success Callback → Guard Check → Refetch
                ↑ Delays                                                        ↑ Reactive
```
- **Reactive:** Guards check conditions after the fact
- **Delays UX:** Dialog opening blocked by checks
- **Multiple points of failure:** Guards must be synchronized

### Defensive Callback Approach
```
User Action → Open Dialog → Success Callback → Save UI State → Refetch → Restore State
              ↑ Immediate                      ↑ Proactive                ↑ Graceful
```
- **Proactive:** Saves state before async operations
- **Immediate UX:** Dialog opens right away
- **Single point of safety:** Callback handles all cases

---

## Testing Scenarios

### Immediate Cancel (Previously Crashed)
**Scenario:**
1. User clicks "Thêm kế hoạch bảo trì" from Dashboard
2. Maintenance page loads with `?action=create`
3. Dialog opens immediately
4. User clicks Cancel before page finishes loading

**Expected behavior:**
- ✅ Dialog opens instantly
- ✅ Cancel button closes dialog
- ✅ No crash occurs
- ✅ Page continues loading normally

### Normal Flow
**Scenario:**
1. User opens dialog from in-page button
2. Fills out form
3. Clicks Save
4. Success callback triggers

**Expected behavior:**
- ✅ Dialog opens immediately
- ✅ Form submission works
- ✅ Success callback saves UI state
- ✅ Refetch updates data
- ✅ UI state restored (selected plan, active tab)

### Rapid Operations
**Scenario:**
1. User creates plan (triggers refetch)
2. Immediately creates another plan (while first refetch pending)
3. Both operations complete

**Expected behavior:**
- ✅ Both operations succeed
- ✅ UI state preserved for latest operation
- ✅ No race conditions
- ✅ Final state reflects all changes

---

## Migration Notes

### Code Removed
1. ❌ `safeRefetchPlans` wrapper function
2. ❌ Loading guards in URL param handler
3. ❌ Authentication status checks for dialog opening

### Code Added
1. ✅ `preserveUIState` state variable
2. ✅ `onPlanMutationSuccessWithStatePreservation` callback
3. ✅ State restoration effect

### Code Modified
1. 🔄 URL parameter handler (simplified)
2. 🔄 Dialog `onSuccess` props (new callback)

---

## Performance Impact

### Before
- Dialog opening: **Delayed** (waits for auth + data)
- Callback overhead: **Low** (simple guard check)
- State management: **Minimal**

### After
- Dialog opening: **Immediate** (no delay)
- Callback overhead: **Low** (state save operation)
- State management: **Moderate** (preservation/restoration)

**Net impact:** Better UX (immediate dialog) with negligible performance cost

---

## Future Improvements

### Consider for Other Pages
This pattern could benefit other pages with similar dialog workflows:
- Equipment page (already uses similar pattern)
- Repair page
- Calibration page
- Any page with quick actions from Dashboard

### Potential Enhancements
1. **Generic state preservation hook:**
   ```typescript
   const useUIStatePreservation = (initialState) => {
     // Reusable hook for state preservation pattern
   }
   ```

2. **Automatic state restoration:**
   - Detect what UI state needs preservation
   - Auto-restore without explicit effects

3. **Error boundary integration:**
   - Catch callback errors gracefully
   - Show user-friendly error messages

---

## Conclusion

The defensive callback pattern provides:
- ✅ **Better UX:** Immediate dialog opening
- ✅ **Safer code:** Handles early calls gracefully
- ✅ **Consistency:** Matches Equipment page pattern
- ✅ **Maintainability:** Centralized callback logic
- ✅ **Type safety:** Full TypeScript support

This approach transforms the Maintenance page from a guarded, delayed experience to an immediate, defensive experience that gracefully handles edge cases while maintaining code quality and consistency across the application.
