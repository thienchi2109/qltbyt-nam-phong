# Refactor Plan: useEquipmentPage Hook

**Date**: 2026-01-14
**File**: `src/app/(app)/equipment/use-equipment-page.tsx` (952 lines)
**Target**: Comprehensive refactor following `/refactor-code` workflow + RepairRequests Context pattern

---

## User Decisions

✅ **Scope**: Full Context Pattern (Phases 1-5)
✅ **File Structure**: Follow RepairRequests pattern with `_components/` and `_hooks/`
✅ **Code Simplification**: Auto-invoke code-simplifier after structural refactoring

---

## Current Analysis

### Issues Identified

1. **Size & Complexity**
   - 952 lines (violates CLAUDE.md 350-450 line guideline)
   - 50+ pieces of state, 20+ useState hooks
   - Mixed concerns: auth, queries, filters, pagination, dialogs, effects

2. **State Management Antipatterns**
   - Large return object with 60+ properties
   - Complex dependencies: tenant ↔ facility ↔ pagination
   - Prop drilling in page component

3. **Missing Context Pattern**
   - Unlike RepairRequests (uses Context), Equipment uses massive hook
   - Dialogs receive props instead of consuming context

4. **Effects Complexity**
   - 10+ useEffect with interdependencies
   - localStorage, URL params, cache invalidation all mixed

### Established Pattern

RepairRequests module (`_components/RepairRequestsContext.tsx`):
- Context for shared state/mutations
- Dialogs consume context (zero props)
- Page component is lean
- Clear separation of concerns

---

## Implementation Plan

### PHASE 1: Create Context Infrastructure

**New Files:**

1. `src/app/(app)/equipment/_components/EquipmentContext.tsx` (~200 lines)
   ```typescript
   // Context manages:
   - Dialog state (isAddOpen, isImportOpen, editingEquipment, etc.)
   - Dialog actions (openAddDialog, closeAllDialogs, etc.)
   - Shared handlers (handleShowDetails, handleStartUsage, handleEndUsage)
   - Export handlers (handleExportData, handleDownloadTemplate, etc.)
   - Cache invalidation (onDataMutationSuccess, etc.)
   ```

2. `src/app/(app)/equipment/_hooks/useEquipmentContext.ts` (~10 lines)
   ```typescript
   // Consumer hook for accessing context
   export function useEquipmentContext() { ... }
   ```

---

### PHASE 2: Split Hooks

Create 6 focused hooks in `_hooks/`:

#### 1. `useEquipmentAuth.ts` (~30 lines)
```typescript
// Exports:
- user, status, isGlobal, isRegionalLeader
- tenantKey, currentTenantId
```

#### 2. `useEquipmentFilters.ts` (~100 lines)
```typescript
// Manages:
- searchTerm, debouncedSearch, columnFilters, sorting
- getArrayFilter helper
- selectedDepartments, selectedUsers, selectedLocations, selectedStatuses, selectedClassifications
- isFiltered computed value
- Facility filter state (integrates useFacilityFilter)
```

#### 3. `useEquipmentData.ts` (~180 lines)
```typescript
// Queries:
- Equipment list (equipment_list_enhanced)
- Filter options (departments, users, locations, statuses, classifications)
- Facilities (for regional leaders/global)
- Active usage logs
- Tenant list (for global users)

// Returns:
- data, total, isLoading, isFetching
- departments, users, statuses, classifications, filterData
- facilities, activeFacility, isFacilitiesLoading
- activeUsageLogs, isLoadingActiveUsage
```

#### 4. `useEquipmentTable.ts` (~100 lines)
```typescript
// Manages:
- Table instance (useReactTable)
- Pagination state
- Column visibility state
- Columns definition (createEquipmentColumns with renderActions)
- pageCount calculation
```

#### 5. `useEquipmentEffects.ts` (~120 lines)
```typescript
// Effects for:
- Auto-hide columns on medium screens
- Sync pending facility when sheet opens
- Cache invalidation listeners (window events)
- Tenant filter changes
- Toast on tenant selection
- LocalStorage persistence
- Restore tenant selection
- Clear filters on tenant change
- URL parameter handling (action=add, highlight=id)
- Pagination reset on filter changes
- Restore table state after mutations
```

#### 6. `useEquipmentExport.ts` (~80 lines)
```typescript
// Handlers:
- handleDownloadTemplate
- handleExportData
- handleGenerateProfileSheet
- handleGenerateDeviceLabel
```

---

### PHASE 3: Refactor Main Hook

**File**: `src/app/(app)/equipment/use-equipment-page.tsx` (~150 lines)

Becomes a **composition hook**:

```typescript
export function useEquipmentPage(): UseEquipmentPageReturn {
  const auth = useEquipmentAuth()
  const filters = useEquipmentFilters(auth)
  const data = useEquipmentData(auth, filters)
  const table = useEquipmentTable(data, filters)
  const exports = useEquipmentExport(data)

  useEquipmentEffects(auth, filters, data, table)

  return {
    ...auth,
    ...filters,
    ...data,
    ...table,
    ...exports,
    // ... other combined values
  }
}
```

---

### PHASE 4: Refactor Dialog Components

**Files to update:**
1. `EquipmentAddDialog.tsx` → Use `useEquipmentContext()`, zero props
2. `EquipmentImportDialog.tsx` → Use context
3. `EquipmentEditDialog.tsx` → Use context
4. `EquipmentDetailDialog.tsx` → Use context
5. `EquipmentStartUsageDialog.tsx` → Use context
6. `EquipmentEndUsageDialog.tsx` → Use context

**Pattern:**
```typescript
// Before: Props passed from page
interface Props {
  isOpen: boolean
  onClose: () => void
  equipment: Equipment | null
  // ... many more props
}

// After: Zero props, consume context
export function EquipmentAddDialog() {
  const { dialogState, closeAllDialogs, createMutation } = useEquipmentContext()
  const isOpen = dialogState.isAddOpen
  // ... use context values
}
```

**New file**: `_components/EquipmentDialogs.tsx`
- Renders all dialogs
- Zero props, consumes context internally

---

### PHASE 5: Update Page Component

**File**: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` (~300 lines)

```typescript
export function EquipmentPageClient() {
  return (
    <EquipmentProvider>
      <EquipmentPageContent />
    </EquipmentProvider>
  )
}

function EquipmentPageContent() {
  const {
    // Only essential values for layout
    user, status, isGlobal, router,
    // ... minimal destructuring
  } = useEquipmentPage()

  // ... render UI
}
```

**File**: `src/app/(app)/equipment/page.tsx` (~10 lines)

```typescript
export default function EquipmentPage() {
  return <EquipmentPageClient />
}
```

---

### PHASE 6: Code Simplification (Automated)

Invoke code-simplifier agent:

```
Task tool with:
- subagent_type: "code-simplifier:code-simplifier"
- description: "Simplify refactored equipment code"
- prompt: "Review and simplify equipment module. Apply CLAUDE.md standards, eliminate complexity, ensure consistency. Focus on:
  - _components/EquipmentContext.tsx
  - _hooks/*.ts
  - use-equipment-page.tsx
  - _components/*Dialog.tsx
  - _components/EquipmentPageClient.tsx"
```

---

## File Structure After Refactor

```
equipment/
├── _components/
│   ├── EquipmentContext.tsx          # NEW - Context + Provider
│   ├── EquipmentPageClient.tsx       # RENAMED from page.tsx
│   ├── EquipmentDialogs.tsx          # NEW - Wrapper for all dialogs
│   ├── Equipment*Dialog.tsx          # UPDATED - Zero props, use context
│   └── [other components]
├── _hooks/
│   ├── useEquipmentContext.ts        # NEW - Consumer hook
│   ├── useEquipmentAuth.ts           # NEW - Auth logic
│   ├── useEquipmentFilters.ts        # NEW - Filter logic
│   ├── useEquipmentData.ts           # NEW - Data queries
│   ├── useEquipmentTable.ts          # NEW - Table setup
│   ├── useEquipmentEffects.ts        # NEW - Effects
│   └── useEquipmentExport.ts         # NEW - Export handlers
├── use-equipment-page.tsx            # REFACTORED - Composition (~150 lines)
└── page.tsx                          # NEW - Server component entry (~10 lines)
```

---

## Step-by-Step Execution

1. ✅ Create `_hooks/` directory
2. ✅ Create `_components/` directory (if not exists)
3. ✅ Extract `useEquipmentAuth.ts`
4. ✅ Extract `useEquipmentFilters.ts`
5. ✅ Extract `useEquipmentData.ts`
6. ✅ Extract `useEquipmentTable.ts`
7. ✅ Extract `useEquipmentEffects.ts`
8. ✅ Extract `useEquipmentExport.ts`
9. ✅ Refactor `use-equipment-page.tsx` (composition)
10. ✅ Run `npm run typecheck` - verify hooks
11. ✅ Create `EquipmentContext.tsx`
12. ✅ Create `useEquipmentContext.ts`
13. ✅ Update all dialog components (use context)
14. ✅ Create `EquipmentDialogs.tsx` wrapper
15. ✅ Rename `page.tsx` → `EquipmentPageClient.tsx`
16. ✅ Update `EquipmentPageClient.tsx` (use provider)
17. ✅ Create new `page.tsx` (server component)
18. ✅ Run `npm run typecheck`
19. ✅ Auto-invoke code-simplifier agent
20. ✅ Final typecheck + manual testing

---

## Verification Checklist

### TypeScript
```bash
npm run typecheck
```

### Manual Testing
- [ ] Equipment page loads without errors
- [ ] Search/filtering work
- [ ] Pagination works
- [ ] Sorting works
- [ ] Column visibility toggle
- [ ] All dialogs (add, import, edit, detail, usage)
- [ ] Facility filter (regional/global)
- [ ] Export (Excel, template, profile, label)
- [ ] URL parameters (action=add, highlight=id)
- [ ] Cache invalidation
- [ ] LocalStorage persistence
- [ ] All 10 useEffect hooks function correctly

### File Size Compliance
- [ ] All files within 350-450 lines
- [ ] `use-equipment-page.tsx`: 952 → ~150 lines
- [ ] Context file: ~200 lines
- [ ] Each hook: < 200 lines

---

## Benefits

1. ✅ **Maintainability**: 9 focused files vs 1 massive hook
2. ✅ **Consistency**: Follows RepairRequests pattern
3. ✅ **CLAUDE.md Compliance**: File sizes within guidelines
4. ✅ **Testability**: Individual hooks testable
5. ✅ **Readability**: Single responsibility per file
6. ✅ **Zero Props Dialogs**: Cleaner components
7. ✅ **Code Simplification**: Automated standards enforcement

---

## Risks & Mitigation

**Risk 1**: Breaking functionality
→ Incremental refactor, test after each phase, preserve public API

**Risk 2**: Complex state dependencies
→ Trace dependencies carefully, use proper memoization

**Risk 3**: Performance regression
→ Use React.useMemo/useCallback, verify no unnecessary re-renders

---

**Created**: 2026-01-14
**Status**: Ready for execution
