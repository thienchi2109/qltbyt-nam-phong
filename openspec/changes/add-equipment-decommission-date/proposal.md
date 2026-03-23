## Why
Equipment lifecycle management currently lacks a formal "date of decommissioning" field. When administrators set `tinh_trang_hien_tai` to "Ngưng sử dụng", there is no timestamped record of when the device ended its service life. This hampers depreciation reports, compliance audits, and future capacity planning.

## What Changes
- Add nullable `ngay_ngung_su_dung` (TEXT, strict DD/MM/YYYY stored as ISO YYYY-MM-DD) to `public.thiet_bi`.
- Add client-side `isValidFullDate` / `normalizeFullDateForForm` validators (strict DD/MM/YYYY only; no partial dates).
- Cross-field validation: `ngay_ngung_su_dung >= ngay_dua_vao_su_dung`.
- Auto-populate today's date (UTC+7) when status changes to "Ngưng sử dụng" (user may override).
- Column hidden by default in the equipment table (user can toggle on).
- Wire through all equipment forms (Add, Edit, Detail), print template, Excel import/export/template, and AI schemas.
- No backfill for existing decommissioned devices.

## Impact
- Affected specs: `equipment-catalog` (date fields, validation, import, forms)
- Affected code:
  - **DB**: Supabase migration (1 column)
  - **Types**: `src/types/database.ts`, `src/lib/data.ts`
  - **Date utils**: `src/lib/date-utils.ts` (new helpers + TEXT_DATE_FIELDS)
  - **Table**: `src/components/equipment/equipment-table-columns.tsx`, `src/app/(app)/equipment/_hooks/useEquipmentTable.ts`
  - **Import/Export**: `src/lib/excel-utils.ts`, `src/components/import-equipment-dialog.tsx`
  - **UI forms**: `add-equipment-dialog.tsx`, `edit-equipment-dialog.tsx`, `EquipmentDetailDialog/` (5 files)
  - **Print**: `src/components/equipment/equipment-print-utils.ts`
  - **AI**: `troubleshooting-schema.ts`, `repair-request-draft-schema.ts`, `system.ts`
  - **Tests**: 5 test files
