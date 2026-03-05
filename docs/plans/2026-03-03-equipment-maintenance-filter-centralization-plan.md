# Equipment And Maintenance Filter Centralization Implementation Plan

**Goal:** Centralize duplicated filter UI logic between Equipment page and Maintenance "Thêm thiết bị vào kế hoạch" dialog, while preserving behavior and improving reuse of shared search/pagination primitives.

**Architecture:** Extract a shared faceted multi-select filter UI component under `src/components/shared/table-filters/`, migrate both Equipment toolbar and Add Tasks dialog to consume it, and standardize the Add Tasks dialog search/pagination using existing shared components (`SearchInput`, `DataTablePagination`). Keep page-specific layout/actions in page-level components.

**Tech Stack:** Next.js App Router, React 18 client components, TanStack Table v8, TanStack Query v5, Vitest + Testing Library, shadcn/ui

**Methodology:** Strict TDD — RED → verify fail → GREEN → verify pass → REFACTOR → verify still green. No production code without a failing test first.

---

### Task 1: Extract Shared Faceted Filter Primitive

**Files:**
- Create: `src/components/shared/table-filters/FacetedMultiSelectFilter.tsx`
- Create: `src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`

> **Audit Fix #1 (Visual Divergence):** The equipment toolbar uses a custom checkbox UI; the dialog uses `DropdownMenuCheckboxItem`. The shared component adopts the **equipment toolbar style** (more polished) as the unified default. Both consumers get the same visual. No `variant` prop needed for first PR.

> **Audit Fix #6 (No Barrel File):** Do NOT create `index.ts` — consumers import directly from `FacetedMultiSelectFilter.tsx` per `bundle-barrel-imports` rule.

**🔴 RED — Write failing test**

```tsx
// FacetedMultiSelectFilter.test.tsx
describe("FacetedMultiSelectFilter", () => {
  it("renders title and all options", () => {
    // mount with a TanStack Column mock, 3 options
    // open dropdown
    // assert title visible, all 3 option labels visible
  })

  it("toggles selection and calls column.setFilterValue with array", () => {
    // click option A → assert setFilterValue([A])
    // click option B → assert setFilterValue([A, B])
    // click option A again → assert setFilterValue([B])
  })

  it("shows selected count badge when options are selected", () => {
    // select 2 options
    // assert badge with "2" is visible
  })

  it("clears all selections when clear button is clicked", () => {
    // select options, click "Xóa bộ lọc"
    // assert setFilterValue(undefined)
  })

  it("handles undefined column gracefully", () => {
    // mount without column prop
    // assert renders without crashing, clicks are no-ops
  })
})
```

Run: `node scripts/npm-run.js run test:run -- src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`
Expected: FAIL — component does not exist.

**🟢 GREEN — Write minimal implementation**

Props interface:
- `column?: Column<TData, TValue>`
- `title?: string`
- `options: { label: string; value: string }[]`

Behavior (ported from equipment toolbar style):
- Custom `<button>` options with manual checkmark icon
- Multi-select toggle via `column.setFilterValue()`
- Selected count badge (rounded-full primary)
- Header bar with Filter icon
- Footer clear button
- `'use client'` directive

Run test again. Expected: PASS.

**🔄 REFACTOR — Clean up**

Ensure < 250 lines, clean prop types, JSDoc header.
Run test again. Expected: still PASS.

**Commit:**
```bash
git add src/components/shared/table-filters/
git commit -m "feat: extract shared faceted multi-select table filter"
```

---

### Task 2: Migrate Equipment Toolbar To Shared Filter + Extract QR Scanner

**Files:**
- Modify: `src/components/equipment/equipment-toolbar.tsx`
- Create: `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
- Create: `src/components/equipment/useQRScanner.ts` (new hook)
- Create: `src/components/equipment/__tests__/useQRScanner.test.ts` (new test)

> **Audit Fix #2 (350-Line Limit):** Removing `DataTableFacetedFilter` (~115 lines) alone leaves ~363 lines. Extract QR scanner state/handlers into `useQRScanner` hook to bring toolbar under 300 lines.

**🔴 RED — Write failing tests**

Test A: `useQRScanner.test.ts`
```tsx
describe("useQRScanner", () => {
  it("starts scanning and sets camera active", () => { ... })
  it("handles scan success: stores code, shows action sheet", () => { ... })
  it("closes camera on handleCloseCamera", () => { ... })
  it("resets state on handleCloseActionSheet", () => { ... })
})
```

Test B: `equipment-toolbar.filters.test.tsx`
```tsx
describe("EquipmentToolbar filters", () => {
  it("renders shared FacetedMultiSelectFilter for each filter column in desktop mode", () => {
    // render toolbar with isMobile=false, useTabletFilters=false
    // assert 5 filter titles visible (Tình trạng, Khoa/Phòng, Người sử dụng, Phân loại, Nguồn kinh phí)
  })

  it("renders mobile filter sheet trigger instead of faceted filters on mobile", () => {
    // render toolbar with isMobile=true
    // assert "Lọc" button visible, no faceted filter titles
  })

  it("clears all filters when reset button clicked", () => {
    // apply filters, click "Xóa tất cả"
    // assert table.resetColumnFilters called
  })
})
```

Run both tests. Expected: FAIL.

**🟢 GREEN — Implement changes**

1. Extract `useQRScanner` hook (state + handlers for camera, scan, action sheet).
2. Remove local `DataTableFacetedFilter` component + interface from toolbar.
3. Import shared `FacetedMultiSelectFilter` from `@/components/shared/table-filters/FacetedMultiSelectFilter`.
4. Replace all 5 `<DataTableFacetedFilter>` usages with `<FacetedMultiSelectFilter>`.
5. Keep mobile sheet trigger, options menu, facility clear unchanged.

Run tests again. Expected: PASS.

Also run existing regression test:
`node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/EquipmentPageClient.attention-preset.test.tsx`
Expected: PASS.

**🔄 REFACTOR**

Verify `equipment-toolbar.tsx` is under 300 lines after extraction.
Verify `useQRScanner.ts` is under 80 lines.
Run all tests again. Expected: still PASS.

**Commit:**
```bash
git add src/components/equipment/
git commit -m "feat: reuse shared faceted filter in equipment toolbar, extract QR scanner hook"
```

---

### Task 3: Migrate Add Tasks Dialog — Search + Faceted Filters + Pagination

**Files:**
- Modify: `src/components/add-tasks-dialog.tsx`
- Create: `src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`

> **Audit Fix #3 (Debounce Strategy):** Keep `useSearchDebounce` as consumer-side debounce. `SearchInput` provides no internal debounce by design — the dialog continues to own its debounce strategy.

> **Audit Fix #4 (Client-Side Pagination):** The dialog loads all 5000 records client-side. Use TanStack Table's `getPaginationRowModel()` for client-side pagination. The shared `DataTablePagination` component works with TanStack Table's `table.getCanNextPage()` / `table.nextPage()` API, which is compatible with client-side pagination.

> **Audit Fix #7 (Memo Dependency):** Fix `totalSelectableRows` dependency from `[table]` (new object every render) to derive from stable values: `[equipment.length, columnFilters, existingEquipmentIds]` — or use `table.getFilteredRowModel().rows` inside the memo body.

**🔴 RED — Write failing tests**

```tsx
describe("AddTasksDialog filters and pagination", () => {
  it("uses shared SearchInput with debounce for search", async () => {
    // open dialog, mock equipment data
    // assert SearchInput rendered (type="search" attribute)
    // type search term, assert filtering after debounce
  })

  it("renders shared FacetedMultiSelectFilter for Khoa/Phòng, Người quản lý, Vị trí", async () => {
    // open dialog with equipment data
    // assert 3 filter titles visible
    // click filter option, assert column filter applied
  })

  it("paginates rows using client-side TanStack pagination", async () => {
    // open dialog with 30 equipment items
    // assert first page shows pageSize rows
    // click next page, assert different rows visible
    // assert DataTablePagination info shows correct counts
  })

  it("excludes already-added equipment from selection across pages", async () => {
    // open dialog with existingEquipmentIds=[1,2,3]
    // assert rows with those IDs have disabled checkboxes
  })

  it("clears all filters and search on clear button click", async () => {
    // apply filters + search, click "Xóa bộ lọc"
    // assert all filters and search cleared
  })
})
```

Run: `node scripts/npm-run.js run test:run -- src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx`
Expected: FAIL.

**🟢 GREEN — Implement migration**

1. Replace `import { Input }` with `import { SearchInput }` from shared.
2. Replace raw `<Input>` search with `<SearchInput value={searchTerm} onChange={setSearchTerm} />`.
3. Keep `useSearchDebounce` as consumer-side debounce.
4. Remove local `DataTableFacetedFilter` component + interface + `Separator` import.
5. Import `FacetedMultiSelectFilter` from shared.
6. Replace 3 `<DataTableFacetedFilter>` with `<FacetedMultiSelectFilter>`.
7. Add `getPaginationRowModel` import and add to `useReactTable` config.
8. Add `pagination` to table state, add `onPaginationChange`.
9. Add `<DataTablePagination table={table} />` at dialog footer.
10. Fix `totalSelectableRows` memo to not depend on `[table]`.

Run test again. Expected: PASS.

Also run regression:
`node scripts/npm-run.js run test:run -- src/app/(app)/maintenance/__tests__/MaintenanceContext.extended.test.tsx`
Expected: PASS.

**🔄 REFACTOR**

Verify `add-tasks-dialog.tsx` is under 350 lines.
Remove unused imports (`PlusCircle`, `DropdownMenuCheckboxItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuItem`, `Separator`).
Run all tests again. Expected: still PASS.

**Commit:**
```bash
git add src/components/add-tasks-dialog.tsx src/components/__tests__/add-tasks-dialog.filters-and-pagination.test.tsx
git commit -m "feat: centralize add-tasks dialog filters and pagination"
```

---

### Task 4: Regression + Quality Gates

**Files:**
- Modify if needed from fixes discovered by checks.

> **Audit Fix #5 (Mobile Regression):** Explicitly verify mobile filter sheet still works after toolbar refactor.

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
- [ ] Equipment page toolbar filters/search still work (desktop faceted filters).
- [ ] Equipment page **mobile filter sheet** still opens and filters correctly.
- [ ] Equipment page tablet breakpoint shows sheet trigger correctly.
- [ ] Maintenance Add Tasks dialog filter/search/selection still work.
- [ ] Add Tasks dialog pagination navigation works with filtered datasets.
- [ ] Selected equipment count updates correctly across pagination.
- [ ] Adding equipment from filtered+paginated view works.

Record verification notes in PR description.

**Step 5: Commit any verification fixes (if needed)**

```bash
git add <fix-files>
git commit -m "fix: resolve regressions from filter centralization"
```

---

### Task 5: Optional Follow-Up (Out Of Scope For First PR)

**Files (future):**
- `src/components/shared/table-filters/TableFilterToolbar.tsx` (new)
- `src/app/(app)/maintenance/_components/plan-filters-bar.tsx` (adapter migration candidate)

Keep out of first PR to reduce review risk.
`plan-filters-bar.tsx` already uses `SearchInput` and only has a facility `Select` — no faceted filters to centralize.

---

## Notes And Constraints

- Keep `'use client'` boundaries only on interactive components.
- Preserve current data-fetching ownership in page hooks; centralize UI primitives, not query logic.
- Avoid broad refactor of maintenance plan list filters in first PR.
- No barrel `index.ts` files — import directly per `bundle-barrel-imports` rule.
- `useSearchDebounce` remains consumer-side; `SearchInput` provides no internal debounce.
- Verify mobile filter sheet regression explicitly in Task 4.
- All files must stay under 350-line limit (target 250–300).
