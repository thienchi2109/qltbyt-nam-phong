# Device Quota Categories Split-Screen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/device-quota/categories` into a 40:60 split-screen interface where users can scan category quota status on the left and inspect assigned equipment for the selected category on the right.

**Architecture:** Keep the current category/RPC/data contracts intact. Reuse existing React components and extract only small shared presentation primitives when that removes duplication across the categories and mapping flows. The redesign changes layout, selection state, and table presentation only.

**Tech Stack:** Next.js App Router, React client components, TanStack Query, existing shadcn/ui primitives, Tailwind CSS, Vitest/Testing Library, React Doctor.

---

## Confirmed Product Decisions

- Target screen: `/device-quota/categories`, based on `Current_layout.png`.
- Split ratio on desktop: **40:60** left:right.
- Desktop scrolling: each pane has independent vertical scroll.
- Horizontal scrolling: only the right-side equipment table may scroll horizontally.
- Mobile/tablet small: stack panes vertically and use page scroll; keep table horizontal scroll as needed.
- Font: keep the repo's existing global font. Do not add Manrope, Inter, JetBrains Mono, `next/font`, or a scoped font system.
- Scope: UI/React only. Do not change Supabase RPCs, DB migrations, RBAC guards, import/export behavior, create/edit/delete mutations, or quota/count calculations.
- Reuse-first rule: use current React components or extract shared components before adding new code. Avoid duplicate split-pane, badge, progress, and equipment-row implementations.

## Current Code Anchors

- Page wrapper and permission guard: `src/app/(app)/device-quota/categories/page.tsx`
- Category context/data/search/mutations: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryContext.tsx`
- Current category tree: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`
- Current category row/group rendering: `src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx`
- Assigned-equipment table: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx`
- Quota status primitive: `src/app/(app)/device-quota/categories/_components/QuotaProgressBar.tsx`
- Category helpers/styles: `src/app/(app)/device-quota/categories/_components/category-tree-utils.ts`
- Existing split-view primitive to reuse/extract from: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingSplitView.tsx`
- Existing tests to extend: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx` and `DeviceQuotaCategoryAssignedEquipment.test.tsx`

## Design Contract

- Left pane is a scan surface:
  - Show category code, category name, classification label (`Loại A/B`), and quota status such as `1/-` or `0/18`.
  - Keep root collapse/expand behavior for tree scanning.
  - Clicking a category row selects it instead of opening an inline equipment panel.
  - Enter/Space selects the focused row.
  - No horizontal scroll in this pane.
- Right pane is a read surface:
  - Show selected category context: breadcrumb/root, code, full category title, and description.
  - Render assigned equipment in a focused full-width table using the existing `DeviceQuotaCategoryAssignedEquipment` data/RPC path.
  - Keep status badges for `Hoạt động`, `Bảo trì`, and `Hỏng`; tune classes only if needed for legibility.
- Long text behavior:
  - Left category names: clamp to 2 lines with ellipsis; expose full text through accessible `title`/tooltip/aria label.
  - Right category title: wrap up to 2-3 lines; description clamps to 2 lines.
  - Equipment table: `Tên thiết bị` is the priority column and clamps to 2 lines; code/model/serial/department ellipsis to 1 line; status/action columns use fixed widths.
  - Right table uses `overflow-x-auto` and a stable minimum table width so long content cannot overlap badges or actions.

## Task 1: Write Failing Selection And Layout Tests

**Files:**
- Modify: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx`
- Modify or create focused tests near: `src/app/(app)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx`

- [ ] Add a test that renders the category page/tree with multiple categories and verifies there is one navigation/list pane and one detail pane.
- [ ] Add a test that the default selected category is deterministic:
  - prefer the first visible leaf with assigned equipment,
  - otherwise first visible leaf,
  - otherwise first visible root.
- [ ] Add a test that clicking a category row updates the right detail pane without rendering the assigned-equipment table inline under the row.
- [ ] Add a keyboard test that Enter/Space on a row selects it.
- [ ] Add long-name regression cases for category and equipment names, asserting clamp/ellipsis classes or accessible full text attributes are present.
- [ ] Run the focused tests and confirm the new assertions fail before implementation.

Expected command:

```bash
node scripts/npm-run.js vitest run src/app/\(app\)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx src/app/\(app\)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx
```

## Task 2: Extract A Shared Split-Pane Primitive

**Files:**
- Create or modify: `src/app/(app)/device-quota/_components/DeviceQuotaSplitPane.tsx`
- Modify: `src/app/(app)/device-quota/mapping/_components/DeviceQuotaMappingSplitView.tsx`

- [ ] Move the generic layout behavior from `DeviceQuotaMappingSplitView` into `DeviceQuotaSplitPane`.
- [ ] Support a `variant` or class override for `ratio="40-60"` while preserving the existing mapping screen behavior.
- [ ] Desktop classes must produce a 40:60 left:right split, for example `lg:grid-cols-[minmax(320px,40%)_minmax(0,60%)]`.
- [ ] Add independent desktop vertical scrolling to each pane with stable max-height.
- [ ] Keep mobile as stacked panes.
- [ ] Update `DeviceQuotaMappingSplitView` to delegate to the shared primitive instead of duplicating layout code.

Do not add unrelated styling or global CSS.

## Task 3: Convert Category Tree To A Selectable Left Pane

**Files:**
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryTree.tsx`
- Modify or split: `src/app/(app)/device-quota/categories/_components/CategoryGroup.tsx`
- Reuse: `src/app/(app)/device-quota/categories/_components/QuotaProgressBar.tsx`

- [ ] Introduce selected-category state at the categories screen/tree level.
- [ ] Preserve current root collapse/expand state independently from selected category.
- [ ] Remove inline rendering of `DeviceQuotaCategoryAssignedEquipment` from category rows.
- [ ] Render row states for selected, hover, disabled/mutating, and focus-visible.
- [ ] Keep classification badge logic from `CLASSIFICATION_STYLES`.
- [ ] Keep aggregated count/quota logic from `buildAggregatedCounts` and `buildAggregatedQuotas`.
- [ ] Add accessible labels that include code, full category name, classification, and quota status.
- [ ] Clamp category names to two lines in the left pane and prevent horizontal overflow.

Implementation should keep `CategoryGroup.tsx` under the repo line-size rules. If the file remains too large after edits, split row pieces into focused files such as `DeviceQuotaCategoryListRow.tsx`.

## Task 4: Build The Right Detail Pane

**Files:**
- Create or modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryDetailPane.tsx`
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryAssignedEquipment.tsx`
- Modify: `src/app/(app)/device-quota/categories/page.tsx`

- [ ] Create a detail pane that receives the selected category, aggregated quota/count metadata, and `donViId`.
- [ ] Show breadcrumb/root context, category code, category title, description, classification, and quota status.
- [ ] Render `DeviceQuotaCategoryAssignedEquipment` in full-width mode for the selected category.
- [ ] Add a prop to `DeviceQuotaCategoryAssignedEquipment` for presentation mode if needed, such as `variant="inline" | "panel"`, reusing the same query and row component.
- [ ] In panel mode, remove left indent styles and wrap the table in `overflow-x-auto`.
- [ ] Keep current loading, empty, and error copy:
  - `Không thể tải danh sách thiết bị được gán`
  - `Chưa có thiết bị nào được gán`
- [ ] Ensure long equipment names clamp to two lines and non-priority columns ellipsis to one line.

If a "Gán thiết bị" action is not already wired from existing behavior, do not invent a new workflow. Leave the action out or keep it as an existing navigation/action only if the current code already supports it.

## Task 5: Compose The Categories Page

**Files:**
- Modify: `src/app/(app)/device-quota/categories/page.tsx`
- Modify: `src/app/(app)/device-quota/categories/_components/DeviceQuotaCategoryToolbar.tsx` only if layout requires moving search/actions.

- [ ] Keep `AuthenticatedPageBoundary` and `isEquipmentManagerRole()` exactly in place.
- [ ] Keep `DeviceQuotaCategoryProvider` as the state/data boundary.
- [ ] Keep top page title and import/export/create actions.
- [ ] Replace the single large card/tree layout with `DeviceQuotaSplitPane`.
- [ ] Pass the category navigation pane as left content and selected-category detail pane as right content.
- [ ] Ensure toolbar search still filters categories and selection resets only when the selected item is no longer visible.
- [ ] Keep dialogs mounted at page level.

## Task 6: Verification

Run checks in the repo-required order for TypeScript/React diffs:

```bash
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run typecheck
node scripts/npm-run.js vitest run src/app/\(app\)/device-quota/categories/__tests__/DeviceQuotaCategoryTree.test.tsx src/app/\(app\)/device-quota/categories/__tests__/DeviceQuotaCategoryAssignedEquipment.test.tsx
node scripts/npm-run.js npx react-doctor@latest . --verbose -y --project nextn --offline --diff main
```

Manual/browser checks:

- [ ] Desktop: split ratio visually reads as 40:60.
- [ ] Desktop: left and right panes scroll vertically independently.
- [ ] Desktop: only the right equipment table scrolls horizontally.
- [ ] Mobile/tablet small: panes stack vertically and remain readable.
- [ ] Long category and equipment names do not overlap status badges, action buttons, or adjacent columns.
- [ ] Search, create, edit, delete, import, and download actions remain reachable.

