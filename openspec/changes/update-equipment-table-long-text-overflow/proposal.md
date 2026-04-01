## Why
The `Equipments` desktop table becomes hard to use on smaller desktop screens when `Tên thiết bị` or `Mã thiết bị` contains long values. Those columns consume disproportionate horizontal space, push lower-priority columns out of view, and force unnecessary rightward scrolling for routine browsing.

Issue reference:
- `#196` `[Equipment] Tame long text overflow in Equipments table on smaller desktops`

## What Changes
- Keep the current Equipments desktop responsive column-visibility behavior unchanged.
- Preserve the existing single-line truncated rendering for long `Mã thiết bị` and `Tên thiết bị` values.
- Add explicit tooltip behavior for long `Mã thiết bị` and `Tên thiết bị` values so users can inspect the complete value on pointer hover and keyboard focus, instead of relying on truncation alone.
- Add bounded width contracts for `Mã thiết bị` and `Tên thiết bị` so those columns cannot stretch disproportionately and push the remaining columns too far to the right.
- Keep the scope limited to the Equipments desktop datatable path. Avoid shared table-primitive changes; prefer equipment-local render helpers or strictly additive tooltip reuse only if it cannot affect unrelated tables.
- Preserve existing row click behavior, action-menu behavior, sorting, and column-toggle behavior.
- Drive implementation with strict TDD:
  - audit dependencies first,
  - write focused failing tests for tooltip/focus access and width-bounded truncation first,
  - confirm the tests fail for the intended reason,
  - implement the minimum code to make them pass,
  - then refactor while keeping the focused tests green.
- Verify the change with focused UI regression coverage plus the required TypeScript / React verification sequence before implementation lands.

## Impact
- Affected specs: `equipment-catalog`
- Affected code:
  - `src/components/equipment/equipment-table-columns.tsx`
  - `src/app/(app)/equipment/_hooks/useEquipmentTable.ts`
  - `src/app/(app)/equipment/equipment-content.tsx`
  - focused `useEquipmentTable` responsive regression tests
  - focused `EquipmentContent` interaction regression tests
- Dependency review:
  - GitNexus reports `CRITICAL` upstream risk for `createEquipmentColumns`, but the effective caller chain is localized to `useEquipmentPage` and `EquipmentPageClient`.
  - Existing pending `equipment-catalog` changes (`add-equipment-so-luu-hanh`, `add-equipment-decommission-date`, `refactor-equipment-page-dialog-consolidation`) must remain compatible with any table-column rendering adjustments.
  - The change must avoid broad table-wide layout or breakpoint changes that could unintentionally alter unrelated data tables outside the Equipments page.
