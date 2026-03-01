# Code Review: Equipment Detail Dialog Refactoring Plan

**Date:** 2026-01-23
**Reviewer:** Code Review Agent

---

## Summary

**File Under Review:** `src/components/equipment/equipment-detail-dialog.tsx` (1,216 lines)
**Target Location:** `src/app/(app)/equipment/_components/`
**Proposed Split:** 7 files

---

## 1. Hidden Dependencies Analysis

### 1.1 Direct Dependencies (Must Be Preserved)

| Dependency | Current Usage | Risk Level |
|------------|---------------|------------|
| `@/components/usage-history-tab` | UsageHistoryTab component | LOW - Clean import |
| `@/components/equipment/equipment-table-columns` | `columnLabels`, `equipmentStatusOptions`, `getStatusVariant`, `getClassificationVariant` | MEDIUM - Multiple exports used |
| `@/types/database` | `Equipment` type | LOW - Standard type import |
| `@/lib/rpc-client` | `callRpc` function | LOW - Standard RPC |
| TanStack Query | `useQuery`, `useMutation`, `useQueryClient` | HIGH - Cache coordination required |

### 1.2 Internal State Coupling (Critical)

The component has **tightly coupled internal state** that must be carefully managed during extraction:

```typescript
// These states are interdependent
const [isEditingDetails, setIsEditingDetails] = React.useState(false)
const [savedValues, setSavedValues] = React.useState<Partial<EquipmentFormValues> | null>(null)
const prevEquipmentIdRef = React.useRef<number | null>(null)
```

**Risk:** The `savedValues` pattern is used to display optimistic updates after save while the parent's `equipment` prop remains stale. This pattern requires careful preservation during extraction.

### 1.3 Form State Dependencies

The `editForm` (react-hook-form) is used in multiple places:
- Form fields in edit mode (lines 528-858)
- Form submission handler `onSubmitInlineEdit`
- Form dirty check in `handleDialogOpenChange` (line 473)
- Form reset in useEffect (lines 299-335)

**Recommendation:** Keep form state in the main dialog component and use FormProvider for child access.

### 1.4 Query Key Consistency

Current query keys used:
```typescript
queryKey: ["attachments", equipment?.id]  // Line 339
queryKey: ["history", equipment?.id]       // Line 353
```

These are **different from the main equipment list query keys**:
```typescript
queryKey: ["equipment_list_enhanced", { tenant: effectiveTenantKey, ... }]
```

**Risk:** LOW - These are independent queries for detail data, not part of the main list cache.

**Important:** The `onEquipmentUpdated` callback triggers parent cache invalidation through `onDataMutationSuccess()` in EquipmentDialogContext, which correctly invalidates:
- `equipment_list_enhanced` queries
- `active_usage_logs`
- `dashboard-stats`

---

## 2. Phased Approach Assessment

### 2.1 Proposed Order: Types -> Context -> Tabs

| Phase | Content | Assessment |
|-------|---------|------------|
| 1. Types | `EquipmentDetailTypes.ts` | **GOOD** - Clean extraction, no dependencies |
| 2. Context | `EquipmentDetailContext.tsx` | **CAUTION** - Needs careful design |
| 3. Tabs | Individual tab components | **GOOD** - Natural boundaries exist |

### 2.2 Recommended Modified Approach

**Phase 1: Types & Utilities (Safe)**
```
EquipmentDetailTypes.ts
├── Attachment type
├── HistoryItem type
├── EquipmentFormSchema (move from inline)
├── EquipmentFormValues type
├── UserSession interface
├── normalizeDate helper
├── isSuspiciousDate helper
├── SUSPICIOUS_DATE_WARNING constant
└── getHistoryIcon helper function
```

**Phase 2: Context (Careful Design Required)**

The existing `EquipmentDialogContext` already handles dialog open/close state. The detail dialog should NOT create a new context for its internal state. Instead:

```typescript
// RECOMMENDED: Keep internal state local to EquipmentDetailDialog
// Use FormProvider for form sharing
// AVOID: Creating EquipmentDetailContext for form/tab state
```

**Why?**
1. Form state is ephemeral (resets when dialog closes)
2. Creating another context adds unnecessary complexity
3. The existing EquipmentDialogContext pattern shows dialogs should manage their own form state

**Phase 3: Tab Components (Clear Boundaries)**
```
EquipmentDetailDetailsTab.tsx   // ~400 lines (largest, includes edit form)
EquipmentDetailFilesTab.tsx     // ~120 lines
EquipmentDetailHistoryTab.tsx   // ~90 lines
EquipmentDetailUsageTab.tsx     // ~10 lines (just wraps UsageHistoryTab)
```

---

## 3. React/TypeScript Patterns to Consider

### 3.1 Form State Management Pattern

**Current Pattern (Problematic for Split):**
```typescript
// Form defined in main component
const editForm = useForm<EquipmentFormValues>({...})

// Used across multiple child sections
<FormField control={editForm.control} name="ma_thiet_bi" ... />
```

**Recommended Pattern for Extracted Components:**

Use FormProvider pattern (Better encapsulation):
```typescript
<FormProvider {...editForm}>
  <EquipmentDetailDetailsTab
    isEditing={isEditingDetails}
    // Child uses useFormContext()
  />
</FormProvider>
```

**Recommendation:** Use FormProvider for cleaner extraction.

### 3.2 Memoization Strategy

The existing codebase uses `React.memo` extensively. Extracted tabs should follow this pattern:

```typescript
export const EquipmentDetailHistoryTab = React.memo(function EquipmentDetailHistoryTab({
  equipmentId,
  isOpen,
}: EquipmentDetailHistoryTabProps) {
  // Query only when tab is active
  const historyQuery = useQuery({
    queryKey: ["history", equipmentId],
    enabled: isOpen,
    ...
  })
})
```

### 3.3 Query Hooks Extraction

Consider extracting queries into custom hooks for reusability:

```typescript
// _hooks/useEquipmentAttachments.ts
export function useEquipmentAttachments(equipmentId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["attachments", equipmentId],
    queryFn: async () => { ... },
    enabled: !!equipmentId && enabled,
    staleTime: 300_000,
  })
}
```

### 3.4 Strict Type Safety

The current code has several type assertions that should be cleaned up:

```typescript
// Current (unsafe)
tinh_trang_hien_tai: equipment.tinh_trang_hien_tai || ("" as any),
ngay_bt_tiep_theo: (equipment as any).ngay_bt_tiep_theo || null,

// Better: Extend Equipment type or use proper intersection types
type EquipmentWithSchedule = Equipment & {
  ngay_bt_tiep_theo?: string | null
  ngay_hc_tiep_theo?: string | null
  ngay_kd_tiep_theo?: string | null
  chu_ky_bt_dinh_ky?: number | null
  chu_ky_hc_dinh_ky?: number | null
  chu_ky_kd_dinh_ky?: number | null
}
```

---

## 4. Query Key Consistency & Cache Invalidation

### 4.1 Current Query Keys

| Query | Key Pattern | Invalidation Point |
|-------|-------------|-------------------|
| Attachments | `["attachments", equipmentId]` | `addAttachmentMutation.onSuccess`, `deleteAttachmentMutation.onSuccess` |
| History | `["history", equipmentId]` | Never invalidated (read-only) |
| Equipment List | `["equipment_list_enhanced", {tenant, ...}]` | `onEquipmentUpdated()` via context |

### 4.2 Cache Invalidation Flow

```
updateEquipmentMutation.onSuccess()
    └── onEquipmentUpdated() (prop callback)
        └── EquipmentDialogs.onDataMutationSuccess()
            └── EquipmentDialogContext.onDataMutationSuccess()
                ├── invalidateQueries(equipment_list_enhanced)
                ├── invalidateQueries(active_usage_logs)
                └── invalidateQueries(dashboard-stats)
```

**Critical:** This chain must be preserved in the extracted components.

### 4.3 Recommended Query Key Structure

For extracted components, maintain consistent keys:

```typescript
// EquipmentDetailTypes.ts
export const equipmentDetailKeys = {
  attachments: (id: number | null) => ["equipment-detail", "attachments", id] as const,
  history: (id: number | null) => ["equipment-detail", "history", id] as const,
}
```

This provides better namespacing and prevents collision with other equipment-related queries.

---

## 5. Proposed File Structure

```
src/app/(app)/equipment/_components/
├── EquipmentDialogContext.tsx        # EXISTING - No changes
├── EquipmentColumnsDialog.tsx        # EXISTING - No changes
├── EquipmentPageClient.tsx           # EXISTING - No changes
├── EquipmentDetailDialog/            # NEW directory
│   ├── index.tsx                     # Main dialog component (~300 lines)
│   ├── EquipmentDetailTypes.ts       # Types, schemas, helpers (~100 lines)
│   ├── EquipmentDetailDetailsTab.tsx # Details view + edit form (~400 lines)
│   ├── EquipmentDetailFilesTab.tsx   # Attachments tab (~150 lines)
│   ├── EquipmentDetailHistoryTab.tsx # History timeline (~100 lines)
│   └── hooks/
│       ├── useEquipmentAttachments.ts
│       ├── useEquipmentHistory.ts
│       └── useEquipmentDetailMutations.ts
```

---

## 6. Implementation Checklist

### Phase 1: Types & Utilities (Low Risk)
- [ ] Create `EquipmentDetailTypes.ts`
- [ ] Move type definitions
- [ ] Move helper functions (`normalizeDate`, `isSuspiciousDate`, `getHistoryIcon`)
- [ ] Move form schema and validation
- [ ] Update imports in main file
- [ ] Run typecheck

### Phase 2: Query Hooks (Medium Risk)
- [ ] Create `useEquipmentAttachments.ts`
- [ ] Create `useEquipmentHistory.ts`
- [ ] Create `useEquipmentDetailMutations.ts` (update, add attachment, delete attachment)
- [ ] Update main file to use hooks
- [ ] Verify cache invalidation still works
- [ ] Run tests

### Phase 3: Tab Components (Medium Risk)
- [ ] Create `EquipmentDetailFilesTab.tsx` (simplest tab)
- [ ] Create `EquipmentDetailHistoryTab.tsx`
- [ ] Create `EquipmentDetailDetailsTab.tsx` (most complex - includes form)
- [ ] Update main dialog to compose tabs
- [ ] Test edit flow end-to-end
- [ ] Test attachment add/delete flow
- [ ] Verify form dirty state warning still works

### Phase 4: Main Dialog Cleanup (Low Risk)
- [ ] Rename and move main file to `EquipmentDetailDialog/index.tsx`
- [ ] Update all imports across codebase
- [ ] Remove old file
- [ ] Final typecheck and lint

---

## 7. Risk Assessment Summary

| Risk | Description | Mitigation |
|------|-------------|------------|
| **HIGH** | Form state sharing between main dialog and DetailsTab | Use FormProvider pattern |
| **HIGH** | savedValues optimistic update pattern | Keep in main component, pass as prop |
| **MEDIUM** | Cache invalidation chain breaking | Extract mutations carefully, verify onSuccess callbacks |
| **MEDIUM** | Form dirty state check in dialog close | Keep handleDialogOpenChange in main component |
| **LOW** | Type definition extraction | Straightforward, no logic changes |
| **LOW** | Query hook extraction | Self-contained, clear boundaries |

---

## 8. Final Recommendations

1. **DO NOT create a new EquipmentDetailContext** - Follow the existing pattern where EquipmentDialogContext handles dialog orchestration and individual dialogs manage their own form state.

2. **Use FormProvider for form sharing** - This is the cleanest pattern for splitting the edit form across the DetailsTab.

3. **Start with the lowest-risk extraction** - Begin with types and utilities, then history/files tabs, then details tab last.

4. **Preserve the optimistic update pattern** - The `savedValues` state that merges with stale `equipment` prop is important for UX. Keep this in the main dialog component.

5. **Consider folder structure** - Given the complexity, a subdirectory (`EquipmentDetailDialog/`) with an index.tsx barrel file is cleaner than 7 flat files.

6. **Add explicit query key factory** - Introduces consistency and makes future refactoring safer.

7. **Clean up type assertions** - Use proper TypeScript intersection types instead of `as any` casts.
