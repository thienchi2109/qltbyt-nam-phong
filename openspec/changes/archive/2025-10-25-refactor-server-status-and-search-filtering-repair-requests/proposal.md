# Server-side Status Filtering & Search for Repair Requests

Status: Completed
Date: 2025-10-25
Owner: Agent Mode

## Summary
Refactored the Repair Requests list to perform status filtering (multi-select) and search on the server with full pagination. Added a single counts RPC returning per-status totals consistent with current non-status filters. Preserves tenant isolation and regional leader visibility rules.

## Files changed
- Migration: `supabase/migrations/2025-10-25/20251025_status_filter_and_counts_rpc.sql`
- API proxy allowlist: `src/app/api/rpc/[fn]/route.ts`
- Client: `src/app/(app)/repair-requests/page.tsx`
- OpenSpec: specs + tasks (completed)

## Security
- SECURITY DEFINER functions with hardened search_path
- Non-global users restricted via `allowed_don_vi_for_session()`
- Regional leaders read-only, visibility limited to region’s facilities

## Validation
- Totals and list lengths match direct SQL under combinations of filters
- Counts RPC aligns with (q, date range, facility), excluding status
- Pagination resets on status/search changes

## Lessons Learned
- PostgreSQL does not support `IF EXISTS` on `REVOKE ... ON FUNCTION`. Use `DROP FUNCTION IF EXISTS` to remove old signatures.
- Keep filters index-friendly by transforming parameters, not columns.
