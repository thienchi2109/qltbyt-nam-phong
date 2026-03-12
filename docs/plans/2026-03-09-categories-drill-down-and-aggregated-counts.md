# Categories Drill-down + Aggregated Counts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
>
> **Planning note:** This document is intentionally structured to match the `/writing-plans` skill: exact file paths, TDD-first execution, Windows-safe commands, small checkpoints, and phase-based subtasks.

**Goal:** Fix incorrect intermediate category counts on `/device-quota/categories` and add a leaf-only drill-down panel that shows equipment assigned to a clicked leaf category.

**Architecture:** Keep the backend unchanged. Compute aggregated counts entirely in the frontend from the full category tree (`allCategories`) so intermediate categories inherit leaf equipment totals even when the visible tree is search-filtered. Only leaf categories with assigned equipment can expand, and the expansion panel fetches equipment through the existing RPC proxy using `callRpc({ fn: 'dinh_muc_thiet_bi_by_nhom' })`.

**Tech Stack:** Next.js App Router client components, React 18, TypeScript, TanStack Query v5, Vitest, React Testing Library, existing RPC proxy via `src/lib/rpc-client.ts`.

---

## Scope and invariants

- **No backend work.** Do not add migrations. Do not modify RPC SQL. Do not change the RPC whitelist.
- **Leaf-only drill-down.** Equipment is only assigned to leaf categories.
- **Full-tree totals.** Aggregated counts must be built from `allCategories`, not search-filtered `categories`, so search does not distort totals.
- **No double-counting.** The root group header must use `aggregatedCounts.get(root.id)` directly, not `root + child aggregated counts`.
- **RPC-only data access.** All data fetching must continue through `callRpc()` and `/api/rpc/[fn]`.
- **Grep-friendly naming.** The new component file must use the module prefix: `DeviceQuotaCategoryAssignedEquipment.tsx`.
- **Windows-safe commands only.** Use `node scripts/npm-run.js ...` instead of raw `npm`/`npx` in the plan.

---

## Files in scope

**Modify**
- `src/app/(app)/device-quota/categories/_components/category-tree-utils.ts`
- `src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx`
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`
- `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx`

**Create**
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx`
- `src/app/(app)/device-quota/categories/__tests__/category-tree-utils.test.ts`
- `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx`

**Reference while implementing**
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx`
- `src/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives.tsx`
- `src/lib/rpc-client.ts`

---

## Current code anchors

Use these locations as the baseline when implementing:

- `src/app/(app)/device-quota/categories/_components/category-tree-utils.ts:31-58`
  - Existing `groupByRoot()` helper assumes depth-first order.
- `src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx:145-149`
  - Current root total logic; this is where double-counting must be avoided.
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx:20-33`
  - Current tree reads `categories` only; this must expand to include `allCategories` and `donViId`.
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx:241-287`
  - Context already exposes `donViId`, `allCategories`, and filtered `categories`.
- `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx:363-387`
  - Context value confirms those fields are public API for the tree.
- `src/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives.tsx:14-24`
  - Existing `EquipmentPreviewItem` type.
- `src/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives.tsx:69-92`
  - Existing `MappingPreviewLoadingState`.
- `src/app/api/rpc/[fn]/route.ts:145`
  - `dinh_muc_thiet_bi_by_nhom` is already whitelisted.

---

## Implementation overview

This work is split into **4 phases**.

1. **Phase 1: Utility foundation**
   - Add aggregated count and leaf-detection helpers with unit tests.
2. **Phase 2: Assigned-equipment panel**
   - Add the leaf-only expansion panel with isolated component tests.
3. **Phase 3: Tree wiring and interactions**
   - Connect aggregated totals and expansion state into the visible tree.
4. **Phase 4: Verification and handoff**
   - Run focused tests, regression checks, and manual verification.

---

## Phase 1: Utility foundation

### Task 1.1: Write failing utility tests

**Files:**
- Create: `src/app/(app)/device-quota/categories/__tests__/category-tree-utils.test.ts`
- Reference: `src/app/(app)/device-quota/categories/_types/categories.ts`
- Reference: `src/app/(app)/device-quota/categories/_components/category-tree-utils.ts`

**Step 1: Write the failing test file**

Add tests for these cases:

1. **3-level tree aggregation**
   - root `1`
   - intermediate `2`, `3`
   - leaves `4`, `5`, `6`
   - only leaves have `so_luong_hien_co > 0`
   - expected:
     - `aggregatedCounts.get(4) === leafCount`
     - `aggregatedCounts.get(2) === sum(descendant leaves under 2)`
     - `aggregatedCounts.get(1) === sum(all descendant leaves under root 1)`

2. **Single-level tree**
   - multiple roots with no children
   - expected aggregated counts equal raw `so_luong_hien_co`

3. **Empty tree**
   - expected `Map` size `0`
   - expected `Set` size `0`

4. **Leaf detection**
   - `getLeafIds()` includes nodes with no children
   - `getLeafIds()` excludes roots/intermediate categories that have descendants

**Step 2: Run the tests to verify they fail**

Run:
```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/category-tree-utils.test.ts"
```

Expected:
- FAIL because `buildAggregatedCounts` and `getLeafIds` do not exist yet.

### Task 1.2: Implement `buildAggregatedCounts()` and `getLeafIds()`

**Files:**
- Modify: `src/app/(app)/device-quota/categories/_components/category-tree-utils.ts`
- Test: `src/app/(app)/device-quota/categories/__tests__/category-tree-utils.test.ts`

**Step 1: Add the exact function signatures**

```ts
export function buildAggregatedCounts(
  categories: CategoryListItem[]
): Map<number, number>

export function getLeafIds(
  categories: CategoryListItem[]
): Set<number>
```

**Step 2: Implement the minimal aggregation logic**

Requirements:
- Build a `Map<number, number[]>` or equivalent `parentId -> childIds` index from the flat list.
- Seed each node’s total with its own `so_luong_hien_co`.
- Traverse bottom-up so descendants contribute to ancestors.
- Preserve raw leaf totals.
- Do not assume the visible list is search-filtered; this helper should work for the full tree.

Recommended implementation details:
- Build `byId` and `childrenByParentId` maps first.
- Iterate the original list in reverse order (the data is depth-first ordered by `sort_path`).
- For each node, add its current aggregated total into its parent’s aggregated total.
- Return `Map<categoryId, aggregatedTotal>`.

**Step 3: Implement `getLeafIds()`**

Requirements:
- A node is a leaf if no category has `parent_id === node.id`.
- Return a `Set<number>` of leaf IDs.
- Use a child-parent scan or `Set` of parent IDs.

**Step 4: Run the tests to verify they pass**

Run:
```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/category-tree-utils.test.ts"
```

Expected:
- PASS

**Step 5: Commit checkpoint**

```bash
git add "src/app/(app)/device-quota/categories/_components/category-tree-utils.ts" "src/app/(app)/device-quota/categories/__tests__/category-tree-utils.test.ts"
git commit -m "test: add category aggregation utility coverage"
```

---

## Phase 2: Leaf assigned-equipment panel

### Task 2.1: Write failing tests for the assigned-equipment panel

**Files:**
- Create: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx`
- Reference: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoriesPage.test.tsx`
- Reference: `src/app/(app)/device-quota/mapping/_components/MappingPreviewPrimitives.tsx`
- Reference: `src/lib/rpc-client.ts`

**Step 1: Set up local test harness**

Follow the same pattern already used in `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoriesPage.test.tsx:35-50`:
- `vi.mock('@/lib/rpc-client', () => ({ callRpc: vi.fn() }))`
- Wrap renders with `QueryClientProvider`
- Use a `QueryClient` with `retry: false`

**Step 2: Write the failing test cases**

Cover these cases:

1. **Loading state**
   - mock pending query
   - expect `MappingPreviewLoadingState` skeletons to render

2. **Populated table**
   - mock `callRpc` resolving to two `EquipmentPreviewItem`s
   - expect all visible columns:
     - `Mã TB`
     - `Tên thiết bị`
     - `Model`
     - `Serial`
     - `Khoa phòng`
     - `Tình trạng`

3. **Empty state**
   - mock `callRpc` resolving to `[]`
   - expect a read-only empty-state message

4. **Read-only behavior**
   - confirm no “Loại bỏ” / “Khôi phục” buttons appear

5. **Correct RPC arguments**
   - expect `callRpc` called with:

```ts
{
  fn: 'dinh_muc_thiet_bi_by_nhom',
  args: { p_nhom_id: nhomId, p_don_vi: donViId }
}
```

**Step 3: Run the tests to verify they fail**

Run:
```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx"
```

Expected:
- FAIL because the component does not exist yet.

### Task 2.2: Implement `DeviceQuotaCategoryAssignedEquipment`

**Files:**
- Create: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx`
- Test: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx`

**Step 1: Create the component with these props**

```ts
interface DeviceQuotaCategoryAssignedEquipmentProps {
  nhomId: number
  donViId: number | null
}
```

**Step 2: Add the query**

Use `useQuery` with:

```ts
queryKey: ['dinh_muc_thiet_bi_by_nhom', { nhomId, donViId }]
queryFn: () => callRpc<EquipmentPreviewItem[]>({
  fn: 'dinh_muc_thiet_bi_by_nhom',
  args: { p_nhom_id: nhomId, p_don_vi: donViId },
})
enabled: !!donViId
```

**Step 3: Render the three states**

- **Loading:** `MappingPreviewLoadingState`
- **Empty:** compact read-only empty state
- **Data:** compact table-like layout with the 6 required columns

Implementation constraints:
- Reuse `EquipmentPreviewItem` from mapping primitives.
- Keep this component read-only.
- Do not add exclude/restore toggles.
- Style the panel as a subtle nested block:
  - `ml-6`
  - `bg-muted/30`
  - `border-l-2 border-l-primary/20`
  - rounded corners / compact padding

**Step 4: Run the tests to verify they pass**

Run:
```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx"
```

Expected:
- PASS

**Step 5: Commit checkpoint**

```bash
git add "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx" "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx"
git commit -m "feat: add leaf category assigned equipment panel"
```

---

## Phase 3: Tree wiring and interactions

### Task 3.1: Extend tree tests before wiring the UI

**Files:**
- Modify: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`

**Step 1: Add failing tests for the new behavior**

Extend the tree test file to cover:

1. **Intermediate row shows aggregated count from descendants**
   - example: level-2 node raw count `0`, child leaves `2` and `3`
   - expected visible fraction uses `5/max`

2. **Root header uses root aggregated total only once**
   - example: root raw `0`, descendants total `5`
   - expected root shows `5/<sum of quotas>`
   - ensure it does **not** show a doubled total like `10/...`

3. **Leaf row with equipment gets an expand button**
   - button exists
   - `aria-expanded="false"` initially

4. **Clicking the expand button opens the panel**
   - button toggles to `aria-expanded="true"`
   - assigned-equipment panel renders beneath the row

5. **Intermediate row has no expand button**

6. **Zero-count leaf has no expand button**

**Step 2: Run the tests to verify they fail**

Run:
```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx"
```

Expected:
- FAIL because the tree does not compute aggregated totals for children and does not support expansion.

### Task 3.2: Wire `DeviceQuotaCategoryTree` to full-tree helpers

**Files:**
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/category-tree-utils.ts`

**Step 1: Expand the context usage**

Change the tree component to read:

```ts
const {
  categories,
  allCategories,
  donViId,
  isLoading,
  searchTerm,
  openCreateDialog,
  openEditDialog,
  openDeleteDialog,
  mutatingCategoryId,
} = useDeviceQuotaCategoryContext()
```

**Step 2: Add memoized derived state**

```ts
const aggregatedCounts = React.useMemo(
  () => buildAggregatedCounts(allCategories),
  [allCategories]
)

const leafIds = React.useMemo(
  () => getLeafIds(allCategories),
  [allCategories]
)

const [expandedCategoryId, setExpandedCategoryId] = React.useState<number | null>(null)

const handleToggleExpand = React.useCallback((id: number) => {
  setExpandedCategoryId((prev) => (prev === id ? null : id))
}, [])
```

**Step 3: Pass the new props into each group**

Every `<CategoryGroup>` must receive:
- `aggregatedCounts`
- `leafIds`
- `expandedCategoryId`
- `onToggleExpand={handleToggleExpand}`
- `donViId`

**Step 4: Keep search behavior correct**

Important:
- `groupByRoot(categories)` still drives the visible rows.
- `buildAggregatedCounts(allCategories)` drives the displayed totals.
- This means search hides rows but totals remain full-tree totals by design.

### Task 3.3: Wire `CategoryGroup` and `CategoryChildRow`

**Files:**
- Modify: `src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/QuotaProgressBar.tsx`
- Reference: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx`

**Step 1: Update the child-row props**

Use this exact prop shape:

```ts
interface CategoryChildRowProps {
  category: CategoryListItem
  onEdit: (category: CategoryListItem) => void
  onDelete: (category: CategoryListItem) => void
  isMutating: boolean
  aggregatedCount: number
  isLeaf: boolean
  isExpanded: boolean
  onToggleExpand: (id: number) => void
  donViId: number | null
}
```

**Step 2: Update the group props**

```ts
interface CategoryGroupProps {
  root: CategoryListItem
  children: CategoryListItem[]
  onEdit: (category: CategoryListItem) => void
  onDelete: (category: CategoryListItem) => void
  mutatingCategoryId: number | null
  aggregatedCounts: Map<number, number>
  leafIds: Set<number>
  expandedCategoryId: number | null
  onToggleExpand: (id: number) => void
  donViId: number | null
}
```

**Step 3: Replace raw counts with aggregated counts**

Child rows:
- replace `category.so_luong_hien_co` with `aggregatedCount`

Root header:
- replace the current `totalEquipment` calculation with:

```ts
const totalEquipment = aggregatedCounts.get(root.id) ?? root.so_luong_hien_co
```

Do **not** sum `root + children aggregated counts`, because that will double-count descendants.

**Step 4: Add leaf-only expand affordance**

Rules:
- A row is expandable only if:
  - `isLeaf === true`
  - `aggregatedCount > 0`
- Wrap the quota area in a real button only when expandable.
- Use:
  - `type="button"`
  - `aria-expanded={isExpanded}`
  - descriptive `aria-label`
- Non-expandable rows render the same quota visuals without button semantics.

**Step 5: Render the panel under the row**

When `isExpanded` is true:

```tsx
<DeviceQuotaCategoryAssignedEquipment
  nhomId={category.id}
  donViId={donViId}
/>
```

Render it directly beneath the child row inside the same list flow.

**Step 6: Preserve action menu behavior**

- The dropdown actions must continue to work.
- The expand button must not interfere with menu interaction.
- If needed, stop propagation from the expand button.
- Do not make the entire row clickable.

**Step 7: Run the tree tests to verify they pass**

Run:
```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx"
```

Expected:
- PASS

**Step 8: Commit checkpoint**

```bash
git add "src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx" "src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx" "src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx"
git commit -m "feat: add aggregated counts and leaf drill-down in category tree"
```

---

## Phase 4: Verification and handoff

### Task 4.1: Run the focused categories test suite

**Files:**
- Test: `src/app/(app)/device-quota/categories/__tests__/`

**Step 1: Run all category tests**

```bash
node scripts/npm-run.js npx vitest run "src/app/(app)/device-quota/categories/__tests__/"
```

Expected:
- PASS

### Task 4.2: Run broader regression tests

**Step 1: Run the full Vitest suite**

```bash
node scripts/npm-run.js npx vitest run
```

Expected:
- PASS, or only unrelated pre-existing failures if already known and documented.

### Task 4.3: Manual verification checklist

Use this exact manual test flow:

1. Open `/device-quota/mapping`.
2. Assign equipment to at least two leaf categories under the same intermediate parent.
3. Open `/device-quota/categories`.
4. Verify the **intermediate category** now shows the **sum of descendant leaf equipment** instead of `0/-`.
5. Verify the **root group header** total is correct and not doubled.
6. Click a **leaf category with equipment**.
7. Verify the assigned-equipment panel expands beneath that row.
8. Verify the panel shows:
   - `Mã TB`
   - `Tên thiết bị`
   - `Model`
   - `Serial`
   - `Khoa phòng`
   - `Tình trạng`
9. Click the same leaf again and verify the panel collapses.
10. Verify a **leaf with 0 equipment** has no expand affordance.
11. Verify an **intermediate category** has no expand affordance.
12. Enter a search term that filters the visible tree.
13. Verify visible rows still show **full-tree aggregated totals**, not search-subset totals.
14. Verify edit/delete menus still work and do not trigger expansion accidentally.

### Task 4.4: Final quality gate

Before declaring the feature complete, confirm all of the following:

- [ ] `category-tree-utils.test.ts` passes
- [ ] `DeviceQuotaCategoryAssignedEquipment.test.tsx` passes
- [ ] `DeviceQuotaCategoryTree.test.tsx` passes
- [ ] full categories test suite passes
- [ ] full Vitest suite passes or unrelated failures are explicitly noted
- [ ] manual verification checklist completed
- [ ] no backend files changed

---

## Notes for the implementing agent

- Keep the implementation small. Do not introduce reusable abstractions unless they remove duplication already present in the touched files.
- Prefer direct imports over barrel imports.
- Do not fetch data outside `callRpc()`.
- Do not add feature flags or backend compatibility shims.
- Do not broaden drill-down beyond leaf categories.
- Do not change the search filter behavior; only change how counts are computed.

---

## Suggested execution order summary

1. Add utility tests.
2. Implement utility helpers.
3. Add assigned-equipment panel tests.
4. Implement the assigned-equipment panel.
5. Extend tree tests for aggregation and expansion.
6. Wire tree state and row interactions.
7. Run focused suite.
8. Run regression suite.
9. Complete manual verification.

---

## Done condition

This plan is complete when:
- intermediate categories no longer show `0/-` when descendant leaves have equipment,
- root headers show correct aggregated totals without double-counting,
- only leaf categories with equipment can expand,
- the expansion panel shows assigned equipment through the existing RPC,
- all verification steps above pass.
