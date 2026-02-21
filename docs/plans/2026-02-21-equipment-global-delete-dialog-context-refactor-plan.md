# Equipment Global Delete Dialog Context Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace duplicated equipment delete confirmation dialogs with one global dialog flow managed by `EquipmentDialogContext`, while preserving existing RBAC and user behavior.

**Architecture:** Keep `EquipmentDialogContext` as orchestration-only state/actions, and render a single shared `EquipmentDeleteDialog` host inside the equipment dialog host tree. Keep delete mutation execution in the shared dialog component (not in context), then route success behavior based on the action source (`EquipmentActionsMenu` vs `EquipmentDetailDialog`). Both `EquipmentActionsMenu` and `EquipmentDetailDialog` consume context directly to open the global delete dialog — no prop injection.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, Radix `AlertDialog`, Vitest + Testing Library

---

### Task 1: Extend Equipment Dialog Context Contract for Global Delete

**Files:**
- Modify: `src/app/(app)/equipment/_components/EquipmentDialogContext.tsx`
- Modify: `src/app/(app)/equipment/_hooks/useEquipmentContext.ts` (type consumption only, no runtime behavior change)
- Test: `src/app/(app)/equipment/__tests__/EquipmentDialogContext.test.tsx`

**Step 1: Add delete dialog state to context state model**

- Add a typed `deleteDialog` state segment to `DialogState`:
  - `isDeleteOpen: boolean` — explicit open flag (do **not** derive from target; Radix exit animations require the target to stay populated while `isOpen` is `false` so the dialog content does not flash blank mid-fade)
  - `deleteTarget: Equipment | null` — target equipment; cleared only after dialog has fully closed
  - `deleteSource: "actions_menu" | "detail_dialog" | null` — typed discriminator so TypeScript enforces handling of both cases downstream

**Step 2: Add delete dialog actions to context interface**

- Add:
  - `openDeleteDialog(equipment, source)`
  - `closeDeleteDialog()`

**Step 3: Wire actions into provider callbacks and memoized value**

- Implement with `useCallback`.
- `closeDeleteDialog` sets `isDeleteOpen: false` but **leaves `deleteTarget` and `deleteSource` populated** so Radix exit animation completes without the dialog content flashing blank. Target/source are only reset on the next `openDeleteDialog` call (overwritten) or `closeAllDialogs`.
- Ensure `closeAllDialogs` resets all three delete fields: `isDeleteOpen: false`, `deleteTarget: null`, `deleteSource: null`. Update the hardcoded reset object literal in `closeAllDialogs` to include these fields — it is easy to miss.

**Step 4: Update context tests**

- Add coverage for:
  - initial delete dialog state: `isDeleteOpen === false`, `deleteTarget === null`, `deleteSource === null`
  - `openDeleteDialog` sets `isDeleteOpen: true`, stores target + source
  - `closeDeleteDialog` sets `isDeleteOpen: false`, leaves target/source populated (animation-safe)
  - `closeAllDialogs` resets all three delete fields to initial values

**Step 5: Commit**

```bash
git add src/app/(app)/equipment/_components/EquipmentDialogContext.tsx src/app/(app)/equipment/__tests__/EquipmentDialogContext.test.tsx
git commit -m "refactor(equipment): add global delete dialog state to context"
```

### Task 2: Create Shared Equipment Delete Dialog Host

**Files:**
- Create: `src/app/(app)/equipment/_components/EquipmentDeleteDialog.tsx`
- Modify: `src/app/(app)/equipment/equipment-dialogs.tsx`
- Test: `src/app/(app)/equipment/__tests__/equipment-delete-dialog.test.tsx`

**Step 1: Create `EquipmentDeleteDialog` component**

- Consume `useEquipmentContext` for `dialogState.isDeleteOpen`, `dialogState.deleteTarget`, `dialogState.deleteSource`, `closeDeleteDialog`, and `closeDetailDialog`.
- Use `useDeleteEquipment` mutation.
- Render a single `AlertDialog` with existing copy and destructive action style.

**Step 2: Implement source-aware success behavior**

- On mutation `onSuccess`:
  - always call `closeDeleteDialog()` (sets `isDeleteOpen: false`; target/source stay populated through Radix fade-out)
  - if `deleteSource === "detail_dialog"`, also call `closeDetailDialog()` — both actions are available via `useEquipmentContext`
  - `closeDetailDialog` is called after `closeDeleteDialog` so the delete confirm dismisses first, then the detail dialog closes
- Do not call `onDataMutationSuccess` on delete success — `useDeleteEquipment.onSuccess` already invalidates `equipment_list_enhanced`, `active_usage_logs`, `dashboard-stats`, and dispatches `equipment-cache-invalidated`. A second call would cause duplicate invalidation.

**Step 3: Mount shared dialog in equipment host**

- Render `<EquipmentDeleteDialog />` as the **last child** in the `EquipmentDialogs` return fragment, after `<EquipmentDetailDialog />`. Radix portals to `<body>` in mount order; last-mounted portal wins z-index, ensuring the `AlertDialog` layers above the `Dialog` per `docs/frontend/layering.md`.

**Step 4: Add focused tests for shared dialog**

- verify no render when `isDeleteOpen === false`
- verify confirm triggers `useDeleteEquipment().mutate(String(id), ...)`
- verify cancel calls `closeDeleteDialog` without calling mutate
- verify source `"detail_dialog"` calls both `closeDeleteDialog` and `closeDetailDialog` on success
- verify source `"actions_menu"` calls `closeDeleteDialog` but not `closeDetailDialog` on success

**Step 5: Commit**

```bash
git add src/app/(app)/equipment/_components/EquipmentDeleteDialog.tsx src/app/(app)/equipment/equipment-dialogs.tsx src/app/(app)/equipment/__tests__/equipment-delete-dialog.test.tsx
git commit -m "feat(equipment): add shared global delete dialog host"
```

### Task 3: Refactor Equipment Actions Menu to Request Global Delete Dialog

**Files:**
- Modify: `src/components/equipment/equipment-actions-menu.tsx`
- Test: `src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx`

**Step 1: Remove local delete dialog/mutation state**

- Remove:
  - local `showDeleteDialog`
  - local `useDeleteEquipment`
  - inline `AlertDialog` block

**Step 2: Use context delete action**

- Pull `openDeleteDialog` from `useEquipmentContext`.
- On delete menu select, call `openDeleteDialog(equipment, "actions_menu")`.
- Add `openDeleteDialog` to the `useEquipmentContext` mock in the test file (currently missing; will throw if not added).

**Step 3: Preserve existing RBAC and menu behavior**

- Keep `canDeleteEquipment` guard logic unchanged.
- Keep event suppression behavior for row click safety on menu interactions.

**Step 4: Update menu tests**

- stop asserting local dialog rendering from this component
- assert `openDeleteDialog` called with equipment id and `"actions_menu"` when delete item is selected
- retain role-based visibility assertions

**Step 5: Commit**

```bash
git add src/components/equipment/equipment-actions-menu.tsx src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx
git commit -m "refactor(equipment): route row delete through global dialog context"
```

### Task 4: Refactor Equipment Detail Dialog to Request Global Delete Dialog

**Files:**
- Modify: `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx`
- Test: `src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx`

**Step 1: Remove local detail delete dialog state and mutation wiring**

- Remove:
  - `showDeleteConfirm` state
  - local `useDeleteEquipment`
  - local delete `AlertDialog`
  - local `handleDeleteEquipment`

**Step 2: Use global delete request trigger**

- Consume `openDeleteDialog` directly from `useEquipmentContext` inside `EquipmentDetailDialog` (same pattern as `EquipmentActionsMenu` — context-direct is idiomatic for smart components and avoids prop drilling).
- On delete icon button click, call `openDeleteDialog(equipment, "detail_dialog")`.
- Remove `onRequestDeleteEquipment` prop if it was listed as an alternative; it is not used.

**Step 3: Preserve RBAC and UX behavior**

- Keep delete button visibility logic (`isEquipmentManagerRole`) unchanged.
- Keep all non-delete detail dialog logic unchanged (tabs, form, update flow, close confirm on dirty form).

**Step 4: Update tests**

- keep existing RBAC button-visibility assertions
- add `useEquipmentContext` mock that exposes `openDeleteDialog`
- add assertion that clicking the delete icon button calls `openDeleteDialog(equipment, "detail_dialog")`
- remove the dead mock for `@/hooks/use-cached-equipment` (no longer used in this component after refactor)

**Step 5: Commit**

```bash
git add src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx
git commit -m "refactor(equipment): move detail delete confirm to global dialog flow"
```

### Task 5: Regression Coverage and Verification

**Files:**
- Test: `src/app/(app)/equipment/__tests__/EquipmentDialogContext.test.tsx`
- Test: `src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx`
- Test: `src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx`
- Test: `src/app/(app)/equipment/__tests__/equipment-delete-dialog.test.tsx`

**Step 1: Run targeted tests first**

```bash
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/EquipmentDialogContext.test.tsx
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/equipment-actions-menu.test.tsx
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/equipment-detail-dialog-delete-rbac.test.tsx
node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/equipment-delete-dialog.test.tsx
```

Expected: all pass.

**Step 2: Run typecheck**

```bash
node scripts/npm-run.js run typecheck
```

Expected: zero type errors.

**Step 3: Optional broader regression**

```bash
node scripts/npm-run.js run test:run
```

Expected: no equipment-module regressions introduced by context API changes.

**Step 4: Commit**

```bash
git add src/app/(app)/equipment/__tests__
git commit -m "test(equipment): cover global delete dialog context flow"
```

### Task 6: Manual QA Checklist (Feature Behavior)

**Files:**
- N/A (manual verification)

**Step 1: Verify row-action delete flow**

- Open equipment table row menu as `to_qltb`/`global`.
- Click delete.
- Global confirm appears.
- Confirm delete: row removed after data refresh; dialog closes.

**Step 2: Verify detail-dialog delete flow**

- Open detail dialog of same role.
- Click delete icon.
- Global confirm appears above detail dialog.
- Confirm delete: confirm closes, detail dialog closes, data refreshes.

**Step 3: Verify RBAC**

- `regional_leader` and `user` do not get delete action entry points.

**Step 4: Verify interaction safety**

- clicking menu/delete controls does not trigger unintended row open/close behavior.
- cancel path does not mutate.

---

## Design Constraints

1. Keep `EquipmentDialogContext` mutation-free (orchestration only) to stay aligned with existing design notes in `EquipmentDialogContext.tsx`.
2. Keep one delete confirmation dialog host per equipment page provider scope.
3. Keep delete invalidation responsibility in `useDeleteEquipment` to prevent duplicate invalidation/event dispatch chains.
4. Keep AlertDialog layering unchanged (`AlertDialog` remains above `Dialog`) per `docs/frontend/layering.md`. Enforced by rendering `<EquipmentDeleteDialog />` last in `equipment-dialogs.tsx`.
5. Use explicit `isDeleteOpen` boolean (not derived from `deleteTarget !== null`) so Radix exit animations complete without the dialog content flashing blank while `deleteTarget` is cleared.

## Resolved Decisions

1. **Trigger wiring for detail dialog**: Consume `useEquipmentContext` directly in `EquipmentDetailDialog` — same pattern as `EquipmentActionsMenu`. No prop injection.
2. **Delete dialog state shape**: Explicit `isDeleteOpen: boolean` + `deleteTarget: Equipment | null` + `deleteSource: "actions_menu" | "detail_dialog" | null`. `closeDeleteDialog` only sets `isDeleteOpen: false`; target/source stay populated through Radix fade-out.

## Rollback Strategy

1. Revert only the global dialog host and context delete contract commits.
2. Restore local `AlertDialog` blocks in:
   - `equipment-actions-menu.tsx`
   - `EquipmentDetailDialog/index.tsx`
3. Re-run targeted equipment tests to confirm behavior parity.

