## 1. Implementation
- [ ] 1.1 Add DB column `so_luu_hanh` (TEXT, nullable) to `public.thiet_bi`; add COMMENT.
- [ ] 1.2 Update RPC `equipment_create` to accept `p_payload->>'so_luu_hanh'` and insert into column.
- [ ] 1.3 Update RPC `equipment_update` to patch `so_luu_hanh` (TEXT).
- [ ] 1.4 Validate `equipment_list_enhanced` returns `so_luu_hanh` (and update default field list/whitelist if needed).
- [ ] 1.5 Update TypeScript types: `src/types/database.ts` + `src/lib/data.ts` to include `so_luu_hanh?: string | null`.
- [ ] 1.6 Add `so_luu_hanh` label to `columnLabels` and include column rendering in equipment table.
- [ ] 1.7 Set default column visibility: hide `model` + `vi_tri_lap_dat`, show `so_luu_hanh`.
- [ ] 1.8 Add `so_luu_hanh` input to add/edit equipment dialogs and detail edit form schema.
- [ ] 1.9 Ensure Equipment Detail view displays `so_luu_hanh` (via columnLabels list).
- [ ] 1.10 Update bulk import mapping + template headers to include "Số lưu hành" (nullable).

## 2. Verification
- [ ] 2.1 Run `npm run typecheck`.
- [ ] 2.2 (If tests updated) Run `npm run test -- --runInBand` or targeted test file(s).
