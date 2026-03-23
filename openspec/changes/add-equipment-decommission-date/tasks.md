## TDD Execution Rule
- [ ] For sections 1, 2, 4, and 5, write the failing test first, verify the expected failure, then implement the minimal code to make it pass.

## 1. Database & RPC
- [ ] 1.1 Add DB column `ngay_ngung_su_dung` (TEXT, nullable) to `public.thiet_bi` via Supabase migration.
- [ ] 1.2 Write failing RPC tests for `equipment_create` covering:
  - Accepting a valid `ngay_ngung_su_dung` when `tinh_trang_hien_tai = "Ngưng sử dụng"`.
  - Rejecting `ngay_ngung_su_dung` when status is not `"Ngưng sử dụng"`.
  - Rejecting `ngay_ngung_su_dung < ngay_dua_vao_su_dung`.
- [ ] 1.3 Implement `equipment_create` to persist `ngay_ngung_su_dung` and enforce:
  - `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` when both are present.
  - `ngay_ngung_su_dung` must be null unless `tinh_trang_hien_tai = "Ngưng sử dụng"`.
- [ ] 1.4 Write failing RPC tests for `equipment_update` covering the same rules plus manual backfill of an existing decommissioned record.
- [ ] 1.5 Update `equipment_update` with the same persistence and validation rules.
- [ ] 1.6 Update TypeScript types: `src/types/database.ts` + `src/lib/data.ts` to include `ngay_ngung_su_dung`.

## 2. Date Validation Helpers
- [ ] 2.1 Write failing unit tests for strict full-date helpers covering:
  - Accepting `DD/MM/YYYY` and normalizing to ISO.
  - Rejecting `MM/YYYY`, `YYYY`, and permissive fallback inputs.
  - Preserving empty values as empty/null.
- [ ] 2.2 Add strict full-date helpers for this field in `src/lib/date-utils.ts` (form + import), along with `FULL_DATE_ERROR_MESSAGE`.
- [ ] 2.3 Add `"ngay_ngung_su_dung"` to the appropriate date-field handling only where strict full-date behavior is intended.

## 3. Equipment Table & Export
- [ ] 3.1 Add `ngay_ngung_su_dung: 'Ngày ngừng sử dụng'` to `columnLabels` in `equipment-table-columns.tsx`.
- [ ] 3.2 Add a dedicated cell/display formatter for ISO `YYYY-MM-DD` -> `DD/MM/YYYY`.
- [ ] 3.3 Set default column visibility `ngay_ngung_su_dung: false` in `useEquipmentTable.ts`.
- [ ] 3.4 Ensure Excel export includes the new column via the shared column label flow.

## 4. Import / Template
- [ ] 4.1 Add `ngay_ngung_su_dung: 'Ngày ngừng sử dụng'` to `EQUIPMENT_COLUMN_LABELS` in `excel-utils.ts`.
- [ ] 4.2 Add header mapping `'Ngày ngừng sử dụng': 'ngay_ngung_su_dung'` to `import-equipment-dialog.tsx`.
- [ ] 4.3 Add Excel template validation that discourages entering `Ngày ngừng sử dụng` unless `Tình trạng = "Ngưng sử dụng"`.
- [ ] 4.4 Write failing import validation tests covering:
  - Rejecting rows where `ngay_ngung_su_dung` is present but `tinh_trang_hien_tai` is not `"Ngưng sử dụng"`.
  - Rejecting partial or invalid dates for `ngay_ngung_su_dung`.
  - Accepting a valid row with decommissioned status and a valid full date.
- [ ] 4.5 Add import validation that rejects rows where `ngay_ngung_su_dung` is present but `tinh_trang_hien_tai` is not `"Ngưng sử dụng"`.
- [ ] 4.6 Add import validation that rejects partial or invalid dates for `ngay_ngung_su_dung` instead of using the permissive generic date fallback.

## 5. UI Forms (TDD for behavior, then wire schema/fields)
- [ ] 5.1 Write failing form-behavior tests covering:
  - Auto-set only when the user changes status to `"Ngưng sử dụng"` during the current session.
  - No automatic backfill when loading an existing decommissioned record with an empty date.
  - Manual backfill is allowed when the user enters a date for an existing decommissioned record.
  - Status/date and chronological validation errors surface correctly in the form.
- [ ] 5.2 Add `ngay_ngung_su_dung` to the add form schema with strict full-date validation and cross-field/status rules.
- [ ] 5.3 Add transition-aware auto-set logic + `<FormField>` in `add-equipment-dialog.tsx`.
- [ ] 5.4 Add `ngay_ngung_su_dung` to the edit form schema with the same rules.
- [ ] 5.5 Add transition-aware auto-set logic + `<FormField>` in `edit-equipment-dialog.tsx`.
- [ ] 5.6 Add `ngay_ngung_su_dung` to `equipmentFormSchema` in `EquipmentDetailTypes.tsx` with the same rules.
- [ ] 5.7 Add transition-aware auto-set logic + `<FormField>` in `EquipmentDetailEditForm.tsx`.
- [ ] 5.8 Add `ngay_ngung_su_dung` to `DEFAULT_FORM_VALUES` / `equipmentToFormValues` in `EquipmentDetailDialog/index.tsx`.

## 6. Print & Display
- [ ] 6.1 Ensure read-only detail display includes `Ngày ngừng sử dụng` via the shared field rendering flow.
- [ ] 6.2 Add `Ngày ngừng sử dụng` row to the print template in `equipment-print-utils.ts`.

## 7. Integration & Regression Sweep
- [ ] 7.1 Update/add export, table, and display regression tests impacted by the new column.
- [ ] 7.2 Add any remaining integration coverage for create/import/update flows not already captured by the TDD steps above.

## 8. Verification
- [ ] 8.1 Run `npm run typecheck`.
- [ ] 8.2 Run all affected tests.
- [ ] 8.3 Manual: verify transition-aware auto-set in create/edit/detail flows.
- [ ] 8.4 Manual: verify an existing `"Ngưng sử dụng"` record with empty `ngay_ngung_su_dung` stays empty on load but can be manually saved with a user-entered date.
- [ ] 8.5 Manual: verify import template guidance and import rejection when a non-`"Ngưng sử dụng"` row contains `Ngày ngừng sử dụng`.
