# Equipment And Maintenance Filter Centralization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize duplicated filter UI logic between Equipment page and Maintenance "Thêm thiết bị vào kế hoạch" dialog, while preserving behavior and improving reuse of shared search/pagination primitives.

**Architecture:** Extract a shared faceted multi-select filter UI component under `src/components/shared/table-filters`, migrate both Equipment toolbar and Add Tasks dialog to consume it, and standardize the Add Tasks dialog search/pagination using existing shared components (`SearchInput`, `DataTablePagination`). Keep page-specific layout/actions in page-level components.

**Tech Stack:** Next.js App Router, React 18 client components, TanStack Table v8, TanStack Query v5, Vitest + Testing Library, shadcn/ui

---

### Task 1: Extract Shared Faceted Filter Primitive

**Files:**
- Create: `src/components/shared/table-filters/FacetedMultiSelectFilter.tsx`
- Create: `src/components/shared/table-filters/index.ts`
- Create: `src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders title, toggles multi-select values, and clears selections", async () => {
  // mount with a test TanStack column mock
  // click options
  // assert column.setFilterValue called with array values then undefined on clear
})
```

**Step 2: Run test to verify it fails**

Run: `node scripts/npm-run.js run test:run -- src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`  
Expected: FAIL because shared component does not exist.

**Step 3: Write minimal implementation**

Implement reusable props:
- `column?: Column<TData, TValue>`
- `title?: string`
- `options: { label: string; value: string }[]`
- optional style variant for Equipment vs Dialog visual parity if needed.

Keep behavior identical to current duplicated implementations:
- multi-select toggle
- selected count badge
- clear filter action.

**Step 4: Run test to verify it passes**

Run: `node scripts/npm-run.js run test:run -- src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/shared/table-filters/FacetedMultiSelectFilter.tsx src/components/shared/table-filters/index.ts src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx
git commit -m "feat: extract shared faceted multi-select table filter"
```

### Task 2: Migrate Equipment Toolbar To Shared Faceted Filter

**Files:**
- Modify: `src/components/equipment/equipment-toolbar.tsx`
- Create: `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`

**Step 1: Write the failing test**

```tsx
it("applies and clears faceted filters in desktop mode using shared filter component", async () => {
  // render toolbar with table mock
  // interact with faceted filters
  // assert column filter updates and clear behavior
})
```

**Step 2: Run test to verify it fails**

Run: `node scripts/npm-run.js run test:run -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`  
Expected: FAIL before migration assertions are satisfied.

**Step 3: Replace local component usage**

- Remove local `DataTableFacetedFilter` from `equipment-toolbar.tsx`.
- Import shared `FacetedMultiSelectFilter`.
- Keep existing toolbar composition and actions unchanged:
  - mobile sheet trigger
  - options menu
  - facility clear action
  - QR scan trigger.

**Step 4: Run tests**

Run:
- `node scripts/npm-run.js run test:run -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
- `node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/EquipmentPageClient.attention-preset.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/equipment/equipment-toolbar.tsx src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx
git commit -m "feat: reuse shared faceted filter in equipment toolbar"
```

### Task 3: Migrate Add Tasks Dialog Search + Faceted Filters + Pagination

**Files:**
- Modify: `src/components/add-tasks-dialog.tsx`
- Create: `src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`

**Step 1: Write the failing test**

```tsx
it("uses shared search input, faceted filters, and paginates selectable rows correctly", async () => {
  // open dialog
  // apply search + faceted filters
  // verify selected count and page navigation behavior
})
```

**Step 2: Run test to verify it fails**

Run: `node scripts/npm-run.js run test:run -- src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`  
Expected: FAIL before dialog migration.

**Step 3: Implement migration**

- Replace `Input` search with shared `SearchInput`.
- Replace local `DataTableFacetedFilter` with shared `FacetedMultiSelectFilter`.
- Add shared `DataTablePagination` at dialog footer (TanStack/local mode).
- Keep existing selection constraints:
  - `enableRowSelection` excludes already-added equipment
  - add button uses filtered selected rows.

**Step 4: Run tests**

Run:
- `node scripts/npm-run.js run test:run -- src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`
- `node scripts/npm-run.js run test:run -- src/app/(app)/maintenance/__tests__/MaintenanceContext.extended.test.tsx`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/components/add-tasks-dialog.tsx src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx
git commit -m "feat: centralize add-tasks dialog filters and pagination"
```

### Task 4: Regression + Quality Gates

**Files:**
- Modify if needed from fixes discovered by checks.

**Step 1: Run typecheck**

Run: `node scripts/npm-run.js run typecheck`  
Expected: PASS.

**Step 2: Run lint**

Run: `node scripts/npm-run.js run lint`  
Expected: PASS.

**Step 3: Run full tests**

Run: `node scripts/npm-run.js run test:run`  
Expected: PASS or known pre-existing unrelated failures documented.

**Step 4: Manual browser verification**

Verify on desktop + mobile:
- Equipment page toolbar filters/search still work.
- Maintenance Add Tasks dialog filter/search/selection still work.
- Pagination behaves correctly with filtered datasets.

Record verification notes in PR description.

**Step 5: Commit any verification fixes**

```bash
git add <fix-files>
git commit -m "fix: resolve regressions from filter centralization"
```

### Task 5: Optional Follow-Up (Out Of Scope For First PR)

**Files (future):**
- `src/components/shared/table-filters/TableFilterToolbar.tsx` (new)
- `src/app/(app)/maintenance/_components/plan-filters-bar.tsx` (adapter migration candidate)

**Step 1: Decide whether to centralize facility+search strip now**

Keep out of first PR unless requested to reduce review risk.

**Step 2: If enabled, implement adapter-based toolbar**

Use slots for:
- left: search + faceted filters
- right: actions
- optional facility selector row.

**Step 3: Verify no UX regressions**

Run targeted and full checks as in Task 4.

**Step 4: Commit separately**

```bash
git add <files>
git commit -m "feat: add reusable table filter toolbar shell"
```

## Notes And Constraints

- Keep `'use client'` boundaries only on interactive components.
- Preserve current data-fetching ownership in page hooks; centralize UI primitives, not query logic.
- Avoid broad refactor of maintenance plan list filters in first PR.
- GKG `.tsx` coverage is incomplete in this environment; validate impact with `rg` + direct file reads during implementation.
