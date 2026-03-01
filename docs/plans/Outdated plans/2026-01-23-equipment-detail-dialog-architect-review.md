# Architectural Review: Equipment Detail Dialog Refactoring

**Date:** 2026-01-23
**Reviewer:** Architect Agent
**Verdict:** APPROVED with minor recommendations

---

## Executive Summary

The proposed refactoring plan is architecturally sound and follows established patterns in the codebase. The incremental migration strategy with verification gates is a safe approach.

---

## 1. Component Split Assessment

### Current State Analysis

The source file (`equipment-detail-dialog.tsx`) at 1,216 lines contains:
- 4 tabs (details, files, history, usage)
- 8 state variables
- 2 queries (attachments, history)
- 3 mutations (update, add attachment, delete attachment)
- Complex form with 22+ fields
- View/edit mode toggle with dirty check

### Proposed Split Evaluation

| Component | Lines | Responsibility | Verdict |
|-----------|-------|----------------|---------|
| `EquipmentDetailContext.tsx` | ~150 | State orchestration | **Good** - Follows existing EquipmentDialogContext pattern |
| `EquipmentDetailDialog.tsx` | ~120 | Shell + tabs | **Good** - Clean container pattern |
| `EquipmentDetailTabDetails.tsx` | ~350 | View/Edit form | **Acceptable** - Could be further split (see below) |
| `EquipmentDetailTabFiles.tsx` | ~180 | Attachments | **Good** - Self-contained CRUD |
| `EquipmentDetailTabHistory.tsx` | ~150 | Timeline | **Good** - Read-only presentation |
| `EquipmentDetailTabUsage.tsx` | ~30 | Wrapper | **Good** - Thin wrapper for existing component |
| `useEquipmentDetailContext.ts` | ~15 | Consumer hook | **Good** - Standard pattern |

**Overall Assessment: The split is reasonable and follows Single Responsibility Principle.**

### Potential Improvement: Details Tab Further Split

The Details tab at ~350 lines could be further decomposed:
- `EquipmentDetailForm.tsx` (~250 lines) - Edit form with 22+ fields
- `EquipmentDetailView.tsx` (~100 lines) - Read-only display grid

This would improve testability and make the form reusable. However, this is **optional** and can be deferred to a future iteration.

---

## 2. Context Design Analysis

### Pattern Compliance

The plan follows the established `EquipmentDialogContext` pattern:

```typescript
// Existing pattern (EquipmentDialogContext.tsx lines 8-22):
// - Dialog orchestration only, mutations in components
// - Simpler context = fewer re-renders
```

**Key Design Notes from Existing Pattern:**
1. Context focuses on dialog orchestration, NOT mutations
2. Mutations stay in dialog components (co-located with form state)
3. `onDataMutationSuccess()` callback for cache invalidation

### Recommended Context Structure

```typescript
interface EquipmentDetailContextValue {
  // Equipment data
  equipment: Equipment | null
  displayEquipment: Equipment | null  // Merged with saved values

  // Tab state
  currentTab: string
  setCurrentTab: (tab: string) => void

  // Edit mode
  isEditingDetails: boolean
  setIsEditingDetails: (editing: boolean) => void

  // Queries (read-only data)
  attachments: Attachment[]
  isLoadingAttachments: boolean
  history: HistoryItem[]
  isLoadingHistory: boolean

  // Permissions
  canEdit: boolean

  // Dialog control
  onClose: () => void
  onEquipmentUpdated: () => void
}
```

### Architectural Concern: Context Scope

**Question:** Should `EquipmentDetailContext` be:
1. **Dialog-scoped** (provider wraps only the dialog content)
2. **Page-scoped** (provider integrated into existing EquipmentDialogProvider)

**Recommendation:** Dialog-scoped provider.

**Rationale:**
- The existing `EquipmentDialogContext` manages dialog open/close orchestration
- `EquipmentDetailContext` manages internal dialog state (tabs, edit mode, queries)
- These are orthogonal concerns - keep them separate
- Dialog-scoped avoids unnecessary re-renders in other page components

---

## 3. Migration Strategy Review

### Phase-by-Phase Analysis

| Phase | Description | Risk | Verification |
|-------|-------------|------|--------------|
| 1 | Extract types/helpers | Low | Build passes |
| 2 | Create context shell | Medium | Dialog opens, tabs navigate |
| 3 | Extract History tab | Low | History displays |
| 4 | Extract Usage tab | Very Low | Wrapper only |
| 5 | Extract Files tab | Medium | CRUD works |
| 6 | Extract Details tab | High | Most complex, form validation |
| 7 | Final migration | High | Import updates, delete old file |

### Migration Safety Assessment

**Strengths:**
- Incremental extraction with verification gates
- Simplest components first (History, Usage), complex last (Details)
- Build verification after each phase

**Recommendations:**

1. **Add TypeScript strict mode verification:**
   ```bash
   npm run typecheck  # Add after each phase
   ```

2. **Add runtime smoke test between phases:**
   - Manual test: Open dialog, navigate tabs, perform action
   - Consider adding Playwright E2E test for this dialog

3. **Phase 6 (Details Tab) is highest risk:**
   - Form state management is complex
   - `savedValues` pattern for optimistic updates
   - Consider sub-phases:
     - 6a: Extract view mode only
     - 6b: Extract edit form
     - 6c: Wire up mutations

4. **Phase 7 (Final Migration) should include:**
   - Search for ALL imports of old file
   - Update barrel exports if any
   - Verify no dead code remains

---

## 4. Missing Considerations

### 4.1 Form State Preservation

The current implementation uses a `prevEquipmentIdRef` pattern to prevent form reset when toggling edit mode:

```typescript
// Line 286-334
const prevEquipmentIdRef = React.useRef<number | null>(null)
React.useEffect(() => {
  if (equipment && equipment.id !== prevEquipmentIdRef.current) {
    prevEquipmentIdRef.current = equipment.id
    editForm.reset({...})
  }
}, [equipment, editForm])
```

**Concern:** When moving form to Details tab, ensure this ref-based pattern is preserved correctly.

**Recommendation:** Document this pattern in the Details tab component.

### 4.2 Dirty Check on Dialog Close

Current implementation (lines 467-481):
```typescript
const handleDialogOpenChange = React.useCallback(
  (newOpen: boolean) => {
    if (!newOpen && isEditingDetails && editForm.formState.isDirty) {
      const ok = confirm("Bạn có chắc muốn đóng?...")
      if (!ok) return
    }
    // ...
  },
  [isEditingDetails, editForm.formState.isDirty, onOpenChange]
)
```

**Concern:** With form in Details tab, how does Dialog shell access `formState.isDirty`?

**Options:**
1. **Lift dirty state to context** - Add `isDirty` to context, Details tab updates it
2. **Ref-based callback** - Dialog shell receives `checkCanClose` ref from Details tab
3. **Custom event** - Details tab dispatches event on dirty change

**Recommendation:** Use FormProvider - main dialog keeps form, accesses `formState.isDirty` directly.

### 4.3 Saved Values Pattern

The `savedValues` state (line 251) provides optimistic UI updates after save:
```typescript
const [savedValues, setSavedValues] = React.useState<Partial<EquipmentFormValues> | null>(null)
```

**Concern:** This pattern should remain co-located with the mutation.

**Recommendation:** Keep `savedValues` in the main dialog, pass merged `displayEquipment` as prop.

### 4.4 Query Key Consistency

Ensure query keys remain consistent after refactoring:
```typescript
// Current keys
["attachments", equipment?.id]
["history", equipment?.id]
```

These should be defined in a shared constants file to prevent drift:
```typescript
// equipment/constants.ts
export const QUERY_KEYS = {
  attachments: (id: number) => ["attachments", id] as const,
  history: (id: number) => ["history", id] as const,
}
```

### 4.5 Helper Function Location

Plan mentions `_utils/equipment-detail-helpers.ts` for:
- `normalizeDate`
- `isSuspiciousDate`
- `getHistoryIcon`

**Recommendation:** Consider splitting:
- `normalizeDate`, `isSuspiciousDate` -> `lib/date-utils.ts` (reusable)
- `getHistoryIcon` -> Stay in History tab (domain-specific)

---

## 5. Integration Impact

### Files That Import Current Dialog

From `equipment-dialogs.tsx`:
```typescript
import { EquipmentDetailDialog } from "@/components/equipment/equipment-detail-dialog"
```

**Migration Path:**
1. Create new components in `_components/`
2. Update `equipment-dialogs.tsx` to use new path
3. Delete old file

---

## 6. Final Recommendations

### Must-Do Before Execution

1. **Use FormProvider pattern** - Keep form in main dialog, share via provider
2. **Define query key constants** - Prevents key drift between files
3. **Add typecheck verification** - Build alone may miss type errors
4. **Document form reset pattern** - Prevent future bugs

### Nice-to-Have

1. **Split Details tab further** - Form vs View components
2. **Extract date utils to shared lib** - Reusability
3. **Add E2E test** - Playwright smoke test for dialog

---

## Conclusion

The refactoring plan is well-structured and follows established patterns. The main considerations are:

1. **FormProvider pattern** for form state sharing
2. **Saved values pattern** should stay in main dialog
3. **Phase 7** should be broken into sub-phases for safer migration

With these adjustments, the refactoring will result in a maintainable, well-organized component structure.

**Risk Level: Medium**
**Recommendation: Proceed with adjustments noted above**
