# Issue #691 Mobile Compact HeroUI Top Controls TDD Plan

> **For agentic workers:** Use `superpowers:test-driven-development` for implementation. Keep #691 limited to mobile compact top-controls. Filter sheet internals are tracked separately in #710.

**Goal:** Apply the existing desktop Equipments HeroUI top-controls adapter pattern to the live mobile compact controls in `src/components/equipment/equipment-toolbar.tsx`.

**Architecture:** Keep HeroUI behind the existing Equipments-local adapter in `src/components/equipment/heroui-pilot/`. Replace only the compact toolbar filter trigger and options menu that render when `filterMode === "sheet"`, while preserving `ListFilterSearchCard` as the compact shell.

**Tech Stack:** Next.js, React, TypeScript, HeroUI, Vitest, Testing Library.

---

## Scope

- Migrate the compact/mobile filter trigger and active filter count in `EquipmentToolbar`.
- Migrate the compact/mobile options menu for column dialog, template download, and export.
- Remove `@/components/ui/button`, `@/components/ui/badge`, and `@/components/ui/dropdown-menu` imports from `equipment-toolbar.tsx` if they become unused.
- Keep `src/components/equipment/filter-bottom-sheet.tsx` unchanged; filter sheet internals are #710.
- Do not touch table/list rendering, pagination, data hooks, row actions, dialogs, bulk actions, QR scanner behavior, search behavior, or mobile floating add/import actions.

## Implementation Tasks

### Task 1: Lock Current Mobile Compact Behavior

**Files:**

- Modify: `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`

- [ ] Add or update a focused compact-mode test proving the filter trigger still calls `onOpenFilterSheet`.
- [ ] Assert the compact trigger still shows the active filter count when filters are active.
- [ ] Add or update a focused compact-mode test proving the options menu still calls `onOpenColumnsDialog`, `onDownloadTemplate`, and `onExportData`.
- [ ] Remove test expectations that require Radix/Shadcn dropdown mechanics for compact top-controls.
- [ ] Run:

```bash
node scripts/npm-run.js run test:run -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx
```

Expected before implementation: at least one new assertion fails because compact controls are still Shadcn/Radix-backed.

### Task 2: Migrate Compact Top Controls Through The HeroUI Adapter

**Files:**

- Modify: `src/components/equipment/equipment-toolbar.tsx`
- Modify only if needed: `src/components/equipment/heroui-pilot/controls.tsx`
- Modify only if needed: `src/components/equipment/heroui-pilot/index.ts`

- [ ] Replace the compact filter trigger with `EquipmentHeroButton` or a minimal adapter-backed equivalent.
- [ ] Replace the compact options `DropdownMenu` with `EquipmentHeroDropdown`.
- [ ] Preserve callback behavior:
  - filter trigger calls `onOpenFilterSheet`
  - options call `onOpenColumnsDialog`, `onDownloadTemplate`, `onExportData`
  - export disabled state still follows `isExporting`
- [ ] Keep `ListFilterSearchCard` as the compact shell.
- [ ] Remove unused Shadcn imports from `equipment-toolbar.tsx`.
- [ ] Do not add direct `@heroui/react` imports outside `src/components/equipment/heroui-pilot/`.

### Task 3: Green Tests And Boundary Checks

**Files:**

- Same files as Tasks 1-2.

- [ ] Run focused toolbar tests:

```bash
node scripts/npm-run.js run test:run -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx src/components/equipment/__tests__/equipment-toolbar.heroui-top-controls.test.tsx
```

- [ ] Confirm `filter-bottom-sheet.tsx` has no diff.
- [ ] Confirm `equipment-toolbar.tsx` no longer imports compact-only Shadcn/Radix controls if they are unused.

## Verification

Run the repo gates in this order before commit/push:

```bash
node scripts/npm-run.js run format:check
node scripts/npm-run.js run verify:heroui-boundary
node scripts/npm-run.js run verify:no-explicit-any
node scripts/npm-run.js run verify:dedupe
node scripts/npm-run.js run typecheck
node scripts/npm-run.js run test:run -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx src/components/equipment/__tests__/equipment-toolbar.heroui-top-controls.test.tsx
node scripts/npm-run.js run react-doctor
```

## Acceptance Criteria

- `EquipmentToolbar` mobile compact top-controls use the same bounded HeroUI adapter direction as desktop top-controls.
- `filter-bottom-sheet.tsx` remains unchanged and deferred to #710.
- Mobile compact behavior remains wired: filter sheet trigger, active filter count, options callbacks, search clear, QR scan, add/import, and selection actions.
- No direct `@heroui/react` imports are added outside the approved boundary.
- Live Shadcn code outside the compact top-controls slice remains intact.
