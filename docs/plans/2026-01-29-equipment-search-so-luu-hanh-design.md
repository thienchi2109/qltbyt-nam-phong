# Equipment Search so_luu_hanh Plan

## Goal
- Extend server-side Equipments search to include `so_luu_hanh` with the same `ILIKE '%q%'` behavior as existing fields.
- Add an index to keep `ILIKE` search performant.

## Non-goals
- No UI changes or new filters.
- No changes to response shape, pagination, or sort whitelist.

## Current Behavior
- The Equipments page uses `equipment_list_enhanced(p_q, ...)` for server-side search.
- Search currently matches `ten_thiet_bi`, `ma_thiet_bi`, and `serial` with `ILIKE '%q%'`.

## Proposed Change
- Update the `equipment_list_enhanced` search clause to also match `so_luu_hanh` with `ILIKE '%q%'`.
- Update the function comment and verification snippet to reflect the new search scope.
- Add a trigram GIN index on `so_luu_hanh` to optimize `ILIKE` contains searches.

## Security Model (No Change)
- Keep `SECURITY DEFINER` and `SET search_path` unchanged.
- Preserve tenant scoping via `allowed_don_vi_for_session_safe()` and existing role checks.
- Continue to build the search clause with `quote_literal` to prevent SQL injection.

## Database Changes
- New migration (date-stamped) that:
  - Ensures `pg_trgm` exists if not already enabled.
  - Creates `idx_thiet_bi_so_luu_hanh_trgm` on `public.thiet_bi` using `gin_trgm_ops`.
  - Replaces `public.equipment_list_enhanced(...)` with the updated search clause.
  - Updates the function comment to include `so_luu_hanh` in the search list.

## Implementation Steps
1. Create a new migration file in `supabase/migrations/` (e.g. `20260129_add_so_luu_hanh_to_equipment_search.sql`).
2. Copy the latest `equipment_list_enhanced` definition from `20260121150000_add_serial_to_equipment_search.sql`.
3. Update the search block to include `so_luu_hanh` in the same OR group as existing search fields, e.g.:
   - `WHERE (ten_thiet_bi ILIKE ... OR ma_thiet_bi ILIKE ... OR serial ILIKE ... OR so_luu_hanh ILIKE ...)`
4. Add the trigram index first (to avoid a performance gap during deploy):
   - `CREATE INDEX IF NOT EXISTS idx_thiet_bi_so_luu_hanh_trgm ON public.thiet_bi USING gin (so_luu_hanh gin_trgm_ops);`
5. Update the function comment and add a verification snippet for `so_luu_hanh` search.

## Verification
- SQL manual check (migration comment):
  - `SET request.jwt.claims TO '{"app_role": "global", "don_vi": "15"}';`
  - `SELECT jsonb_pretty(equipment_list_enhanced('SH-123', 'id.asc', 1, 10, NULL));`
  - Expect rows where `so_luu_hanh` contains `SH-123`.
- UI check:
  - Search in Equipments page with a known `so_luu_hanh` substring.
  - Confirm results respect tenant scoping and role restrictions.

## Rollback
- Recreate `equipment_list_enhanced` using the prior definition (from `20260121150000_add_serial_to_equipment_search.sql`).
- Drop the trigram index if necessary:
  - `DROP INDEX IF EXISTS idx_thiet_bi_so_luu_hanh_trgm;`
