## Why
The `Equipments` desktop table becomes hard to use on smaller desktop screens when `Tên thiết bị` or `Mã thiết bị` contains long values. Those columns consume disproportionate horizontal space, push lower-priority columns out of view, and force unnecessary rightward scrolling for routine browsing.

Issue reference:
- `#196` `[Equipment] Tame long text overflow in Equipments table on smaller desktops`

## What Changes
- Bound the visual width of the two highest-variance text columns in the Equipments desktop table so they no longer control the full table width.
- Keep `Mã thiết bị` on a single line with truncation and a full-text tooltip/focus affordance.
- Allow `Tên thiết bị` to display up to two lines, then clamp with a full-text tooltip/focus affordance.
- Hide `Serial` earlier on narrower desktop widths to preserve visibility for higher-priority columns.
- Keep the scope limited to the Equipments desktop datatable path and shared text-overflow primitives used by that path.
- Preserve existing row click behavior, action-menu behavior, sorting, and column-toggle behavior.
- Verify the change with focused UI regression coverage plus the required TypeScript / React verification sequence before implementation lands.

## Impact
- Affected specs: `equipment-catalog`
- Affected code:
  - `src/components/equipment/equipment-table-columns.tsx`
  - `src/app/(app)/equipment/_hooks/useEquipmentTable.ts`
  - `src/app/(app)/equipment/equipment-content.tsx`
  - `src/components/ui/truncated-text.tsx`
  - `src/components/ui/table.tsx`
  - equipment page / table regression tests
- Dependency review:
  - GitNexus reports `CRITICAL` upstream risk for `createEquipmentColumns` and `useEquipmentTable`, but the effective caller chain is localized to `useEquipmentPage` and `EquipmentPageClient`.
  - Existing pending `equipment-catalog` changes (`add-equipment-so-luu-hanh`, `add-equipment-decommission-date`, `refactor-equipment-page-dialog-consolidation`) must remain compatible with any table-column rendering adjustments.
  - The change must avoid broad table-wide behavior changes that could unintentionally alter unrelated data tables outside the Equipments page.
