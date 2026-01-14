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

## 🔍 Expert Review Findings (2026-01-14)

### Reviewers

| Reviewer | Verdict | Agent ID |
|----------|---------|----------|
| **Code Reviewer** | Approved with Required Changes | a7de7f8 |
| **Backend Architect** | GO with modifications | a999822 |
| **Performance Engineer** | Risks identified, mitigations provided | ac0cf00 |

---

### 🔴 Critical Issues (MUST FIX)

#### 1. `useEquipmentEffects` Anti-Pattern
**All 3 reviewers flagged this.** Consolidating 10+ effects into one hook violates single-responsibility principle and creates a "junk drawer" that is untestable and hard to debug.

**Original Plan:** Single `useEquipmentEffects.ts` (~120 lines) with all effects

**Revised Approach:** Distribute effects to their owning hooks:
| Effect | Original Location | New Location |
|--------|------------------|--------------|
| Auto-hide columns on medium screens | useEquipmentEffects | `useEquipmentTable` |
| Cache invalidation listeners | useEquipmentEffects | `useEquipmentData` |
| Tenant filter persistence (localStorage) | useEquipmentEffects | `useEquipmentAuth` |
| URL parameter handling | useEquipmentEffects | `useEquipmentRouteSync` (NEW) |
| Pagination reset on filter change | useEquipmentEffects | `useEquipmentFilters` |
| Restore table state after mutations | useEquipmentEffects | `useEquipmentTable` |

#### 2. Execution Plan Order Was Wrong
**Issue:** Steps 11-14 (Context creation) came AFTER step 9 (main hook refactor), but main hook needs context to exist first.

**Fixed:** Context creation now comes before main hook refactor (see revised execution plan below).

#### 3. Table Instance in Effect Dependencies (HIGH Performance Risk)
**Issue:** `table` from `useReactTable` is a new instance every render. Effects with `table` in dependencies will run on EVERY render.

**Fix Required:** Use ref pattern:
```typescript
const tableRef = useRef(table)
tableRef.current = table

useEffect(() => {
  tableRef.current.resetColumnFilters()
}, [tenantFilter, isGlobal]) // Remove table from deps
```

#### 4. Missing `EquipmentDialogState` Interface
**Issue:** Plan didn't show explicit dialog state consolidation like RepairRequests pattern.

**Required Addition:**
```typescript
interface EquipmentDialogState {
  isAddOpen: boolean
  isImportOpen: boolean
  editingEquipment: Equipment | null
  detailEquipment: Equipment | null
  usageEquipment: Equipment | null
  endUsageEquipment: Equipment | null
}
```

---

### 🟡 Important Issues (SHOULD FIX)

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| Missing `equipment/types.ts` | Type organization | Create centralized types file |
| Filter arrays not memoized | Query key instability | Add `useMemo` to all `getArrayFilter` calls |
| No intermediate typechecks | Late error discovery | Add typecheck after steps 6, 11, 14 |
| Context scope too broad | Re-render cascades | Use `EquipmentDialogContext` (dialog-focused only) |
| `queryClient`, `toast`, `router` access unclear | Implementation gap | Import directly in hooks that need them |

---

### 🟢 Suggestions (NICE TO HAVE)

1. **Split Context by update frequency:**
   - `EquipmentAuthContext` (rarely changes)
   - `EquipmentDialogContext` (medium frequency)

2. **Add `React.memo` to all dialog components** for performance

3. **Consider `useEquipmentFacility`** separate hook for facility filter logic

4. **Extract reusable utilities post-refactor:**
   - `useTableWithServerPagination`
   - `useFilterPersistence`
   - `useDataExport<T>`

---

### ⚡ Performance Considerations

#### Memoization Requirements

| Value | Hook | Must Memoize? | Reason |
|-------|------|---------------|--------|
| `selectedDepartments`, `selectedUsers`, etc. | useEquipmentFilters | ✅ YES | Used in query keys |
| `sortParam` | useEquipmentFilters | ✅ Already done | Used in query keys |
| `renderActions` callback | useEquipmentTable | ✅ YES | Creates JSX, passed to columns |
| All handlers in context | EquipmentDialogContext | ✅ YES | Prevent context value changes |
| Hook return values | All hooks | ✅ YES | Prevent downstream cascades |

#### Re-render Prevention

```typescript
// Context value MUST be memoized
const value = React.useMemo<EquipmentDialogContextValue>(() => ({
  dialogState,
  openAddDialog,
  closeAllDialogs,
  // ... all handlers must be useCallback
}), [dialogState]) // Minimal dependencies

// Dialogs should use React.memo
export const EquipmentAddDialog = React.memo(function EquipmentAddDialog() {
  const { dialogState, closeAllDialogs } = useEquipmentDialogContext()
  if (!dialogState.isAddOpen) return null
  // ...
})
```

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

## Implementation Plan (REVISED)

### PHASE 1: Setup & Types

**New Files:**

1. `src/app/(app)/equipment/types.ts` (~50 lines)
   ```typescript
   // Centralized types:
   - EquipmentDialogState
   - FilterBottomSheetData
   - FacilityOption
   - UseEquipmentPageReturn (updated)
   ```

2. Create `_hooks/` and `_components/` directories

---

### PHASE 2: Extract Hooks

Create 7 focused hooks in `_hooks/` (revised from 6):

#### 1. `useEquipmentAuth.ts` (~50 lines)
```typescript
// Exports:
- user, status, isGlobal, isRegionalLeader
- tenantKey, currentTenantId
- tenantFilter, setTenantFilter (with localStorage effect)
```

#### 2. `useEquipmentFilters.ts` (~70 lines)
```typescript
// Manages:
- searchTerm, debouncedSearch, columnFilters, sorting
- getArrayFilter helper (MEMOIZED)
- selectedDepartments, selectedUsers, selectedLocations, selectedStatuses, selectedClassifications (ALL MEMOIZED)
- isFiltered computed value
- Pagination reset effect on filter change
```

#### 3. `useEquipmentData.ts` (~150 lines)
```typescript
// Queries + cache invalidation effects:
- Equipment list (equipment_list_enhanced)
- Filter options (departments, users, locations, statuses, classifications)
- Facilities (for regional leaders/global)
- Active usage logs
- Tenant list (for global users)
- Cache invalidation window event listeners
```

#### 4. `useEquipmentTable.ts` (~100 lines)
```typescript
// Table + related effects:
- Table instance (useReactTable) with REF PATTERN
- Pagination state + preservePageState logic
- Column visibility state + auto-hide effect
- Columns definition (createEquipmentColumns with renderActions)
- pageCount calculation
```

#### 5. `useEquipmentRouteSync.ts` (~40 lines) - NEW
```typescript
// URL parameter handling:
- Parse action=add, highlight=id from URL
- Return initial dialog state based on URL
- Handle navigation after actions
```

#### 6. `useEquipmentExport.ts` (~60 lines)
```typescript
// Handlers:
- handleDownloadTemplate
- handleExportData
- handleGenerateProfileSheet
- handleGenerateDeviceLabel
```

#### 7. `useEquipmentFacility.ts` (~40 lines) - NEW (optional)
```typescript
// Facility filter logic:
- Integrates useFacilityFilter
- isFacilitySheetOpen, pendingFacilityId
- Sync pending facility effect
```

---

### PHASE 3: Create Context Infrastructure

**Files:**

1. `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx` (~150 lines)
   ```typescript
   // Context manages (DIALOG-FOCUSED ONLY):
   - dialogState: EquipmentDialogState
   - Dialog actions (openAddDialog, openEditDialog, closeAllDialogs, etc.)
   - Mutation handlers (createMutation, updateMutation, deleteMutation)
   - Shared handlers (handleShowDetails, handleStartUsage, handleEndUsage)
   - onDataMutationSuccess callback
   
   // MUST use useMemo on context value
   // ALL handlers MUST use useCallback
   ```

2. `src/app/(app)/equipment/_hooks/useEquipmentContext.ts` (~15 lines)
   ```typescript
   export function useEquipmentContext() {
     const context = useContext(EquipmentDialogContext)
     if (!context) throw new Error('useEquipmentContext must be used within EquipmentProvider')
     return context
   }
   ```

---

### PHASE 4: Refactor Main Hook

**File**: `src/app/(app)/equipment/use-equipment-page.tsx` (~120 lines)

Becomes a **composition hook**:

```typescript
export function useEquipmentPage(): UseEquipmentPageReturn {
  const auth = useEquipmentAuth()
  const routeSync = useEquipmentRouteSync()
  const filters = useEquipmentFilters({
    tenantKey: auth.tenantKey,  // Pass primitives, not objects
    isGlobal: auth.isGlobal,
  })
  const data = useEquipmentData({
    tenantId: auth.currentTenantId,
    isGlobal: auth.isGlobal,
    debouncedSearch: filters.debouncedSearch,
    selectedFilters: filters.selectedFilters, // Must be memoized
    sortParam: filters.sortParam,
  })
  const table = useEquipmentTable({
    data: data.data,
    total: data.total,
    pagination: filters.pagination,
  })
  const exports = useEquipmentExport(data)

  return useMemo(() => ({
    ...auth,
    ...filters,
    ...data,
    ...table,
    ...exports,
    ...routeSync,
  }), [auth, filters, data, table, exports, routeSync])
}
```

---

### PHASE 5: Refactor Dialog Components

**Files to update (add React.memo):**
1. `EquipmentAddDialog.tsx` → Use `useEquipmentContext()`, zero props, React.memo
2. `EquipmentImportDialog.tsx` → Use context, React.memo
3. `EquipmentEditDialog.tsx` → Use context, React.memo
4. `EquipmentDetailDialog.tsx` → Use context, React.memo
5. `EquipmentStartUsageDialog.tsx` → Use context, React.memo
6. `EquipmentEndUsageDialog.tsx` → Use context, React.memo

**Pattern:**
```typescript
// After: Zero props, consume context, memoized
export const EquipmentAddDialog = React.memo(function EquipmentAddDialog() {
  const { dialogState, closeAllDialogs, createMutation } = useEquipmentContext()
  
  if (!dialogState.isAddOpen) return null
  
  // ... use context values
})
```

**New file**: `_components/EquipmentDialogs.tsx`
- Renders all dialogs
- Zero props, consumes context internally

---

### PHASE 6: Update Page Component

**File**: `src/app/(app)/equipment/_components/EquipmentPageClient.tsx` (~300 lines)

```typescript
export function EquipmentPageClient() {
  return (
    <EquipmentDialogProvider>
      <EquipmentPageContent />
    </EquipmentDialogProvider>
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

### PHASE 7: Code Simplification (Automated)

Invoke code-simplifier agent:

```
Task tool with:
- subagent_type: "code-simplifier"
- description: "Simplify refactored equipment code"
- prompt: "Review and simplify equipment module. Apply CLAUDE.md standards, eliminate complexity, ensure consistency. Focus on:
  - _components/EquipmentDialogContext.tsx
  - _hooks/*.ts
  - use-equipment-page.tsx
  - _components/*Dialog.tsx
  - _components/EquipmentPageClient.tsx"
```

---

## File Structure After Refactor (REVISED)

```
equipment/
├── _components/
│   ├── EquipmentDialogContext.tsx    # NEW - Dialog Context + Provider (~150 lines)
│   ├── EquipmentPageClient.tsx       # RENAMED from page.tsx
│   ├── EquipmentDialogs.tsx          # NEW - Wrapper for all dialogs
│   ├── Equipment*Dialog.tsx          # UPDATED - Zero props, React.memo
│   └── [other components]
├── _hooks/
│   ├── useEquipmentContext.ts        # NEW - Consumer hook (~15 lines)
│   ├── useEquipmentAuth.ts           # NEW - Auth + tenant (~50 lines)
│   ├── useEquipmentFilters.ts        # NEW - Filters + pagination (~70 lines)
│   ├── useEquipmentData.ts           # NEW - Queries + cache (~150 lines)
│   ├── useEquipmentTable.ts          # NEW - Table + effects (~100 lines)
│   ├── useEquipmentRouteSync.ts      # NEW - URL params (~40 lines)
│   └── useEquipmentExport.ts         # NEW - Export handlers (~60 lines)
├── types.ts                          # NEW - Centralized types (~50 lines)
├── use-equipment-page.tsx            # REFACTORED - Composition (~120 lines)
└── page.tsx                          # NEW - Server component entry (~10 lines)
```

**Total: ~665 lines across 10 focused files** (vs 952 lines in 1 file)

---

## Step-by-Step Execution (REVISED - 30 Steps)

### PHASE 1: Setup (Steps 1-3)
1. □ Create `_hooks/` directory
2. □ Create `_components/` directory (if not exists)
3. □ Create `types.ts` with EquipmentDialogState, FilterBottomSheetData, etc.

### PHASE 2: Extract Hooks (Steps 4-12)
4. □ Extract `useEquipmentAuth.ts` (~50 lines, include localStorage effect)
5. □ Extract `useEquipmentFilters.ts` (~70 lines, memoize all arrays)
6. □ Run `npm run typecheck` (intermediate checkpoint)
7. □ Extract `useEquipmentData.ts` (~150 lines, include cache effects)
8. □ Extract `useEquipmentTable.ts` (~100 lines, use ref pattern, include table effects)
9. □ Extract `useEquipmentExport.ts` (~60 lines)
10. □ Extract `useEquipmentRouteSync.ts` (~40 lines, URL params)
11. □ Run `npm run typecheck` (intermediate checkpoint)

### PHASE 3: Context Infrastructure (Steps 12-14)
12. □ Create `EquipmentDialogContext.tsx` (~150 lines, dialog-focused)
13. □ Create `useEquipmentContext.ts` (~15 lines)
14. □ Run `npm run typecheck` (intermediate checkpoint)

### PHASE 4: Main Hook Refactor (Steps 15-16)
15. □ Refactor `use-equipment-page.tsx` to composition (~120 lines)
16. □ Run `npm run typecheck`

### PHASE 5: Dialog Updates (Steps 17-24)
17. □ Update `EquipmentAddDialog` (use context, add React.memo)
18. □ Update `EquipmentImportDialog` (use context, add React.memo)
19. □ Update `EquipmentEditDialog` (use context, add React.memo)
20. □ Update `EquipmentDetailDialog` (use context, add React.memo)
21. □ Update `EquipmentStartUsageDialog` (use context, add React.memo)
22. □ Update `EquipmentEndUsageDialog` (use context, add React.memo)
23. □ Create `EquipmentDialogs.tsx` wrapper
24. □ Run `npm run typecheck`

### PHASE 6: Page Restructure (Steps 25-27)
25. □ Update `EquipmentPageClient.tsx` (wrap with provider)
26. □ Create new `page.tsx` (server component)
27. □ Run `npm run typecheck`

### PHASE 7: Verification & Simplification (Steps 28-30)
28. □ Run full test suite
29. □ Invoke code-simplifier agent on all modified files
30. □ Final typecheck + manual testing

---

## Verification Checklist

### TypeScript
```bash
npm run typecheck
```

### Performance Verification
```bash
# Enable React DevTools Profiler
# Settings > Profiler > Record why each component rendered

# Check re-render counts:
# - Page load: baseline measurement
# - Filter change: should be 1-2 re-renders max
# - Page change: should be 1-2 re-renders max
# - Dialog open/close: only dialog should re-render
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

### File Size Compliance
- [ ] All files within 350-450 lines
- [ ] `use-equipment-page.tsx`: 952 → ~120 lines ✓
- [ ] Context file: ~150 lines ✓
- [ ] Each hook: < 150 lines ✓
- [ ] types.ts: ~50 lines ✓

---

## Benefits

1. ✅ **Maintainability**: 10 focused files vs 1 massive hook
2. ✅ **Consistency**: Follows RepairRequests pattern (improved)
3. ✅ **CLAUDE.md Compliance**: File sizes within guidelines
4. ✅ **Testability**: Individual hooks testable in isolation
5. ✅ **Readability**: Single responsibility per file
6. ✅ **Zero Props Dialogs**: Cleaner components with React.memo
7. ✅ **Performance**: Proper memoization prevents re-render cascades
8. ✅ **Code Simplification**: Automated standards enforcement

---

## Risks & Mitigation (UPDATED)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking functionality | Medium | High | Incremental refactor, typecheck after each phase, preserve public API |
| Complex state dependencies | Medium | Medium | Trace dependencies, pass primitives not objects to hooks |
| Performance regression | Medium | High | useMemo/useCallback everywhere, React.memo on dialogs, ref pattern for table |
| Context value instability | High | Medium | useMemo on context value, useCallback on all handlers |
| Effect infinite loops | Medium | High | Use ref pattern, stabilize object dependencies with JSON.stringify |
| Filter array reference changes | High | Medium | Memoize all getArrayFilter calls |

---

**Created**: 2026-01-14
**Reviewed**: 2026-01-14 (3 expert subagents)
**Status**: Ready for execution (with review findings incorporated)

---

## Post-Implementation Review (Phase 2-3) - 2026-01-14

### ✅ Issues Addressed (10)

| Issue | Fix Applied | File(s) |
|-------|-------------|---------|
| Timer cleanup in useEquipmentTable | Added `clearTimeout(timer)` cleanup function | useEquipmentTable.ts:195-204 |
| Timer cleanup in useEquipmentRouteSync | Refactored with cleanup function | useEquipmentRouteSync.ts |
| useEquipmentRouteSync tight coupling | Returns `pendingAction` + `clearPendingAction` instead of calling external setters | useEquipmentRouteSync.ts |
| Duplicate selectedDonViUI/selectedDonVi | Removed `selectedDonViUI`, uses only `selectedDonVi` | useEquipmentAuth.ts |
| Missing pagination reset on filter change | Added `filterKey` tracking with auto-reset to page 0 | useEquipmentTable.ts:117-136 |
| Missing mutations documentation | Added design note explaining dialog-focused context | EquipmentDialogContext.tsx:8-22 |
| Highlight processed ref | Added `processedParamsRef` | useEquipmentRouteSync.ts |
| Missing locations in return value | Added `locations` to interface and return | useEquipmentData.ts:39,358,381 |
| Missing AbortSignal for queries | Added `signal` to all 5 filter option queries | useEquipmentData.ts |
| Clear filters on tenant change | Added `resetFilters()` callback | useEquipmentFilters.ts:82-86 |

### 🔸 Deferred Issues (Phase 7 or Future)

| Issue | Priority | Reason Deferred | Recommended Phase |
|-------|----------|-----------------|-------------------|
| userRole type specificity | Low | Works correctly, cosmetic | Phase 7 (code-simplifier) |
| Tenant filter toast effect | Medium | UI polish, not critical | Phase 4 (composition hook) |
| Inconsistent dialog state pattern (boolean vs null check) | Low | Works correctly, cosmetic | Phase 7 (code-simplifier) |
| Type import paths (`../types` vs `@/types`) | Minor | Consistency, low impact | Phase 7 (code-simplifier) |
| useEquipmentData too large (398 lines) | Medium | Still within acceptable range, works well | Future refactor |
| Auth duplication (useEquipmentAuth vs context) | Low | Context only reads session, minimal duplication | Future optimization |
| Context splitting (dialog state causes re-renders) | Medium | Requires major architectural change | Future optimization |

### Notes for Phase 4

The main composition hook should include:
```typescript
// Tenant change effect (clear filters when tenant changes)
React.useEffect(() => {
  if (!auth.isGlobal) return
  filters.resetFilters()
}, [auth.tenantFilter, auth.isGlobal, filters.resetFilters])
```

---

## Phase 4 Review Findings - 2026-01-14

### ✅ High-Priority Issues (FIXED)

| Issue | Fix Applied | Commit |
|-------|-------------|--------|
| dataParams memoization using entire `[auth, filters]` objects | Changed to 15 explicit property dependencies | 5797d1b |
| Pagination dual-source (hardcoded `{ pageIndex: 0, pageSize: 20 }` dead code) | Removed, now uses actual `pagination` state | 5797d1b |
| renderActions missing `routeSync.router` dependency | Moved routeSync before renderActions, added to deps | 5797d1b |

### 🟡 Medium-Priority Issues (DEFERRED)

| Issue | Severity | Recommendation | Target Phase |
|-------|----------|----------------|--------------|
| Dialog state still in main hook (12 useState) | Medium | Move to EquipmentDialogContext as planned | Phase 5 |
| Large return value memoization deps (~40 items) | Medium | Consider splitting context by update frequency | Phase 5/7 |
| Missing locations in return value | Medium | Expose `data.locations` in return if needed by consumers | Phase 5 |
| Pagination sync effect compares by reference | Medium | Optimize to compare `pageIndex`/`pageSize` values, not object reference | Phase 7 |
| Effect dependency arrays could use refs | Low | Use ref pattern for stable table/router references | Phase 7 |
| Lazy initialization for dialog states | Low | `useState(() => null)` pattern for Equipment objects | Phase 7 |
| useMemo final return has many deps (40+) | Low | Acceptable for now, monitor performance | Phase 7 |

### Notes

- All high-priority issues resolved in commit `5797d1b`
- Medium-priority issues are architectural and will be addressed when dialog refactoring begins (Phase 5)
- The composition pattern is working correctly with proper dependency tracking

---
