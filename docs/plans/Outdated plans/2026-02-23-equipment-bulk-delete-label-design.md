# 2026-02-23 Equipment Bulk Delete Label Design

## 1. Scope & Impact
- Target the equipment list multi-select action bar only.
- Update the destructive action button label inside `src/app/(app)/equipment/_components/EquipmentBulkDeleteBar.tsx` to use a shared constant with the value "Xóa các TB đã chọn".
- Align the corresponding tests in `src/app/(app)/equipment/__tests__/EquipmentBulkDeleteBar.test.tsx` to read the same constant.
- No other modules or translations are affected.

## 2. Shared Constant Placement
- Create `src/app/(app)/equipment/_constants/equipmentBulkActions.ts` containing `EQUIPMENT_BULK_DELETE_LABEL`.
- Keep this file equipment-specific to avoid leaking terminology beyond the module while allowing future equipment bulk actions to share constants here.

## 3. Component & Test Changes
- Component: Import `EQUIPMENT_BULK_DELETE_LABEL` and use it for the destructive `<Button>` text, replacing the inline string.
- Tests: Adjust existing RTL queries/assertions that look for "Xóa đã chọn" to read `EQUIPMENT_BULK_DELETE_LABEL` so implementation and tests stay in sync.
- No behavioral or structural changes besides the label text update.
