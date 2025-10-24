## Why
Date range filtering in Repair Requests exists in the UI but is not applied server-side. This leads to inconsistent results, unnecessary client-side filtering, and excess data transfer. We need authoritative, server-side date filtering that respects tenant/regional scoping.

## What Changes
- Extend `repair_request_list` RPC to accept optional `p_date_from` and `p_date_to` (YYYY-MM-DD) and filter by `ngay_yeu_cau` inclusively.
- One-sided ranges supported: only-from (>=) or only-to (<=). When both absent, no date filter.
- Treat dates in VN timezone (Asia/Ho_Chi_Minh) and compare on date boundaries (00:00–23:59:59).
- UI: include date range in TanStack Query `queryKey` and pass to RPC args; remove any leftover client-only date filtering.
- Maintain facility scoping via `p_don_vi` and role rules (proxy overrides for non-global/regional users).

## Impact
- Backend: `supabase/functions` / SQL for `repair_request_list`
- API proxy: `src/app/api/rpc/[fn]/route.ts` (no new function, pass-through args)
- Client: `src/app/(app)/repair-requests/page.tsx` (queryKey + args), `FilterModal` (no UI change), `rr-prefs` (unchanged)

## Success Criteria
- Filtering by date range returns the same row count as a direct SQL with the same constraints.
- Network payload decreases when filtering by narrow ranges.
- Behavior is consistent across reloads and deep links.
