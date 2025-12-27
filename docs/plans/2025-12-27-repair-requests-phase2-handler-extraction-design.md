# Repair Requests Page Phase 2: Handler Extraction Design

**Date**: 2025-12-27
**Status**: Draft
**Author**: Claude Code
**Target**: `src/app/(app)/repair-requests/_components/RepairRequestsPageClient.tsx` (1,289 lines)

## Overview

Extract ~260 lines of CRUD handler logic into 3 focused hooks following CLAUDE.md conventions. This continues Phase 1's mechanical extraction pattern, targeting **convention compliance** over arbitrary line reduction.

**Goal**: Demonstrate that extracted code follows all CLAUDE.md rules (no `any` types, explicit types, proper imports, return types required), making future work easier.

**Approach**: Mechanical extraction - move handler code to new hooks, wire up dependencies, validate behavior unchanged.

---

## Current State

**After Phase 1**: `RepairRequestsPageClient.tsx` is 1,289 lines with:
- Dialog state extracted to `useRepairRequestDialogs`
- Columns extracted to `repair-requests-columns.tsx`
- Mobile view extracted to `MobileRequestList.tsx`
- Pagination extracted to `RepairRequestsPagination.tsx`
- Shortcuts extracted to `useRepairRequestShortcuts`

**Remaining pain points**:
- **Handlers inline** - 260 lines of CRUD logic (lines 490-745)
  - `handleSubmit` (create) - 67 lines
  - `handleUpdateRequest` - 35 lines
  - `handleDeleteRequest` - 17 lines
  - `handleApproveRequest` + `handleConfirmApproval` - 48 lines
  - `handleCompletion` + `handleConfirmCompletion` - 53 lines
  - `handleGenerateRequestSheet` - 25 lines

---

## Phase 2 Extraction Plan

### Approach: 3 Focused Hooks

Selected over single monolithic hook for clearer responsibilities and fewer dependencies per hook.

| Hook | Responsibility | Handlers | Lines | Dependencies |
|------|----------------|----------|-------|--------------|
| `useRepairRequestMutations` | Create, Update, Delete | `handleSubmit`, `handleUpdateRequest`, `handleDeleteRequest` | ~90 | 12 |
| `useRepairRequestWorkflows` | Approve, Complete | `handleApproveRequest`, `handleConfirmApproval`, `handleCompletion`, `handleConfirmCompletion` | ~100 | 10 |
| `useRepairRequestUIHandlers` | Sheet generation | `handleGenerateRequestSheet` | ~30 | 2 |

**Total**: ~220 lines extracted → `page.tsx` goes from 1,289 → ~1,090 lines

---

## Hook Interfaces

### 1. `useRepairRequestMutations`

**File**: `_hooks/useRepairRequestMutations.ts`

```typescript
import type { RepairRequestWithEquipment, RepairUnit } from "../../types"
import type { EquipmentSelectItem } from "../../types"
import type { AuthUser } from "./repair-requests-columns"

/** Form state for creating new repair requests */
interface MutationFormState {
  selectedEquipment: EquipmentSelectItem | null
  issueDescription: string
  repairItems: string
  desiredDate: Date | undefined
  repairUnit: RepairUnit
  externalCompanyName: string
}

/** Form state for editing existing repair requests */
interface MutationEditState {
  editingRequest: RepairRequestWithEquipment | null
  editIssueDescription: string
  editRepairItems: string
  editDesiredDate: Date | undefined
  editRepairUnit: RepairUnit
  editExternalCompanyName: string
}

/** External dependencies for mutations */
interface MutationDeps {
  user: AuthUser | null | undefined
  canSetRepairUnit: boolean
  invalidateCacheAndRefetch: () => void
  toast: ReturnType<typeof useToast>['toast']
}

/** Loading state setters for mutations */
interface MutationLoadingSetters {
  setIsSubmitting: (loading: boolean) => void
  setIsEditSubmitting: (loading: boolean) => void
  setIsDeleting: (loading: boolean) => void
}

/** Form state setters for create form */
interface MutationFormSetters {
  setSelectedEquipment: (eq: EquipmentSelectItem | null) => void
  setSearchQuery: (q: string) => void
  setIssueDescription: (v: string) => void
  setRepairItems: (v: string) => void
  setDesiredDate: (d: Date | undefined) => void
  setRepairUnit: (u: RepairUnit) => void
  setExternalCompanyName: (v: string) => void
}

/** Dialog state setters for edit/delete */
interface MutationDialogSetters {
  setEditingRequest: (req: RepairRequestWithEquipment | null) => void
  setRequestToDelete: (req: RepairRequestWithEquipment | null) => void
}

/** Returned mutation handlers */
export interface MutationActions {
  /** Create a new repair request */
  handleSubmit: (e: React.FormEvent) => Promise<void>
  /** Update an existing repair request */
  handleUpdateRequest: () => Promise<void>
  /** Delete a repair request */
  handleDeleteRequest: () => Promise<void>
}

/**
 * Hook for repair request CRUD mutations (Create, Update, Delete)
 *
 * @param formState - Current create form state
 * @param editState - Current edit form state
 * @param deps - External dependencies (user, toast, cache invalidator)
 * @param loadingSetters - Loading state setters for each mutation
 * @param formSetters - Create form state setters
 * @param dialogSetters - Dialog state setters for edit/delete
 * @returns Mutation handlers
 */
export function useRepairRequestMutations(
  formState: MutationFormState,
  editState: MutationEditState,
  deps: MutationDeps,
  loadingSetters: MutationLoadingSetters,
  formSetters: MutationFormSetters,
  dialogSetters: MutationDialogSetters
): MutationActions
```

**What it contains**:
- `handleSubmit` - Validates form, calls `repair_request_create` RPC, resets form
- `handleUpdateRequest` - Validates edit form, calls `repair_request_update` RPC
- `handleDeleteRequest` - Calls `repair_request_delete` RPC

**Lines extracted from main**: ~90 (lines 490-557, 664-718)

---

### 2. `useRepairRequestWorkflows`

**File**: `_hooks/useRepairRequestWorkflows.ts`

```typescript
import type { RepairRequestWithEquipment, RepairUnit } from "../../types"
import type { AuthUser } from "./repair-requests-columns"

/** Workflow dialog state for approval */
interface WorkflowApprovalState {
  requestToApprove: RepairRequestWithEquipment | null
  approvalRepairUnit: RepairUnit
  approvalExternalCompanyName: string
}

/** Workflow dialog state for completion */
interface WorkflowCompletionState {
  requestToComplete: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  completionResult: string
  nonCompletionReason: string
}

/** External dependencies for workflows */
interface WorkflowDeps {
  user: AuthUser | null | undefined
  invalidateCacheAndRefetch: () => void
  toast: ReturnType<typeof useToast>['toast']
}

/** Loading state setters for workflows */
interface WorkflowLoadingSetters {
  setIsApproving: (loading: boolean) => void
  setIsCompleting: (loading: boolean) => void
}

/** Dialog state setters for approval workflow */
interface WorkflowApprovalSetters {
  setRequestToApprove: (req: RepairRequestWithEquipment | null) => void
  setApprovalRepairUnit: (u: RepairUnit) => void
  setApprovalExternalCompanyName: (v: string) => void
}

/** Dialog state setters for completion workflow */
interface WorkflowCompletionSetters {
  setRequestToComplete: (req: RepairRequestWithEquipment | null) => void
  setCompletionType: (t: 'Hoàn thành' | 'Không HT' | null) => void
  setCompletionResult: (v: string) => void
  setNonCompletionReason: (v: string) => void
}

/** Returned workflow handlers */
export interface WorkflowActions {
  /** Open approval dialog and reset form */
  handleApproveRequest: (request: RepairRequestWithEquipment) => void
  /** Confirm and execute approval */
  handleConfirmApproval: () => Promise<void>
  /** Open completion dialog and reset form */
  handleCompletion: (request: RepairRequestWithEquipment, type: 'Hoàn thành' | 'Không HT') => void
  /** Confirm and execute completion */
  handleConfirmCompletion: () => Promise<void>
}

/**
 * Hook for repair request workflow actions (Approve, Complete)
 *
 * @param approvalState - Current approval dialog state
 * @param completionState - Current completion dialog state
 * @param deps - External dependencies (user, toast, cache invalidator)
 * @param loadingSetters - Loading state setters
 * @param approvalSetters - Approval dialog state setters
 * @param completionSetters - Completion dialog state setters
 * @returns Workflow handlers
 */
export function useRepairRequestWorkflows(
  approvalState: WorkflowApprovalState,
  completionState: WorkflowCompletionState,
  deps: WorkflowDeps,
  loadingSetters: WorkflowLoadingSetters,
  approvalSetters: WorkflowApprovalSetters,
  completionSetters: WorkflowCompletionSetters
): WorkflowActions
```

**What it contains**:
- `handleApproveRequest` - Opens approval dialog, resets form
- `handleConfirmApproval` - Validates, calls `repair_request_approve` RPC
- `handleCompletion` - Opens completion dialog, sets type
- `handleConfirmCompletion` - Validates based on type, calls `repair_request_complete` RPC

**Lines extracted from main**: ~100 (lines 559-662)

---

### 3. `useRepairRequestUIHandlers`

**File**: `_hooks/useRepairRequestUIHandlers.ts`

```typescript
import type { RepairRequestWithEquipment } from "../../types"

/** External dependencies for UI handlers */
interface UIHandlersDeps {
  branding: { name?: string; logo_url?: string } | null | undefined
  toast: ReturnType<typeof useToast>['toast']
}

/** Returned UI handlers */
export interface UIHandlersActions {
  /** Generate and open repair request sheet in new window */
  handleGenerateRequestSheet: (request: RepairRequestWithEquipment) => void
}

/**
 * Hook for repair request UI handlers (sheet generation, etc.)
 *
 * @param deps - External dependencies (branding, toast)
 * @returns UI handlers
 */
export function useRepairRequestUIHandlers(
  deps: UIHandlersDeps
): UIHandlersActions
```

**What it contains**:
- `handleGenerateRequestSheet` - Builds HTML, opens in new window

**Lines extracted from main**: ~30 (lines 720-745)

---

## File Structure After Extraction

```
src/app/(app)/repair-requests/
├── _components/
│   ├── RepairRequestsPageClient.tsx        # ~1,090 lines (-199 from 1,289)
│   ├── ApproveRequestDialog.tsx            # (existing)
│   ├── CompleteRequestDialog.tsx           # (existing)
│   ├── CreateRequestSheet.tsx              # (existing)
│   ├── DeleteRequestDialog.tsx             # (existing)
│   ├── EditRequestDialog.tsx               # (existing)
│   ├── FilterChips.tsx                     # (existing)
│   ├── FilterModal.tsx                     # (existing)
│   ├── RequestDetailContent.tsx            # (existing)
│   ├── repair-requests-columns.tsx         # (existing - Phase 1)
│   ├── MobileRequestList.tsx               # (existing - Phase 1)
│   └── RepairRequestsPagination.tsx        # (existing - Phase 1)
└── _hooks/
    ├── useRepairRequestDialogs.ts          # (existing - Phase 1)
    ├── useRepairRequestShortcuts.ts        # (existing - Phase 1)
    ├── useRepairRequestMutations.ts        # (NEW - ~90 lines)
    ├── useRepairRequestWorkflows.ts        # (NEW - ~100 lines)
    └── useRepairRequestUIHandlers.ts       # (NEW - ~30 lines)
```

---

## Parent Component Usage

```typescript
// In RepairRequestsPageClient.tsx

// Import new hooks
import { useRepairRequestMutations } from '../_hooks/useRepairRequestMutations'
import { useRepairRequestWorkflows } from '../_hooks/useRepairRequestWorkflows'
import { useRepairRequestUIHandlers } from '../_hooks/useRepairRequestUIHandlers'

// Dialog state (existing from Phase 1)
const dialogs = useRepairRequestDialogs()

// UI Handlers (simplest - extract first)
const { handleGenerateRequestSheet } = useRepairRequestUIHandlers({
  branding: branding?.data,
  toast,
})

// Mutations (create, update, delete)
const { handleSubmit, handleUpdateRequest, handleDeleteRequest } = useRepairRequestMutations(
  {
    selectedEquipment,
    issueDescription,
    repairItems,
    desiredDate,
    repairUnit,
    externalCompanyName,
  },
  {
    editingRequest,
    editIssueDescription,
    editRepairItems,
    editDesiredDate,
    editRepairUnit,
    editExternalCompanyName,
  },
  {
    user,
    canSetRepairUnit,
    invalidateCacheAndRefetch,
    toast,
  },
  {
    setIsSubmitting,
    setIsEditSubmitting,
    setIsDeleting,
  },
  {
    setSelectedEquipment,
    setSearchQuery,
    setIssueDescription,
    setRepairItems,
    setDesiredDate,
    setRepairUnit,
    setExternalCompanyName,
  },
  {
    setEditingRequest,
    setRequestToDelete,
  }
)

// Workflows (approve, complete)
const {
  handleApproveRequest,
  handleConfirmApproval,
  handleCompletion,
  handleConfirmCompletion,
} = useRepairRequestWorkflows(
  {
    requestToApprove,
    approvalRepairUnit,
    approvalExternalCompanyName,
  },
  {
    requestToComplete,
    completionType,
    completionResult,
    nonCompletionReason,
  },
  {
    user,
    invalidateCacheAndRefetch,
    toast,
  },
  {
    setIsApproving,
    setIsCompleting,
  },
  {
    setRequestToApprove,
    setApprovalRepairUnit,
    setApprovalExternalCompanyName,
  },
  {
    setRequestToComplete,
    setCompletionType,
    setCompletionResult,
    setNonCompletionReason,
  }
)
```

---

## Error Handling Strategy

All hooks follow the **existing error handling pattern** from the parent component:

```typescript
// 1. Validation before RPC
if (!requiredField) {
  toast({
    variant: "destructive",
    title: "Thiếu thông tin",
    description: "Vui lòng điền đầy đủ các trường bắt buộc.",
  })
  return
}

// 2. Set loading state
setIsSubmitting(true)

try {
  // 3. RPC call
  await callRpc({ fn: '...', args: { ... } })

  // 4. Success toast
  toast({ title: "Thành công", description: "..." })

  // 5. Reset form/dialog state
  setEditingRequest(null)
  setSelectedEquipment(null)
  // ... other resets

  // 6. Invalidate cache to trigger refetch
  invalidateCacheAndRefetch()
} catch (error: any) {
  // 7. Error toast
  toast({
    variant: "destructive",
    title: "Lỗi ...",
    description: error?.message || '...',
  })
  setIsSubmitting(false)
  return // Early exit
}

// 8. Reset loading state on success
setIsSubmitting(false)
```

**Key principles**:
1. Validate before RPC (show toast if invalid)
2. Set loading state before RPC call
3. Success: Toast → Reset state → Invalidate cache → Reset loading
4. Error: Toast → Reset loading → Early return (no state changes)

**Hooks receive `toast` from parent** - no internal toast dependency.

---

## CLAUDE.md Compliance

This refactoring **demonstrates adherence** to CLAUDE.md conventions:

| Rule | Implementation |
|------|----------------|
| **NEVER `any`** | All hook parameters and returns use explicit types; `AuthUser` type imported from columns file |
| **Explicit types for public interfaces** | All interfaces exported and documented with JSDoc |
| **Return types required** | All functions have explicit `Promise<void>` or void return types |
| **Imports: `@/*` alias** | All imports use `@/` alias; correct order (React → 3rd-party → `@/components` → `@/lib` → `@/types`) |
| **No relative imports beyond `./`** | Parent imports from `../_hooks/...` |

**Future work on these hooks must maintain these standards.**

---

## Testing Strategy

### Validation After Each Extraction

**After creating each hook file:**
```bash
npm run typecheck  # Must PASS
```

**After integrating into parent:**
```bash
npm run typecheck  # Must PASS
npm run build      # Must SUCCESS
```

**Manual smoke test:**
1. Start dev server: `npm run dev`
2. Navigate to `/repair-requests`
3. Test extracted functionality (see checklists below)

---

### Manual Testing Checklist

**After `useRepairRequestUIHandlers`:**
- [ ] Sheet generation opens new window
- [ ] Organization name displays correctly
- [ ] Logo displays correctly
- [ ] All request fields populate

**After `useRepairRequestMutations`:**
- [ ] Create request with all fields
- [ ] Create request with external repair unit
- [ ] Validation shows toast for missing fields
- [ ] Edit request updates correctly
- [ ] Delete request removes from list
- [ ] Cache invalidation refreshes list immediately

**After `useRepairRequestWorkflows`:**
- [ ] Approval dialog opens with correct data
- [ ] Approve with internal unit works
- [ ] Approve with external unit validates company name
- [ ] Completion dialog opens
- [ ] Complete with result works
- [ ] Not complete with reason works
- [ ] Both workflows invalidate cache

**Final integration testing:**
- [ ] Complete create → edit → approve → complete workflow
- [ ] All toast notifications display correctly
- [ ] Loading states show during operations
- [ ] Error states handle gracefully
- [ ] Refresh page → Changes persist
- [ ] Status counts update immediately after operations

---

## Implementation Sequence

### Extraction Order (Lowest Risk → Highest Risk)

| Phase | Hook | Risk | Reason |
|-------|------|------|--------|
| 2A | `useRepairRequestUIHandlers` | Very Low | Simplest, only `branding` and `toast` deps |
| 2B | `useRepairRequestMutations` | Medium | 3 handlers, more dependencies |
| 2C | `useRepairRequestWorkflows` | Medium | 4 handlers, dialog state coupling |

### Implementation Steps (Per Hook)

For each hook, repeat this cycle:

1. Create file with imports and interfaces
2. Extract handler code from `page.tsx`
3. Add import to `page.tsx`
4. Remove extracted code from `page.tsx`
5. Update parent to use hook
6. Run typecheck → `npm run typecheck`
7. Manual smoke test → Dev server, check functionality
8. Git commit → Small, focused commit message

---

### Expected Line Count Reduction

| Phase | Hook | Lines Extracted | page.tsx After |
|-------|------|-----------------|----------------|
| Start | — | — | 1,289 |
| 2A | `useRepairRequestUIHandlers` | -30 | 1,259 |
| 2B | `useRepairRequestMutations` | -90 | 1,169 |
| 2C | `useRepairRequestWorkflows` | -100 | 1,069 |

**Final result**: `page.tsx` reduced from **1,289 → ~1,069 lines (-17%)**

---

## Rollback Strategy

**If something goes wrong:**
```bash
# After each commit, we can rollback
git revert HEAD          # Undo last commit
git revert HEAD~2        # Undo last 3 commits

# Or reset to known-good state
git reset --hard <commit-hash>
```

**Since we commit after each hook:**
- Maximum loss: 1 hook (~100 lines)
- Can't break everything at once
- Always have working state to return to

---

## Related Work

- **Phase 1**: Mechanical extraction of dialogs, columns, mobile view, pagination, shortcuts (2025-12-27-repair-requests-phase1-mechanical-extraction-design.md)
- **Maintenance page refactor**: Similar extraction pattern (maintenance page)

---

## Summary

**What we're building:**
- 3 focused hooks extracted from handler logic in `RepairRequestsPageClient.tsx`
- Mechanical extraction following Phase 1 patterns
- Zero logic changes - pure refactoring for CLAUDE.md compliance

**Expected outcome:**
- `page.tsx`: 1,289 → ~1,069 lines (-17%)
- Handler code organized by responsibility (CRUD vs Workflow vs UI)
- All extracted code follows CLAUDE.md conventions
- Foundation for future maintenance

**Implementation timeline:**
- Phase 2A: `useRepairRequestUIHandlers` - ~15-20 minutes
- Phase 2B: `useRepairRequestMutations` - ~30-45 minutes
- Phase 2C: `useRepairRequestWorkflows` - ~30-45 minutes
- Testing and validation: ~30 minutes

**Total estimate**: ~2 hours of focused work
