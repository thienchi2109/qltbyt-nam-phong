# Equipment Command Filter Toolbar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Equipments filter/search toolbar to use the Stitch-approved Command Token overflow layout without changing data contracts, API behavior, filter ids, query keys, or backend code.

**Architecture:** Keep existing shared primitives and add presentation-only variants. Extend `FacetedMultiSelectFilter` with a command-token trigger style, then update `EquipmentToolbar` to show three primary command filters plus a compact `Bộ lọc` overflow command on desktop, while preserving the existing sheet mode for tablet/mobile.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Table, Vitest, Testing Library, existing shadcn-style UI primitives, lucide icons already used by this repo.

---

## Reference Inputs

- Stitch project: `7945259677379130435`
- Selected mockup: `Danh mục thiết bị - Overflow Command Layout`
- Stitch screen id: `0229a443d63c42a3a8bbf336d4bdf0e6`
- Indexed reference source: `Stitch HTML: Equipments Overflow Command Layout`
- Current toolbar: `src/components/equipment/equipment-toolbar.tsx`
- Shared layout: `src/components/shared/ListFilterSearchCard.tsx`
- Shared filter primitive: `src/components/shared/table-filters/FacetedMultiSelectFilter.tsx`
- Current tests:
  - `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
  - `src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`

## Non-Goals

- Do not change filter ids, TanStack column filter values, table callbacks, route sync, API calls, RPCs, database code, or export behavior.
- Do not replace `FilterBottomSheet`; keep `filterMode="sheet"` behavior intact.
- Do not roll the new layout into all pages in this pass. Build it safely for Equipments first, using shared components so later rollout is small.
- Do not copy Stitch HTML into production. Use it only as visual reference.

## File Map

- Modify: `src/components/shared/table-filters/FacetedMultiSelectFilter.tsx`
  - Add presentation-only trigger variant support for command tokens.
  - Preserve existing default outline trigger for all current callers.
- Modify: `src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`
  - Add tests for command-token rendering and selected-count badge.
- Modify: `src/components/equipment/equipment-toolbar.tsx`
  - Use command-token filters for Equipments faceted desktop mode.
  - Add progressive overflow: direct tokens for `Tình trạng`, `Khoa/Phòng`, `Phân loại`; overflow token `Bộ lọc` for `Người sử dụng`, `Nguồn kinh phí`.
  - Keep full mobile/tablet sheet mode unchanged.
- Modify: `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
  - Add regression tests for command token labels, overflow trigger, clear behavior, and sheet mode.

## Chunk 1: Shared Command Token Trigger

### Task 1: Add failing tests for command-token trigger

**Files:**

- Test: `src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx`

- [ ] **Step 1: Write failing test for command token variant**

Add tests that render `FacetedMultiSelectFilter` in controlled mode with:

```tsx
<FacetedMultiSelectFilter
  title="Khoa/Phòng"
  options={[{ label: "Khoa A", value: "khoa-a" }]}
  value={[]}
  onChange={vi.fn()}
  triggerVariant="command"
/>
```

Assert:

- Button exists with accessible name including `Khoa/Phòng`.
- Button has command-token classes or a stable attribute such as `data-trigger-variant="command"`.
- It still opens the popover when clicked.

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
node scripts/npm-run.js run test -- src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx -t "command token"
```

Expected: FAIL because `triggerVariant` does not exist.

- [ ] **Step 3: Implement minimal shared prop**

Modify `FacetedMultiSelectFilterProps`:

```ts
triggerVariant?: "outline" | "command"
triggerIcon?: React.ReactNode
```

Default to `"outline"`.

For `triggerVariant === "command"`:

- Use 38px-ish height (`h-9` is acceptable if repo uses 36px controls).
- Use 8px radius.
- Use tactile slate surface.
- Render optional leading icon zone.
- Render selected count badge when `selectedValues.size > 0`.
- Preserve `PopoverTrigger`, selected state, keyboard accessibility, and existing option list.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the same focused test.

Expected: PASS.

- [ ] **Step 5: Run full shared filter tests**

Run:

```bash
node scripts/npm-run.js run test -- src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx
```

Expected: PASS. Existing outline behavior remains unchanged.

## Chunk 2: Equipment Overflow Command Layout

### Task 2: Add failing toolbar tests

**Files:**

- Test: `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
- Modify: `src/components/equipment/equipment-toolbar.tsx`

- [ ] **Step 1: Write failing test for visible command tokens and overflow token**

In desktop faceted mode, assert visible:

- `Tình trạng`
- `Khoa/Phòng`
- `Phân loại`
- `Bộ lọc`
- `Xóa` only when filters are active

Assert `Người sử dụng` and `Nguồn kinh phí` are not direct top-level tokens in the default desktop overflow layout. They should be available through `Bộ lọc`.

- [ ] **Step 2: Write failing test that callbacks are preserved**

Assert:

- Clicking direct token still opens the existing faceted popover.
- Clicking `Xóa` calls `table.resetColumnFilters()`.
- Facility clear remains separate and still calls `onClearFacilityFilter` when facility filter state is active.

- [ ] **Step 3: Run focused toolbar tests and verify RED**

Run:

```bash
node scripts/npm-run.js run test -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx -t "command"
```

Expected: FAIL because Equipments still renders all filters as outline buttons and has no `Bộ lọc` overflow token.

- [ ] **Step 4: Implement minimal command layout in `EquipmentToolbar`**

Implementation shape:

- Keep `mobileFilterControl` unchanged for `filterMode === "sheet"`.
- Split desktop filters into:
  - primary command filters: status, department, classification
  - overflow command filters: user, funding source
- Use `FacetedMultiSelectFilter triggerVariant="command"` for all visible direct filters.
- Add a compact `Popover`/`DropdownMenu` trigger labeled `Bộ lọc` with count badge for selected overflow filters.
- Inside overflow content, render the two existing `FacetedMultiSelectFilter` controls or equivalent controlled UI without changing their column filter ids.
- Render compact clear token `Xóa` only when `isFiltered` is true.

- [ ] **Step 5: Run focused toolbar tests and verify GREEN**

Run:

```bash
node scripts/npm-run.js run test -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx
```

Expected: PASS.

## Chunk 3: Responsive Guardrails

### Task 3: Lock small desktop behavior

**Files:**

- Modify: `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
- Modify: `src/components/equipment/equipment-toolbar.tsx`
- Optional modify: `src/components/shared/ListFilterSearchCard.tsx`

- [ ] **Step 1: Write failing layout contract test**

Use DOM assertions rather than pixel assertions:

- The filter group has a stable wrapper class or `data-testid="equipment-command-filter-row"`.
- The wrapper allows wrapping or overflow-safe layout (`flex-wrap`, two-line safe layout, or progressive overflow).
- Search container keeps `min-w-0` so it can shrink without pushing actions off-screen.

- [ ] **Step 2: Run focused test and verify RED if missing**

Run:

```bash
node scripts/npm-run.js run test -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx -t "responsive"
```

Expected: FAIL if wrappers/classes are not yet present.

- [ ] **Step 3: Implement responsive classes only**

Preferred layout:

- Search and facility remain visible.
- Command filters use progressive overflow on standard desktop.
- Wide screens may show all filters only if there is enough room, but do not require that in this pass.
- Avoid fixed widths that make the search field unusable.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the same responsive test.

Expected: PASS.

## Chunk 4: Visual Verification

### Task 4: Browser check against Stitch intent

**Files:**

- No source changes unless a visual issue is found.

- [ ] **Step 1: Run verification chain for TS/TSX changes**

Run through context-mode as one batch:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test -- src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx
node scripts/npm-run.js run react-doctor
```

Expected: all pass.

- [ ] **Step 2: Start dev server**

Run the repo's normal dev command, then open `/equipment`.

- [ ] **Step 3: Verify desktop widths**

Check:

- 1440px: command tokens look like Stitch `Overflow Command Layout`.
- 1280px: row does not overlap or compress search to unusable width.
- 1024px: overflow token keeps the toolbar usable.
- Tablet/mobile: existing filter sheet mode still appears.

- [ ] **Step 4: Capture screenshots**

Save screenshots only if needed for review handoff. Do not commit generated screenshots unless the repo already tracks UI snapshots.

## Chunk 5: Final Checks and Handoff

- [ ] **Step 1: Run Code Review Graph changed-file context**

Use Code Review Graph `detect_changes` or review context with minimal detail before final review.

- [ ] **Step 2: Inspect git diff**

Route `git diff` through context-mode and verify:

- No API/backend/query contract changes.
- No route sync changes.
- No unrelated UI refactors.

- [ ] **Step 3: Commit**

Commit after all tests pass:

```bash
git add src/components/shared/table-filters/FacetedMultiSelectFilter.tsx \
  src/components/shared/table-filters/__tests__/FacetedMultiSelectFilter.test.tsx \
  src/components/equipment/equipment-toolbar.tsx \
  src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx
git commit -m "feat(equipment): modernize filter command tokens"
```

- [ ] **Step 4: Push**

```bash
git pull --rebase
git push
git status
```

Expected: branch is up to date with remote.
