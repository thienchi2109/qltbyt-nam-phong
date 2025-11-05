## Transfer Data Grid – Facility Filter Audit (2025-11-05)

### Summary
- **Issue**: On the refactored Transfers page, global users see empty tables after selecting a specific facility while the “Tất cả cơ sở” option works.
- **Impact**: All facility-specific views fail, so global/regional users cannot scope data to a tenant.
- **Status**: Reproduced locally; cause identified in the temporary legacy RPC fallback.

### Reproduction Steps
1. Sign in with a global user and open `/app/transfers`.
2. Use the facility dropdown to pick any concrete facility ID.
3. Observe the grid becomes empty and status badges drop to zero; switching back to “Tất cả cơ sở” restores data.

### Root Cause Analysis
- The temporary fallback in `/api/transfers/list` (used when the new `transfer_request_list` RPC isn’t available) calls the legacy RPC (`transfer_request_list(p_q, p_status, …)`), then filters results in Node.
- Legacy `transfer_request_list` embeds equipment info as `thiet_bi:{ …, don_vi }`, **without** the `facility_id` field expected by the new client.
- Our adapter sets `facility_id` from `thiet_bi.facility_id`, so it remains `null` for all rows; the facility filter (`item.thiet_bi?.facility_id === selectedId`) rejects every record.
- Counts endpoint mirrors the same logic, so badge totals also drop to zero.

### Recommended Fix
1. In `transformLegacyItem`, populate `facility_id` from `thiet_bi.don_vi` when `facility_id` is missing.
2. (Optional hardening) Pass `p_don_vi` through to the legacy RPC so Postgres can short-circuit filtering server-side.
3. Add regression checks ensuring filtered data is non-empty for facilities with known transfers.

### Notes
- No schema issues were observed in Supabase — the discrepancy stems purely from JSON field naming in the legacy RPC output.
- Once the new data-grid RPCs are deployed, the fallback path (and this bug) will disappear, but we need the above fix to support the interim state.
