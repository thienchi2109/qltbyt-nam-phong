## Why
Equipment lifecycle management currently lacks a formal "date of decommissioning" field. When administrators set `tinh_trang_hien_tai` to "Ngưng sử dụng", there is no timestamped record of when the device ended its service life. This hampers depreciation reports, compliance audits, and future capacity planning.

## What Changes
- Add nullable `ngay_ngung_su_dung` (TEXT, strict full-date input stored as ISO `YYYY-MM-DD`) to `public.thiet_bi`.
- Persist the field in equipment write RPCs: `equipment_create` and `equipment_update`.
- Keep `equipment_bulk_import` structure unchanged (it already loops and calls `equipment_create` per row), while ensuring row-level errors expose new validation failures.
- Add strict helper contracts in `src/lib/date-utils.ts` for this field:
  - `isValidFullDate(value)` for strict `DD/MM/YYYY` (or ISO `YYYY-MM-DD`) validation.
  - `normalizeFullDateForForm(value)` for form transform to ISO `YYYY-MM-DD`.
  - `normalizeFullDateForImport(value)` for import transform without permissive `Date.parse` fallback.
  - `FULL_DATE_ERROR_MESSAGE = "Định dạng ngày không hợp lệ. Sử dụng: DD/MM/YYYY"`.
- Keep existing partial-date behavior for `ngay_nhap`, `ngay_dua_vao_su_dung`, `han_bao_hanh`; strict full-date behavior applies only to `ngay_ngung_su_dung`.
- Enforce validation in both client and RPC layers:
  - Status dependency: `ngay_ngung_su_dung` must be empty unless `tinh_trang_hien_tai = "Ngưng sử dụng"`.
  - Chronological rule: `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` only when `ngay_dua_vao_su_dung` is a full date (`YYYY-MM-DD`) after normalization.
- Auto-populate today's date only when all conditions are true:
  - user changed status from non-`"Ngưng sử dụng"` to `"Ngưng sử dụng"` in the current session,
  - `ngay_ngung_su_dung` is empty,
  - value is set in `DD/MM/YYYY` format using timezone `Asia/Ho_Chi_Minh`.
- Hide the column by default in the equipment table, while allowing users to toggle it on.
- Wire the field through forms, detail view, print template, Excel export, import mapping, and template guidance.
- Strengthen TDD coverage before implementation with explicit test targets for:
  - strict date helpers (`date-utils`)
  - RPC validation contracts (status dependency + chronological guard)
  - import validation and row-level error behavior
  - transition-aware auto-set behavior in add/edit/detail forms
  - table visibility/format and export/template regression
- Do not automatically backfill existing decommissioned equipment; users may manually backfill during edit.
- AI scope is intentionally excluded from this change. `ai_equipment_lookup` currently uses explicit projection and does not include this field.

## Impact
- Affected specs: `equipment-catalog` (date fields, validation, import, forms)
- Affected code:
  - **DB/RPC**: Supabase migration + `equipment_create` / `equipment_update` (and bulk-import behavior via existing `equipment_create` delegation)
  - **Types**: `src/types/database.ts`, `src/lib/data.ts`
  - **Date utils**: `src/lib/date-utils.ts`
  - **Table**: `src/components/equipment/equipment-table-columns.tsx`, `src/app/(app)/equipment/_hooks/useEquipmentTable.ts`
  - **Import/Export**: `src/lib/excel-utils.ts`, `src/components/import-equipment-dialog.tsx`, `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`
  - **UI forms**: `src/components/add-equipment-dialog.tsx`, `src/components/edit-equipment-dialog.tsx`, `src/app/(app)/equipment/_components/EquipmentDetailDialog/*`
  - **Print**: `src/components/equipment/equipment-print-utils.ts`
  - **Tests**: RPC validation, date-utils strict parsing, import validation, form behavior, export/template coverage
