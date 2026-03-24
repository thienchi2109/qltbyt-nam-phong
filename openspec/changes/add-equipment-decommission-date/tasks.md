## TDD Execution Rule
- [ ] For sections 1, 2, 4, and 5, write the failing test first, verify the expected failure, then implement the minimal code to make it pass.
- [ ] For section 7, add/adjust regression tests before wiring behavior changes, then confirm green after implementation.

## 1. Database & RPC
- [ ] 1.1 Add DB column `ngay_ngung_su_dung` (TEXT, nullable) to `public.thiet_bi` via Supabase migration (with COMMENT).
- [ ] 1.2 Extend unit RPC contract tests in `src/app/api/rpc/__tests__/equipment-status-validation.unit.test.ts` to cover:
  - Accept valid full date when `tinh_trang_hien_tai = "Ngưng sử dụng"`.
  - Reject date when status is not `"Ngưng sử dụng"`.
  - Reject when `ngay_ngung_su_dung < ngay_dua_vao_su_dung` and commission date is full ISO (`YYYY-MM-DD`).
  - Accept when commission date is partial (`YYYY` or `YYYY-MM`) because partial-date behavior remains supported for legacy fields.
  - Assert expected error text for status dependency and chronological violations.
- [ ] 1.3 Implement `equipment_create` to persist `ngay_ngung_su_dung` and enforce validation contract:
  - `ngay_ngung_su_dung` must be null unless status is `"Ngưng sử dụng"`.
  - Chronological check only when `ngay_dua_vao_su_dung` is full ISO date.
- [ ] 1.4 Implement `equipment_update` with the same rules, using effective values (existing row + patch) and allowing manual backfill for existing decommissioned records.
- [ ] 1.5 Verify `equipment_bulk_import` behavior remains delegation-only (`equipment_create` per row) and row-level errors include new validation failures.
- [ ] 1.6 Update TypeScript types: `src/types/database.ts` + `src/lib/data.ts` to include `ngay_ngung_su_dung`.

## 2. Date Validation Helpers
- [ ] 2.1 Add failing unit tests for strict helpers (new test file under `src/lib/__tests__/`) covering:
  - `DD/MM/YYYY` and `YYYY-MM-DD` accepted and normalized.
  - `MM/YYYY`, `YYYY`, and permissive parser-only inputs rejected.
  - Empty input preserved as null/empty.
  - Invalid calendar values rejected (`32/01/2025`, `29/02/2025` on non-leap year, month `13`, day `00`).
- [ ] 2.2 Add strict helpers in `src/lib/date-utils.ts`:
  - `isValidFullDate`
  - `normalizeFullDateForForm`
  - `normalizeFullDateForImport`
  - `FULL_DATE_ERROR_MESSAGE`
- [ ] 2.3 Keep partial-date helpers unchanged for existing fields (`ngay_nhap`, `ngay_dua_vao_su_dung`, `han_bao_hanh`); strict path applies only to `ngay_ngung_su_dung`.

## 3. Equipment Table & Export
- [ ] 3.1 Add `ngay_ngung_su_dung: 'Ngày ngừng sử dụng'` to `columnLabels` in `equipment-table-columns.tsx`.
- [ ] 3.2 Add display formatting for `ngay_ngung_su_dung` as `DD/MM/YYYY` in table/detail rendering path.
- [ ] 3.3 Set default column visibility `ngay_ngung_su_dung: false` in `useEquipmentTable.ts`.
- [ ] 3.4 Ensure Excel export includes the new column via the shared column label flow.

## 4. Import / Template
- [ ] 4.1 Add `ngay_ngung_su_dung: 'Ngày ngừng sử dụng'` to `EQUIPMENT_COLUMN_LABELS` in `excel-utils.ts`.
- [ ] 4.2 Add header mapping `'Ngày ngừng sử dụng': 'ngay_ngung_su_dung'` to `import-equipment-dialog.tsx`.
- [ ] 4.3 Add Excel template guidance text that `Ngày ngừng sử dụng` is only valid when `Tình trạng = "Ngưng sử dụng"` (guidance UX; not authoritative enforcement).
- [ ] 4.4 Add failing import validation tests in `src/components/__tests__/import-equipment-validation.test.ts` covering:
  - Rejecting rows where `ngay_ngung_su_dung` is present but `tinh_trang_hien_tai` is not `"Ngưng sử dụng"`.
  - Rejecting partial or invalid dates for `ngay_ngung_su_dung`.
  - Accepting a valid row with decommissioned status and a valid full date.
  - Returning row-indexed error messages for mixed valid/invalid batches.
- [ ] 4.5 Add import validation that rejects rows where `ngay_ngung_su_dung` is present but `tinh_trang_hien_tai` is not `"Ngưng sử dụng"`.
- [ ] 4.6 In `transformRow()` (`import-equipment-dialog.tsx`), add strict handling branch for `ngay_ngung_su_dung` before generic `dateFields` fallback so partial/permissive dates are rejected.

## 5. UI Forms (TDD for behavior, then wire schema/fields)
- [ ] 5.1 Add failing form-behavior tests (dialog/detail test suites) covering:
  - Auto-set only when the user changes status to `"Ngưng sử dụng"` during the current session.
  - No automatic backfill when loading an existing decommissioned record with an empty date.
  - Manual backfill is allowed when the user enters a date for an existing decommissioned record.
  - Status/date and chronological validation errors surface correctly in the form.
  - User-entered `ngay_ngung_su_dung` is preserved when toggling status away and back within the same session.
- [ ] 5.2 Add `ngay_ngung_su_dung` to the add form schema with strict full-date validation and cross-field/status rules.
- [ ] 5.3 Add transition-aware auto-set logic + `<FormField>` in `add-equipment-dialog.tsx` using timezone `Asia/Ho_Chi_Minh`.
- [ ] 5.4 Add `ngay_ngung_su_dung` to the edit form schema with the same rules.
- [ ] 5.5 Add transition-aware auto-set logic + `<FormField>` in `edit-equipment-dialog.tsx` with no auto-fill on initial load.
- [ ] 5.6 Add `ngay_ngung_su_dung` to `equipmentFormSchema` in `EquipmentDetailTypes.tsx` with the same rules.
- [ ] 5.7 Add transition-aware auto-set logic + `<FormField>` in `EquipmentDetailEditForm.tsx`.
- [ ] 5.8 Add `ngay_ngung_su_dung` to `DEFAULT_FORM_VALUES` / `equipmentToFormValues` in `EquipmentDetailDialog/index.tsx`.

## 6. Print & Display
- [ ] 6.1 Ensure read-only detail display includes `Ngày ngừng sử dụng` via the shared field rendering flow.
- [ ] 6.2 Add `Ngày ngừng sử dụng` row to the print template in `equipment-print-utils.ts`.

## 7. Integration & Regression Sweep
- [ ] 7.1 Update/add regression tests:
  - `src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`
  - `src/lib/__tests__/excel-template-generation.test.ts`
  - `src/components/__tests__/import-equipment-dialog.test.tsx`
- [ ] 7.2 Add/extend table visibility and formatting regression test for `ngay_ngung_su_dung` (`equipment-table-columns` / `useEquipmentTable` path).
- [ ] 7.3 Add any remaining integration coverage for create/import/update flows not already captured above.

## 8. Verification
- [ ] 8.1 Run `npm run typecheck`.
- [ ] 8.2 Run affected tests at minimum:
  - `src/app/api/rpc/__tests__/equipment-status-validation.unit.test.ts`
  - `src/components/__tests__/import-equipment-validation.test.ts`
  - `src/components/__tests__/import-equipment-dialog.test.tsx`
  - `src/components/__tests__/equipment-dialogs.crud.test.tsx`
  - `src/app/(app)/equipment/__tests__/useEquipmentExport.test.ts`
  - `src/lib/__tests__/excel-template-generation.test.ts`
  - any new `date-utils` strict-date test file
- [ ] 8.3 Manual: verify transition-aware auto-set in create/edit/detail flows.
- [ ] 8.4 Manual: verify an existing `"Ngưng sử dụng"` record with empty `ngay_ngung_su_dung` stays empty on load but can be manually saved with a user-entered date.
- [ ] 8.5 Manual: verify import template guidance and import rejection when a non-`"Ngưng sử dụng"` row contains `Ngày ngừng sử dụng`.
