# Refactor equipment-detail-dialog.tsx

**Date:** 2026-01-23
**Status:** Approved

## Goal
Improve maintainability by extracting tabs using FormProvider pattern (no new context).

## Current State
- **File:** `src/components/equipment/equipment-detail-dialog.tsx` (1,216 lines)
- **Structure:** 4 tabs (details, files, history, usage), 8 state vars, 2 queries, 3 mutations

## Target Structure (FormProvider Pattern)

```
src/app/(app)/equipment/_components/EquipmentDetailDialog/
├── index.tsx                         # Main dialog + FormProvider (~300 lines)
├── EquipmentDetailTypes.ts           # Types, schema, helpers (~100 lines)
├── EquipmentDetailDetailsTab.tsx     # View/Edit details (~350 lines)
├── EquipmentDetailFilesTab.tsx       # Attachments (~150 lines)
├── EquipmentDetailHistoryTab.tsx     # Timeline (~100 lines)
├── EquipmentDetailUsageTab.tsx       # Wrapper (~30 lines)
└── hooks/
    ├── useEquipmentAttachments.ts    # Attachments query + mutations
    ├── useEquipmentHistory.ts        # History query
    └── useEquipmentUpdate.ts         # Update mutation

src/app/(app)/equipment/types.ts      # ADD: Attachment, HistoryItem types
```

**Key design decisions:**
- NO new context - use React Hook Form's `FormProvider` for form sharing
- Props for non-form state (tab, permissions, callbacks)
- Subdirectory structure for cleaner organization
- Custom hooks for data fetching/mutations

## Implementation Phases

### Phase 1: Extract Types and Helpers
1. Add types to `equipment/types.ts`:
   - `Attachment`, `HistoryItem`, `EquipmentFormValues`
   - `equipmentDetailQueryKeys` constant
2. Create `EquipmentDetailDialog/EquipmentDetailTypes.ts`:
   - Move `equipmentFormSchema` (Zod)
   - Move `normalizeDate`, `isSuspiciousDate`, `getHistoryIcon`
3. Update imports in original file
4. **Verify:** `npm run typecheck && npm run build`

### Phase 2: Extract Custom Hooks
1. Create `hooks/useEquipmentHistory.ts` - history query
2. Create `hooks/useEquipmentAttachments.ts` - attachments query + add/delete mutations
3. Create `hooks/useEquipmentUpdate.ts` - update mutation
4. Replace inline queries/mutations in original file
5. **Verify:** All data still loads, mutations work

### Phase 3: Create Subdirectory Structure
1. Create `EquipmentDetailDialog/` subdirectory
2. Move types file into subdirectory
3. Move hooks into `hooks/` subdirectory
4. **Verify:** Imports resolve correctly

### Phase 4: Extract History Tab (Simplest)
1. Create `EquipmentDetailHistoryTab.tsx`
2. Props: `{ history, isLoading }`
3. Move history rendering + icon helper
4. **Verify:** History displays correctly

### Phase 5: Extract Usage Tab
1. Create `EquipmentDetailUsageTab.tsx`
2. Props: `{ equipment }`
3. Simple wrapper for existing `UsageHistoryTab`
4. **Verify:** Usage tab works

### Phase 6: Extract Files Tab
1. Create `EquipmentDetailFilesTab.tsx`
2. Props: `{ equipmentId, attachments, isLoading, onMutationSuccess }`
3. Uses `useEquipmentAttachments` hook internally for mutations
4. Local state: `newFileName`, `newFileUrl`, `deletingAttachmentId`
5. **Verify:** Add/delete attachments work

### Phase 7: Extract Details Tab (Most Complex)
Split into sub-phases:

**7a: View Mode**
1. Create `EquipmentDetailDetailsTab.tsx`
2. Props: `{ isEditing, displayEquipment, canEdit, onStartEdit }`
3. Move read-only field display
4. **Verify:** View mode displays correctly

**7b: Edit Form**
1. Add `useFormContext<EquipmentFormValues>()` for form access
2. Move form fields with Controller components
3. **Verify:** Form fields render, validation works

**7c: Wire Mutations**
1. Add `onSave`, `onCancel` props
2. Use `useEquipmentUpdate` hook
3. Handle savedValues optimistic update pattern
4. **Verify:** Edit → Save works, dirty check on close works

### Phase 8: Create Main Dialog Shell
1. Create `EquipmentDetailDialog/index.tsx`
2. Contains:
   - `useForm()` with schema
   - `FormProvider` wrapper
   - Tab state, edit mode state, savedValues state
   - Form dirty check on close
   - Footer actions (Edit, Print, Label, Close)
3. Imports and renders all tab components
4. **Verify:** Full dialog works

### Phase 9: Final Migration
1. Find all imports of old file: `grep -r "equipment-detail-dialog" src/`
2. Update imports to new location
3. Delete old file from `src/components/equipment/`
4. **Verify:** `npm run build` passes, no broken imports

## Props Interface

```typescript
// Main dialog receives from EquipmentDialogContext
interface EquipmentDetailDialogProps {
  equipment: Equipment | null
  isOpen: boolean
  onClose: () => void
  onEquipmentUpdated: () => void
}

// Details tab
interface EquipmentDetailDetailsTabProps {
  displayEquipment: Equipment
  isEditing: boolean
  canEdit: boolean
  isRegionalLeader: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveSuccess: (values: Partial<EquipmentFormValues>) => void
}

// Files tab
interface EquipmentDetailFilesTabProps {
  equipmentId: number
  onMutationSuccess: () => void
}

// History tab
interface EquipmentDetailHistoryTabProps {
  history: HistoryItem[]
  isLoading: boolean
}
```

## Critical Files

| File | Action |
|------|--------|
| `src/components/equipment/equipment-detail-dialog.tsx` | Source (DELETE after) |
| `src/app/(app)/equipment/equipment-dialogs.tsx` | Update import |
| `src/app/(app)/equipment/types.ts` | Add shared types |

## Verification Checklist

After each phase:
```bash
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run build
```

Final verification:
- [ ] Open equipment list → click row → detail dialog opens
- [ ] Navigate all 4 tabs (details, files, history, usage)
- [ ] View mode shows all equipment fields correctly
- [ ] Click Edit → form fields appear with current values
- [ ] Modify field → Save → values update immediately (optimistic)
- [ ] Modify field → Close without save → dirty check dialog appears
- [ ] Add attachment → appears in list
- [ ] Delete attachment → removed from list
- [ ] History timeline shows correct icons and data
- [ ] Usage tab loads usage history
- [ ] Print Profile Sheet button works
- [ ] Print Device Label button works

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Form state breaks during extraction | Keep form in main dialog, use FormProvider |
| savedValues pattern breaks | Keep in main dialog, pass via onSaveSuccess callback |
| Dirty check stops working | Test after Phase 7c specifically |
| Query cache inconsistency | Define `equipmentDetailQueryKeys` constant |

---

# Review Notes

## Architect Review Summary

**Verdict: APPROVED with minor recommendations**

Key concerns addressed:
1. **Form dirty check** - Keep in main dialog, dirty state accessible via FormProvider
2. **Phase 6 sub-phases** - Split into view, form, mutations for safer migration
3. **Query key constants** - Define `equipmentDetailQueryKeys` to prevent drift

## Code Review Summary

**Key recommendations incorporated:**
1. **NO new context** - Use FormProvider instead of EquipmentDetailContext
2. **FormProvider pattern** - Child components use `useFormContext()`
3. **Subdirectory structure** - `EquipmentDetailDialog/` folder with index.tsx
4. **Custom hooks** - Extract queries/mutations for reusability
5. **Type safety** - Clean up `as any` casts during refactor

## Risk Assessment

| Aspect | Rating |
|--------|--------|
| Overall Risk | Medium |
| Highest Risk Phase | Phase 7 (Details Tab) |
| Recommendation | Proceed with sub-phases for Phase 7 |
