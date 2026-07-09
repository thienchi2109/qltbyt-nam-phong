# Issue #722 TDD Plan: Cross-Route Overlay Regression Guardrails

## Summary

- Goal: add focused user-event guardrails for shared toolbar/row-action overlay chains: dropdown -> dialog/sheet -> save/apply/close -> underlying page remains interactive.
- Context confirmed: #722 is open; parent #716 remains open. #717/#720/#721 are already closed, so this is mainly regression coverage, not another migration.
- Known blocker in the same overlay area: #730 is reproducible now. `equipment-toolbar.filters.test.tsx` fails standalone because the HeroUI deferred action timing is not awaited correctly.

## Key Changes

- Fix #730 first as a test-only prerequisite in `src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`: reopen/wait per HeroUI dropdown action instead of clicking multiple deferred menu actions synchronously.
- Add a small test helper in `src/test-utils/overlay-cleanup.ts` only if it avoids duplicate assertions across the two new workflow tests. It should assert:
  - `document.body.style.pointerEvents !== "none"`
  - no leftover inert/focus-trap residue where jsdom exposes it
  - an underlying page button can still be clicked after the overlay closes
- Add Equipment workflow test in a new file, e.g. `src/app/(app)/equipment/__tests__/equipment-actions-overlay-workflow.test.tsx`:
  - use real `EquipmentActionsMenu`
  - use a Radix/shadcn `Dialog` harness for the detail flow
  - select `Xem chi tiết`, assert source menu closes before dialog opens
  - close/save the dialog, then click an underlying page button successfully
- Add Repair Requests workflow test in a new file, e.g. `src/app/(app)/repair-requests/__tests__/RepairRequestRowActionsOverlayWorkflow.test.tsx`:
  - use real `RepairRequestRowActions`
  - cover `Sửa` or `Xem phiếu yêu cầu` through a Radix/shadcn `Sheet`/`Dialog` harness
  - assert menu close, overlay close, cleanup, and underlying page interactivity
- Do not include DeviceQuota/Maintenance in #722. They are outside the issue's minimum coverage.

## TDD Flow

- Red baseline: run the existing standalone failing #730 test and capture failure.
- Write the two new workflow tests before production edits.
- Because current `main` already includes #717/#720/#721 fixes, prove the new tests guard the unsafe pattern with a temporary local mutation only: bypass `useDeferredDropdownAction`/`useOverlayActionTransition`, run the new tests, confirm they fail, then revert the mutation before committing.
- Implement only the smallest fix needed. Expected production changes: none. If production code must change, limit candidates to `EquipmentActionsMenu`, `RepairRequestRowActions`, or `EquipmentHeroDropdown`; stop and reassess if the fix expands beyond those seams.

## Test Plan

- Focused:
  - `node scripts/npm-run.js run test:run -- src/components/equipment/__tests__/equipment-toolbar.filters.test.tsx`
  - `node scripts/npm-run.js run test:run -- src/app/(app)/equipment/__tests__/equipment-actions-overlay-workflow.test.tsx`
  - `node scripts/npm-run.js run test:run -- src/app/(app)/repair-requests/__tests__/RepairRequestRowActionsOverlayWorkflow.test.tsx`
  - existing overlay tests: equipment actions menu, `RepairRequestRowActions`, `controls.test.tsx`, `MobileFloatingActionMenu.test.tsx`
- Full required gates for TS/React diffs:
  - `format:check`
  - `verify:no-explicit-any`
  - `verify:dedupe`
  - `typecheck`
  - focused Vitest commands above
  - `react-doctor`

## Assumptions

- #722 scope is guardrail tests plus minimal test debt repair for #730.
- No Supabase work, migrations, or DB inspection needed.
- If #730 requires production behavior changes rather than test timing repair, keep #730 separate and do not silently widen #722.
- PR should mention #722 and #730 if the #730 standalone failure is fixed, and update parent #716 checklist after merge.
