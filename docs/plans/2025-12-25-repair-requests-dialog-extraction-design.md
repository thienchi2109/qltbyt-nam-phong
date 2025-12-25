# Repair Requests Dialog Extraction Design

**Date**: 2025-12-25
**Status**: Approved
**Author**: Claude Code

## Overview

Extract dialogs and detail UI from `RepairRequestsPageClient.tsx` (~2600 lines) into dedicated `_components/*` files to improve maintainability and reduce file size.

## Goals

- Reduce `RepairRequestsPageClient.tsx` from ~2600 to ~1830 lines (~30% reduction)
- Eliminate ~160 lines of duplicated detail panel code (mobile Dialog vs desktop Sheet)
- Create focused, testable components
- Preserve all existing behavior (pure refactoring)

## Approach

**Pattern**: Controlled components - parent manages state, children receive via props.

**Decision rationale**: Keeps parent in control, makes refactoring mechanical (move JSX, add props), easier to reason about data flow.

## Components to Create

### 1. RequestDetailContent.tsx (~180 lines)

Shared content for both mobile Dialog and desktop Sheet.

```typescript
interface RequestDetailContentProps {
  request: RepairRequestWithEquipment
}
```

**Renders**:
- Equipment Information (name, code, model, serial, department)
- Request Information (status, dates, requester, description, repair items)
- Execution Information (repair unit, external company)
- Approval Information (approver, date)
- Completion Information (confirmer, date, result/reason)

**Usage in parent**:
```tsx
// Mobile
<Dialog><ScrollArea><RequestDetailContent request={requestToView} /></ScrollArea></Dialog>

// Desktop
<Sheet><ScrollArea><RequestDetailContent request={requestToView} /></ScrollArea></Sheet>
```

### 2. EditRequestDialog.tsx (~100 lines)

Dialog for editing pending repair requests.

```typescript
interface EditRequestDialogProps {
  request: RepairRequestWithEquipment | null
  onClose: () => void
  // Form state
  issueDescription: string
  setIssueDescription: (v: string) => void
  repairItems: string
  setRepairItems: (v: string) => void
  desiredDate: Date | undefined
  setDesiredDate: (v: Date | undefined) => void
  repairUnit: RepairUnit
  setRepairUnit: (v: RepairUnit) => void
  externalCompanyName: string
  setExternalCompanyName: (v: string) => void
  // Submission
  isSubmitting: boolean
  onSubmit: () => void
  canSetRepairUnit: boolean
}
```

### 3. DeleteRequestDialog.tsx (~25 lines)

AlertDialog for confirming deletion.

```typescript
interface DeleteRequestDialogProps {
  request: RepairRequestWithEquipment | null
  onClose: () => void
  isDeleting: boolean
  onConfirm: () => void
}
```

### 4. ApproveRequestDialog.tsx (~70 lines)

Dialog for approving requests with repair unit selection.

```typescript
interface ApproveRequestDialogProps {
  request: RepairRequestWithEquipment | null
  onClose: () => void
  repairUnit: RepairUnit
  setRepairUnit: (v: RepairUnit) => void
  externalCompanyName: string
  setExternalCompanyName: (v: string) => void
  isApproving: boolean
  onConfirm: () => void
}
```

### 5. CompleteRequestDialog.tsx (~75 lines)

Dialog for marking requests as complete or incomplete.

```typescript
interface CompleteRequestDialogProps {
  request: RepairRequestWithEquipment | null
  completionType: 'Hoàn thành' | 'Không HT' | null
  onClose: () => void
  completionResult: string
  setCompletionResult: (v: string) => void
  nonCompletionReason: string
  setNonCompletionReason: (v: string) => void
  isCompleting: boolean
  onConfirm: () => void
}
```

### 6. CreateRequestSheet.tsx (~160 lines)

Sheet for creating new repair requests with equipment search.

```typescript
interface CreateRequestSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Equipment search
  allEquipment: EquipmentSelectItem[]
  selectedEquipment: EquipmentSelectItem | null
  searchQuery: string
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSelectEquipment: (eq: EquipmentSelectItem) => void
  filteredEquipment: EquipmentSelectItem[]
  shouldShowNoResults: boolean
  // Form fields
  issueDescription: string
  setIssueDescription: (v: string) => void
  repairItems: string
  setRepairItems: (v: string) => void
  desiredDate: Date | undefined
  setDesiredDate: (v: Date | undefined) => void
  repairUnit: RepairUnit
  setRepairUnit: (v: RepairUnit) => void
  externalCompanyName: string
  setExternalCompanyName: (v: string) => void
  // Submit
  isSubmitting: boolean
  onSubmit: (e: React.FormEvent) => void
  canSetRepairUnit: boolean
  isSheetMobile: boolean
}
```

## File Structure After Refactoring

```
src/app/(app)/repair-requests/
├── page.tsx                    (wrapper, re-exports types)
├── types.ts                    (RepairRequestWithEquipment, etc.)
├── utils.ts                    (calculateDaysRemaining, getStatusVariant)
├── request-sheet.ts            (buildRepairRequestSheetHtml)
└── _components/
    ├── RepairRequestsPageClient.tsx  (~1830 lines, down from ~2600)
    ├── RequestDetailContent.tsx      (~180 lines) NEW
    ├── EditRequestDialog.tsx         (~100 lines) NEW
    ├── DeleteRequestDialog.tsx       (~25 lines) NEW
    ├── ApproveRequestDialog.tsx      (~70 lines) NEW
    ├── CompleteRequestDialog.tsx     (~75 lines) NEW
    ├── CreateRequestSheet.tsx        (~160 lines) NEW
    ├── FilterChips.tsx               (existing)
    └── FilterModal.tsx               (existing)
```

## Line Count Summary

| Component | Lines |
|-----------|-------|
| RequestDetailContent | ~180 |
| EditRequestDialog | ~100 |
| DeleteRequestDialog | ~25 |
| ApproveRequestDialog | ~70 |
| CompleteRequestDialog | ~75 |
| CreateRequestSheet | ~160 |
| **Total extracted** | **~610** |
| **Deduplication savings** | **~160** |
| **Net reduction** | **~770** |

## Implementation Notes

1. **Import paths**: New components import from `../types` and `../utils`
2. **State stays in parent**: All useState hooks remain in RepairRequestsPageClient
3. **Handlers stay in parent**: `handleUpdateRequest`, `handleDeleteRequest`, etc. remain in parent
4. **No logic changes**: Pure JSX extraction with prop passing

## Validation Criteria

- [ ] `npm run typecheck` passes
- [ ] All dialogs open/close correctly
- [ ] Edit, delete, approve, complete workflows function identically
- [ ] Create request workflow functions identically
- [ ] Mobile and desktop detail views render correctly
- [ ] No console errors

## Risks

- **Prop drilling**: Many props passed to CreateRequestSheet (17 props). Acceptable for controlled pattern.
- **File navigation**: 6 new files. Mitigated by clear naming and focused responsibilities.

## Alternatives Considered

1. **Grouped dialogs**: Single `RepairRequestDialogs.tsx` containing all 4 action dialogs. Rejected: less granular, harder to test individually.

2. **Minimal extraction**: Only extract detail panel. Rejected: misses opportunity to reduce main file significantly.

3. **Uncontrolled components**: Children manage own state. Rejected: larger change, parent loses visibility into state.
