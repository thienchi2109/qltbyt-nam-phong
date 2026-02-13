# Equipment Soft Delete Design

## Current Audit (as of 2026-02-13)

### What is implemented today
- `public.thiet_bi` has no soft-delete columns (`deleted_at`, `is_deleted`, etc. do not exist).
- `public.equipment_delete(bigint)` performs a hard delete: `DELETE FROM public.thiet_bi WHERE id = p_id`.
- `thiet_bi` has dependent FK relationships:
  - `file_dinh_kem`, `lich_su_thiet_bi`, `yeu_cau_luan_chuyen`, `yeu_cau_sua_chua` use `ON DELETE CASCADE`.
  - `cong_viec_bao_tri` uses `ON DELETE SET NULL`.
  - `nhat_ky_su_dung` uses default FK behavior (no cascade), so hard delete can fail when usage rows exist.
- Equipment read paths (`equipment_list`, `equipment_list_enhanced`, `equipment_get`, `equipment_get_by_code`, filter and KPI functions) query `public.thiet_bi` directly and currently include all rows.
- `thiet_bi` has no RLS policies (`relrowsecurity = false`), so visibility is controlled in SECURITY DEFINER RPCs.
- Current Equipment page (`src/app/(app)/equipment`) does not expose a delete action in active UI flows, but RPC `equipment_delete` is still whitelisted in `src/app/api/rpc/[fn]/route.ts` and covered by mutation tests.

### Impact surface
- Core equipment module: list/detail/search/filter/KPI endpoints.
- Cross-module selectors and operations that depend on active equipment records:
  - repair request creation
  - transfer request creation/update
  - usage session start
  - tenant facility equipment counts

## Options Considered

### Option A: Boolean soft-delete (`is_deleted`)
- Pros: Simple schema change.
- Cons: No deletion timestamp or actor metadata; weaker auditability.

### Option B: Tombstone metadata columns
- Add `deleted_at timestamptz`, `deleted_by bigint`, `deletion_reason text`.
- Pros: Reversible, auditable, clean filtering, supports future retention/purge.
- Cons: Requires broad RPC filtering pass.

### Option C: Archive table move
- Pros: Active table remains clean.
- Cons: Complex referential behavior and restore logic; high migration risk.

## Recommended Design
- Use Option A (`is_deleted boolean not null default false`).
- Change `equipment_delete` to `UPDATE thiet_bi SET is_deleted = true`.
- Add `equipment_restore` RPC (`is_deleted = false`).
- Keep `equipment_create`/`equipment_bulk_import` unchanged; explicit insert columns mean `is_deleted` is populated by default as `false`.
- No manual backfill required for existing rows when migration adds `is_deleted` with `NOT NULL DEFAULT false`.
- Keep `ma_thiet_bi` unique across all rows in phase 1 (no partial unique migration yet).
- Exclude soft-deleted rows from all operational inventory reads and counts.
- Keep historical transactional rows (`yeu_cau_*`, `nhat_ky_su_dung`, `lich_su_thiet_bi`) intact; only block new operations from targeting soft-deleted equipment.

## Acceptance Criteria
- Deleting equipment no longer removes the row physically.
- Active inventory screens and selectors never show soft-deleted rows.
- KPI/count functions return active-equipment counts.
- New repair/transfer/usage-start operations reject soft-deleted equipment IDs.
- Restore RPC makes equipment visible again without data loss.
