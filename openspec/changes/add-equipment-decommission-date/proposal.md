## Why
Equipment lifecycle management currently lacks a formal "date of decommissioning" field. When administrators set `tinh_trang_hien_tai` to "Ngưng sử dụng", there is no timestamped record of when the device ended its service life. This hampers depreciation reports, compliance audits, and future capacity planning.

## What Changes
- Add nullable `ngay_ngung_su_dung` (TEXT, strict full-date input stored as ISO `YYYY-MM-DD`) to `public.thiet_bi`.
- Persist the field through equipment write RPCs (`equipment_create`, `equipment_update`, and bulk import via `equipment_bulk_import`).
- Add strict full-date validation for forms and import handling; do not allow partial dates (`MM/YYYY`, `YYYY`) for this field.
- Enforce validation in both client and RPC layers:
  - `ngay_ngung_su_dung >= ngay_dua_vao_su_dung` when both values are present.
  - `ngay_ngung_su_dung` must be empty unless `tinh_trang_hien_tai = "Ngưng sử dụng"`.
- Auto-populate today's date (UTC+7) only when the user changes status to `"Ngưng sử dụng"` during the current create/edit session and the field is empty.
- Hide the column by default in the equipment table, while allowing users to toggle it on.
- Wire the field through equipment forms, detail view, print template, Excel export, import mapping, and the Excel template.
- Add Excel template guidance plus import-time rejection for invalid status/date combinations.
- Do not automatically backfill existing decommissioned equipment; users may enter the date manually when editing a decommissioned record.
- AI scope is intentionally excluded from this change.
- Follow-up note: add `ngay_ngung_su_dung` to `ai_equipment_lookup` in a future change so users can query AI about equipment decommission dates.

## Impact
- Affected specs: `equipment-catalog` (date fields, validation, import, forms)
- Affected code:
  - **DB/RPC**: Supabase migration + `equipment_create` / `equipment_update`
  - **Types**: `src/types/database.ts`, `src/lib/data.ts`
  - **Date utils**: `src/lib/date-utils.ts`
  - **Table**: `src/components/equipment/equipment-table-columns.tsx`, `src/app/(app)/equipment/_hooks/useEquipmentTable.ts`
  - **Import/Export**: `src/lib/excel-utils.ts`, `src/components/import-equipment-dialog.tsx`, `src/app/(app)/equipment/_hooks/useEquipmentExport.ts`
  - **UI forms**: `src/components/add-equipment-dialog.tsx`, `src/components/edit-equipment-dialog.tsx`, `src/app/(app)/equipment/_components/EquipmentDetailDialog/*`
  - **Print**: `src/components/equipment/equipment-print-utils.ts`
  - **Tests**: equipment dialogs/import/export/RPC validation coverage
