## Context
The equipment module is RPC-only (no direct table access). UI tables and detail views use a shared `columnLabels` map to define visible fields and labels. The equipment list uses `equipment_list_enhanced`, and create/update are handled by `equipment_create` and `equipment_update`. Bulk import uses a header-to-DB key map and a generated Excel template.

## Goals / Non-Goals
- Goals:
  - Store an optional Marketing Authorization Number (Số lưu hành) for each equipment record.
  - Show "Số lưu hành" by default in the equipment table, and hide "Vị trí lắp đặt" + "Model" by default.
  - Add the field to create/edit dialogs and the equipment detail view.
  - Accept the field via bulk import and template.
- Non-Goals:
  - No new filters/search behavior for `so_luu_hanh`.
  - No changes to print/export layouts beyond what is already derived from `columnLabels`.

## Decisions
- Decision: Add a nullable `so_luu_hanh` column to `public.thiet_bi` and wire through RPCs.
  - Rationale: Keeps data co-located with existing equipment identifiers; minimal migration risk.
- Decision: Drive list and detail display via `columnLabels` so a single change propagates to table and detail view.
  - Rationale: Existing UI already uses `columnLabels` for table columns and detail rendering.
- Decision: Leave existing records as NULL.
  - Rationale: Avoids backfill and preserves data integrity; aligns with fallback strategy.

## Alternatives considered
- Store in a separate regulatory table linked to equipment.
  - Rejected for this scope: extra joins and UI complexity without immediate value.
- Add `so_luu_hanh` to search/filter now.
  - Rejected: out of scope for A; can be added later if needed.

## Risks / Trade-offs
- Column visibility defaults are reset by responsive behavior in `useEquipmentTable`; we should ensure default hiding of `model` persists on larger screens.
- Adding `so_luu_hanh` to `columnLabels` may also affect exports if they derive from the same labels.

## Migration Plan
1. Add column `so_luu_hanh` TEXT NULL to `public.thiet_bi` (no backfill).
2. Update `equipment_create` and `equipment_update` to write the new column.
3. Validate `equipment_list_enhanced` includes the column in JSON output.
4. Update TS types and UI: columns, default visibility, add/edit forms, detail view.
5. Update import mapping + template to accept "Số lưu hành".

## Open Questions
- None (scope confirmed: A + detail view).
