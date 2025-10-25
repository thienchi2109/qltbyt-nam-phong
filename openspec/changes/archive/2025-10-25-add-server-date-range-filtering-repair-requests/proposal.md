# Add server-side date range filtering for Repair Requests

Status: Completed
Date: 2025-10-25
Owner: Agent Mode

## Summary
Implements server-side date range filtering on `ngay_yeu_cau` for the Repair Requests list while preserving tenant/regional security. The UI now passes `p_date_from`/`p_date_to` (YYYY-MM-DD, local timezone) to the RPC and includes them in the TanStack Query key.

## Files changed
- Backend (SQL): `supabase/migrations/20250125_add_date_range_filter_to_repair_request_list.sql`
  - Adds `p_date_from DATE`, `p_date_to DATE` to `public.repair_request_list(...)`.
  - Index-friendly filtering using half-open range:
    - `r.ngay_yeu_cau >= (p_date_from::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
    - `r.ngay_yeu_cau <  ((p_date_to + interval '1 day')::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`
  - Preserves tenant isolation and role logic (global vs regional vs tenant).

- API Proxy: `src/app/api/rpc/[fn]/route.ts`
  - No code changes required (pass-through of body args).

- Client: `src/app/(app)/repair-requests/page.tsx`
  - Adds date range to React Query `queryKey` and RPC `args`.
  - Resets pagination when date range changes.
  - Persist dates using local format (fixes off-by-one bug):
    - from `toISOString().slice(0,10)` → to `format(date, 'yyyy-MM-dd')`.

- UI fix (stacking): `src/app/(app)/repair-requests/_components/FilterModal.tsx`
  - Ensure calendar popover renders above modal/sheet: `PopoverContent` with `z-[1100]`.

## Security
- Global users: may pass `p_don_vi` (or NULL for all).
- Non-global users: facility limited via `allowed_don_vi_for_session()`; requested `p_don_vi` validated.
- Regional leaders: read-only across allowed facilities; still scoped by WHERE clause.

## Validation
- Direct SQL counts with the same range match RPC totals.
- Verified in UTC DB timezone; comparison uses VN local boundaries.
- Pagination and total unchanged under filters.

## Rollback
- Revert the migration function definition to previous arity.
- Remove date params from client query key and RPC args.
- Optional: restore ISO persistence if necessary (not recommended).
