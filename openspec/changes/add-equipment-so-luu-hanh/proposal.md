## Why
Marketing Authorization Number ("Số lưu hành") needs to be stored and visible for equipment records so staff can track regulatory approval alongside existing identifiers. The default equipment table should emphasize this field and de-emphasize less critical columns.

## What Changes
- Add optional `so_luu_hanh` (text, nullable) to `public.thiet_bi`.
- Update equipment RPCs to accept and return `so_luu_hanh` for create/update/list/detail.
- Show the new "Số lưu hành" column by default; hide "Vị trí lắp đặt" and "Model" by default.
- Add "Số lưu hành" to equipment create/edit dialogs and detail view.
- Extend bulk import mapping and template to include "Số lưu hành" (nullable).

## Impact
- Affected specs: `equipment-catalog` (new capability spec).
- Affected code:
  - DB: `supabase/migrations/*` (schema + RPC updates)
  - UI: equipment table columns, default visibility, dialogs, detail view
  - Import: `src/components/import-equipment-dialog.tsx`, `src/lib/excel-utils.ts`
  - Types: `src/types/database.ts`, `src/lib/data.ts`
