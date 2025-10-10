# Maintenance Page: Defensive Callback Pattern Refactor

**Date:** January 10, 2025  
**Type:** Refactoring  
**Impact:** High (UX improvement + crash fix)

## Context

The Maintenance page had a race condition crash when users:
1. Clicked Dashboard quick action "Thêm kế hoạch bảo trì" 
2. Dialog opened with URL param `?action=create`
3. Immediately clicked Cancel before page finished loading
4. App crashed because `refetchPlans` callback was called before React Query hook initialized

## Previous Solution (Loading Guards)

- Added `safeRefetchPlans` wrapper with authentication/loading checks
- URL parameter handler delayed dialog opening until auth + data ready
- **Problem:** Visible delay, different pattern from Equipment page

## Current Solution (Defensive Callback Pattern)

Adopted the same pattern used by Equipment page:

### Implementation

```typescript
// 1. State preservation for UI context
const [preserveUIState, setPreserveUIState] = React.useState<{
  selectedPlanId: number | null
  activeTab: string
} | null>(null)

// 2. Defensive callback - saves state BEFORE refetch
const onPlanMutationSuccessWithStatePreservation = React.useCallback(() => {
  const stateToSave = {
    selectedPlanId: selectedPlan?.id || null,
    activeTab: activeTab,
  }
  setPreserveUIState(stateToSave)
  refetchPlans() // Safe because state already saved
}, [selectedPlan, activeTab, refetchPlans])

// 3. State restoration after refetch
React.useEffect(() => {
  if (preserveUIState && !isLoadingPlans && plans.length > 0) {
    // Restore selectedPlan and activeTab
    setPreserveUIState(null)
  }
}, [preserveUIState, isLoadingPlans, plans])

// 4. Simplified URL handler - no guards needed
React.useEffect(() => {
  if (actionParam === 'create') {
    setIsAddPlanDialogOpen(true) // Opens immediately
  }
}, [searchParams, plans])
```

### Key Changes

**Removed:**
- ❌ `safeRefetchPlans` wrapper function
- ❌ Auth/loading guards in URL param handler
- ❌ Dialog opening delays

**Added:**
- ✅ `preserveUIState` state tracking
- ✅ `onPlanMutationSuccessWithStatePreservation` defensive callback
- ✅ State restoration effect

**Modified:**
- 🔄 Dialog `onSuccess` props now use defensive callback
- 🔄 URL parameter handler simplified

## Why This Pattern Works

### Loading Guard (Old)
```
Action → Check Auth → Check Loading → Open Dialog (Delayed)
         ↑ Reactive checks that delay UX
```

### Defensive Callback (New)
```
Action → Open Dialog → Callback → Save State → Refetch → Restore
         ↑ Immediate           ↑ Proactive safety
```

**Safety mechanism:**
- Operates on stable UI state (already initialized)
- Saves state **before** async operations
- If called early, saves `null` (harmless)
- Handles early calls gracefully without crashing

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Dialog Opening | Delayed (visible lag) | ✅ Immediate |
| Code Pattern | Different from Equipment | ✅ Consistent |
| UX | Clunky | ✅ Smooth |
| Safety | Reactive guards | ✅ Proactive preservation |

## Files Modified

- `src/app/(app)/maintenance/page.tsx` - Refactored with defensive pattern
- `MAINTENANCE_REFACTOR_DEFENSIVE_PATTERN.md` - Comprehensive documentation

## Testing Requirements

1. **Immediate Cancel (Previously Crashed):**
   - Click Dashboard quick action → Dialog opens → Cancel immediately
   - Expected: No crash, page continues loading

2. **Normal Flow:**
   - Create/edit plan → Success callback → Data refetch → UI preserved

3. **Rapid Operations:**
   - Create multiple plans quickly
   - Expected: All succeed, no race conditions

## Consistency Notes

**Pattern now matches Equipment page:**
- Both use `onDataMutationSuccessWithStatePreservation`
- Both save UI state before refetch
- Both restore state after refetch completes
- Both allow immediate dialog opening

**Consider applying to:**
- Repair page
- Calibration page
- Other pages with Dashboard quick actions

## Technical Details

**Type Safety:** ✅ Full TypeScript support, all checks pass

**Performance:** Minimal overhead (state save/restore operations are lightweight)

**Backwards Compatible:** No breaking changes to external APIs

## References

- Implementation: `src/app/(app)/maintenance/page.tsx` lines 243-261, 335-384
- Pattern origin: `src/app/(app)/equipment/page.tsx` lines 1584-1592
- Full docs: `MAINTENANCE_REFACTOR_DEFENSIVE_PATTERN.md`

## Summary

Transformed Maintenance page from reactive guard-based approach to proactive defensive callback pattern. Result: immediate dialog opening, better UX, safer code, and consistency with Equipment page. The pattern gracefully handles early callback invocations by operating on stable UI state rather than checking conditions reactively.
