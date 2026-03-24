# Add `ngay_ngung_su_dung` Column to `thiet_bi`

## Goal

Add `ngay_ngung_su_dung` (Ngày ngừng sử dụng) to equipment records and support it consistently across CRUD, import/export, detail display, table display, and print flows.

## Confirmed Rules

1. `ngay_ngung_su_dung` uses strict `DD/MM/YYYY` input and is stored as ISO `YYYY-MM-DD`.
2. `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` only when `ngay_dua_vao_su_dung` is full date (`YYYY-MM-DD`).
3. `ngay_ngung_su_dung` is only allowed when `tinh_trang_hien_tai = "Ngưng sử dụng"`.
4. Auto-set uses timezone `Asia/Ho_Chi_Minh` and only fires when the user changes status to `"Ngưng sử dụng"` in the current session.
5. Existing decommissioned records with no date stay empty on load, but users may manually enter the date later.
6. The equipment table hides this column by default.
7. AI integration is out of scope for this change.
8. Future follow-up: explicitly add `ngay_ngung_su_dung` to `ai_equipment_lookup` projection and AI prompts.

## Scope Summary

### 1. DB & RPC
- Add nullable TEXT column `ngay_ngung_su_dung` to `public.thiet_bi`.
- Update `equipment_create` and `equipment_update` to persist the field.
- Keep `equipment_bulk_import` delegation pattern (calls `equipment_create`) and rely on new `equipment_create` validation for row-level enforcement.
- Enforce the cross-field and status/date rules in RPCs so UI, import, and future callers share one integrity boundary.

### 2. Types & Date Helpers
- Add the field to `src/types/database.ts`, `src/lib/data.ts`, and `src/app/(app)/equipment/types.ts`.
- Add strict full-date helpers for form and import handling in `src/lib/date-utils.ts`:
  - `isValidFullDate`
  - `normalizeFullDateForForm`
  - `normalizeFullDateForImport`
  - `FULL_DATE_ERROR_MESSAGE`
- Keep existing partial-date helpers unchanged for legacy fields.
- Avoid generic permissive import fallback for this field.

### 3. Import / Template / Export
- Add the field to `EQUIPMENT_COLUMN_LABELS`, header mapping, export flow, and import parsing.
- Add template validation guidance so the date column is only valid when status is `"Ngưng sử dụng"`.
- Keep current client-side import UX fail-fast: report row-indexed validation errors and require users to fix the file before submission.

### 4. UI Forms / Detail / Print
- Add the field to add/edit/detail forms.
- Implement transition-aware auto-set logic instead of naive on-load auto-fill.
- Allow manual backfill on existing decommissioned records.
- Show the field in detail view and print output.

### 5. Table & Verification
- Add the column label/formatter and hide the column by default.
- Add tests for UI validation, import rejection, and RPC enforcement.

## Suggested Verification

### Automated
```bash
npm run typecheck
```

Run affected test suites for:
- equipment dialog validation
- import validation/template behavior
- export/table display
- RPC validation for create/update

### Manual

1. Create or edit a device and confirm `ngay_ngung_su_dung` auto-fills only after changing status to `"Ngưng sử dụng"` in that session.
2. Open an existing `"Ngưng sử dụng"` record with empty `ngay_ngung_su_dung` and confirm the field stays empty on load.
3. Manually enter a date for that existing record and confirm save succeeds.
4. Verify save/import rejection when a non-`"Ngưng sử dụng"` record contains `ngay_ngung_su_dung`.
5. Verify table default visibility and print output.
6. Verify downloaded Excel template includes the new column and status/date validation guidance.
7. Verify chronological check applies only when `ngay_dua_vao_su_dung` is full date (`YYYY-MM-DD`), not partial (`YYYY`/`YYYY-MM`).

## Post-Implementation Maintainability Note

- `react-doctor` reported non-blocking file-size warnings for:
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/EquipmentDetailEditForm.tsx` (`444` lines)
  - `src/app/(app)/equipment/_components/EquipmentDetailDialog/index.tsx` (`443` lines)
  - `src/components/add-equipment-dialog.tsx` (`406` lines)
- Recommended handling is a follow-up cleanup PR, not expansion of the feature PR scope.
- Extraction priority:
  1. `EquipmentDetailEditForm.tsx`: split into larger form-section components that share `useFormContext`.
  2. `EquipmentDetailDialog/index.tsx`: extract form-state mapping/defaults and the action footer.
  3. `add-equipment-dialog.tsx`: extract dialog data/mutation orchestration and a few grouped field sections.
- Avoid over-fragmenting into many one-field components; split by responsibility to reduce file size without making navigation worse.
